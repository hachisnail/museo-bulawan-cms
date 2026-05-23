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
                const data = typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data;
                const settings = typeof submission.form_settings === 'string' ? JSON.parse(submission.form_settings) : submission.form_settings;
                const mapping = settings?.field_mapping || {};

                // Extract donor info
                const firstName = data[mapping.firstName] || data.donor_first_name || data.firstName || "Anonymous";
                const lastName = data[mapping.lastName] || data.donor_last_name || data.lastName || "";
                const donorName = (data[mapping.donorName] || `${firstName} ${lastName}`).trim();
                const donorEmail = data[mapping.donorEmail] || data.donor_email || data.email;
                const acquisitionMethod = data[mapping.acquisitionType] || data.acquisition_type || "gift";

                const donorExtras = {
                    title: data.donor_title || "",
                    phone: data.donor_phone || "",
                    address: data.donor_address || ""
                };

                // ==========================================
                // PHASE 1: Provision donor account (outside transaction — has external side effects)
                // ==========================================
                let donorAccountId = null;
                if (donorEmail) {
                    const accountDetails = await helpers._provisionDonorAccount(donorEmail, donorName, donorExtras);
                    donorAccountId = accountDetails.userId;
                    const portalUrl = env.frontendUrl ? `${env.frontendUrl}/portal-visitor` : "http://localhost:5173/portal-visitor";

                    if (accountDetails.isNew) {
                        await sendEmail({
                            to: donorEmail,
                            subject: "Donation Accepted - Set Up Your Account",
                            html: `
                                <h2>Thank you, ${donorName}!</h2>
                                <p>Your proposed donation has passed our initial screening and is now in formal review.</p>
                                <p>We have created a secure Visitor Portal account for you. Please set up your account by clicking the link below:</p>
                                <hr/>
                                <p style="text-align: center; margin: 24px 0;">
                                    <a href="${accountDetails.setupUrl}" style="background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Set Up Your Account</a>
                                </p>
                                <p style="font-size: 12px; color: #6b7280;">This link expires in 7 days. If it expires, please contact us for a new one.</p>
                                <p>Once your account is set up, you can track your donation at: <a href="${portalUrl}">${portalUrl}</a></p>
                            `
                        });
                    } else {
                        await sendEmail({
                            to: donorEmail,
                            subject: "Donation Update - Items Accepted for Review",
                            html: `
                                <h2>Hello again, ${donorName}!</h2>
                                <p>Your new donation has passed our initial screening.</p>
                                <p>Track progress in your Visitor Portal: <a href="${portalUrl}">${portalUrl}</a></p>
                            `
                        });
                    }
                }

                // ==========================================
                // PHASE 2: Create intake records in a transaction for atomicity
                // ==========================================
                const parsedItems = helpers._extractSubmissionItems(data, mapping);

                const { intakes, donationItems } = await db.transaction(async (tx) => {
                    const txIntakes = [];
                    const txDonationItems = [];

                    for (const item of parsedItems) {
                        let method = acquisitionMethod?.toLowerCase() || "gift";
                        if (!["gift", "loan", "purchase", "existing"].includes(method)) method = "gift";

                        const result = await acquisitionService.registerExternalIntake(
                            staffId, submission.id, donorAccountId, donorName, method, item, tx
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
