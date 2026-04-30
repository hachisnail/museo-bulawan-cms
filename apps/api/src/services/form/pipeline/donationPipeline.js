import { pbService } from "../../pocketbaseService.js";
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
                const submission = await pbService.pb
                    .collection("form_submissions")
                    .getOne(submissionId, { expand: "form_id" });
                
                const definition = submission.expand?.form_id;
                if (!definition || definition.type !== "donation") {
                    throw new Error("UNAUTHORIZED_PIPELINE_ACTION: Only donation submissions can be processed into the acquisition system.");
                }

                assertTransition("submission", submission.status, "processed");

                const mapping = definition.settings?.field_mapping || {};

                // Extract donor info
                const firstName = submission.data[mapping.firstName] || submission.data.donor_first_name || submission.data.firstName || "Anonymous";
                const lastName = submission.data[mapping.lastName] || submission.data.donor_last_name || submission.data.lastName || "";
                const donorName = (submission.data[mapping.donorName] || `${firstName} ${lastName}`).trim();
                const donorEmail = submission.data[mapping.donorEmail] || submission.data.donor_email || submission.data.email;
                const acquisitionMethod = submission.data[mapping.acquisitionType] || submission.data.acquisition_type || "gift";

                const donorExtras = {
                    title: submission.data.donor_title || "",
                    phone: submission.data.donor_phone || "",
                    address: submission.data.donor_address || ""
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

                const parsedItems = helpers._extractSubmissionItems(submission.data, mapping);
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

                await pbService.pb.collection("form_submissions").update(submissionId, { status: "processed" });

                notificationService.sendToRole("admin", "New Intake Created", 
                    `External submission processed into ${intakes.length} intake(s).`);

                return { intakes, donationItems };
            } catch (error) {
                logger.error(`Error processing external intake: ${error.message}`);
                throw error;
            }
        });
    }
};
