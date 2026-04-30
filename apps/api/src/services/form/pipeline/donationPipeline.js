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

                // Provision donor account
                let donorAccountId = null;
                if (donorEmail) {
                    const accountDetails = await helpers._provisionDonorAccount(donorEmail, donorName, donorExtras);
                    if (accountDetails) {
                        donorAccountId = accountDetails.userId;
                        const portalUrl = env.frontendUrl ? `${env.frontendUrl}/portal-visitor` : "http://localhost:5173/portal-visitor";

                        if (accountDetails.isNew) {
                            await sendEmail({
                                to: donorEmail,
                                subject: "Donation Accepted - Track Your Artifact",
                                html: `
                                    <h2>Thank you, ${donorName}!</h2>
                                    <p>Your proposed donation has passed our initial screening and is now in formal review.</p>
                                    <p>We have created a secure Visitor Portal account for you.</p>
                                    <hr/>
                                    <p><strong>Portal Login:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
                                    <p><strong>Username:</strong> ${accountDetails.username}</p>
                                    <p><strong>Temporary Password:</strong> ${accountDetails.password}</p>
                                    <p><em>Please log in and change your password as soon as possible.</em></p>
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
                }

                const parsedItems = helpers._extractSubmissionItems(data, mapping);
                const intakes = [];
                const donationItems = [];

                for (const item of parsedItems) {
                    let method = acquisitionMethod?.toLowerCase() || "gift";
                    if (!["gift", "loan", "purchase", "existing"].includes(method)) method = "gift";

                    const result = await acquisitionService.registerExternalIntake(
                        staffId, submission.id, donorAccountId, donorName, method, item
                    );
                    
                    intakes.push(result.intake);
                    donationItems.push(result.donationItem);
                }

                await db.query('UPDATE form_submissions SET status = "processed" WHERE id = ?', [submissionId]);

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
