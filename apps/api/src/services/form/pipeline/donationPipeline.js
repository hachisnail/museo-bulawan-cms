import { db } from "../../../config/db.js";
import { acquisitionService } from "../../acquisitionService.js";
import { userService } from "../../userService.js";
import { notificationService } from "../../notificationService.js";
import { logger } from "../../../utils/logger.js";
import { globalMutex } from "../../../utils/mutex.js";
import { sendEmail } from "../../../utils/mailer.js";
import { env } from "../../../config/env.js";
import { assertTransition } from "../../../utils/stateMachine.js";

/**
 * DonationPipeline
 * 
 * Specifically handles the workflow of processing a 'donation' form submission
 * into the museum intake system, including donor account provisioning.
 */
export const donationPipeline = {
    async processExternalIntake(staffId, submissionId, helpers) {
        return await globalMutex.runExclusive(`sub_${submissionId}`, async () => {
            try {
                const [submission] = await db.query(`
                    SELECT s.*, f.id as form_def_id, f.type as form_type, f.settings as form_settings
                    FROM form_submissions s
                    JOIN form_definitions f ON s.form_id = f.id
                    WHERE s.id = ?
                `, [submissionId]);
                
                if (!submission || submission.form_type !== "donation") {
                    throw new Error("UNAUTHORIZED_PIPELINE_ACTION: Only donation submissions can be processed into the acquisition system.");
                }

                assertTransition("submission", submission.status, "processed");

                // Parse JSON fields
                // L-6: Wrap JSON.parse in try/catch to handle malformed submission data gracefully.
                let data;
                try {
                    data = typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data;
                } catch (parseErr) {
                    throw new Error(`MALFORMED_SUBMISSION_DATA: Submission data JSON is malformed: ${parseErr.message}`);
                }
                const settings = typeof submission.form_settings === 'string' ? JSON.parse(submission.form_settings) : submission.form_settings;
                const mapping = settings?.field_mapping || {};

                // Extract donor info (with anonymous donor support)
                const isAnonymous = data.is_anonymous === true || data.is_anonymous === 'true' || data.is_anonymous === 1 || data.is_anonymous === '1';
                const firstName = isAnonymous ? "Anonymous" : (data[mapping.firstName] || data.donor_first_name || data.firstName || "Anonymous");
                const lastName = isAnonymous ? "Donor" : (data[mapping.lastName] || data.donor_last_name || data.lastName || "");
                const donorName = (data[mapping.donorName] || `${firstName} ${lastName}`).trim();
                const donorEmail = data[mapping.donorEmail] || data.donor_email || data.email;
                const acquisitionMethod = data[mapping.acquisitionType] || data.acquisition_type || "gift";

                const donorExtras = isAnonymous ? { title: "", phone: "", address: "" } : {
                    title: data.donor_title || "",
                    phone: data.donor_phone || "",
                    address: data.donor_address || ""
                };

                // Extract loan end date for loan-type acquisitions
                let loanEndDate = null;
                if (acquisitionMethod.toLowerCase() === "loan" && data.loan_end_date) {
                    loanEndDate = data.loan_end_date;
                    // Edge case: validate loan end date is not in the past
                    const parsedDate = new Date(loanEndDate);
                    if (parsedDate < new Date() && !isNaN(parsedDate.getTime())) {
                        logger.warn(`Loan end date ${loanEndDate} is in the past for submission ${submissionId}. Proceeding anyway — staff can override.`);
                    }
                }

                // Visitor account provisioning is deferred to the intake approval (MOA generation) step.
                const donorAccountId = null;

                // ==========================================
                // PHASE 2: Create intake records in a transaction for atomicity
                // ==========================================
                const parsedItems = helpers._extractSubmissionItems(data, mapping);

                const { intakes, donationItems } = await db.transaction(async (tx) => {
                    const txIntakes = [];
                    const txDonationItems = [];

                    for (const item of parsedItems) {
                        let method = acquisitionMethod?.toLowerCase() || "gift";
                        if (!["gift", "loan", "purchase", "existing", "bequest"].includes(method)) method = "gift";

                        const result = await acquisitionService.registerExternalIntake(
                            staffId, submission.id, donorAccountId, donorName, method, item, loanEndDate, tx
                        );
                        
                        txIntakes.push(result.intake);
                        txDonationItems.push(result.donationItem);
                    }

                    await tx.query('UPDATE form_submissions SET status = "processed" WHERE id = ?', [submissionId]);

                    return { intakes: txIntakes, donationItems: txDonationItems };
                });

                notificationService.sendToRole("admin", "New Intake Created", 
                    `External submission processed into ${intakes.length} intake(s).`, "info", { actionUrl: intakes.length === 1 ? `/intakes?id=${intakes[0].id}` : "/intakes" });

                return { intakes, donationItems };
            } catch (error) {
                logger.error(`Error processing external intake: ${error.message}`);
                throw error;
            }
        });
    }
};
