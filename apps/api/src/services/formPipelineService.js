import crypto from "crypto";
import { pbService } from "./pocketbaseService.js";
import { acquisitionService } from "./acquisitionService.js";
import { userService } from "./userService.js";
import { notificationService } from "./notificationService.js";
import { logger } from "../utils/logger.js";
import { assertTransition } from "../utils/stateMachine.js";
import { globalMutex } from "../utils/mutex.js";
import { sendEmail } from "../utils/mailer.js";
import { env } from "../config/env.js";

/**
 * FormPipelineService
 *
 * Handles high-level orchestration of form-driven workflows.
 * Segregates "pipeline" automation from core domain business logic.
 */
export const formPipelineService = {
  _genId() {
    return crypto.randomBytes(8).toString("hex").substring(0, 15);
  },

// ==========================================
  // PHASE 1A: Process External Form → Intake(s)
  // ==========================================
  async processExternalIntake(staffId, submissionId) {
    return await globalMutex.runExclusive(`sub_${submissionId}`, async () => {
      try {
        const submission = await pbService.pb
          .collection("form_submissions")
          .getOne(submissionId, { expand: "form_id" });
          
        // Safeguard: Only allow processing if the form is of type 'donation'
        const definition = submission.expand?.form_id;
        if (!definition || definition.type !== "donation") {
          throw new Error(
            "UNAUTHORIZED_PIPELINE_ACTION: Only donation submissions can be processed into the acquisition system.",
          );
        }

        assertTransition("submission", submission.status, "processed");

        const mapping = definition.settings?.field_mapping || {};

        // Extract donor info with robust fallbacks
        const firstName = submission.data[mapping.firstName] || submission.data.firstName || submission.data.first_name || "Anonymous";
        const lastName = submission.data[mapping.lastName] || submission.data.lastName || submission.data.last_name || "";
        const donorName = (submission.data[mapping.donorName] || submission.data.donor_name || submission.data.full_name || `${firstName} ${lastName}`).trim();
        const donorEmail = submission.data[mapping.donorEmail] || submission.data.donorEmail || submission.data.email || submission.data.donor_email;
        const acquisitionMethod = submission.data[mapping.acquisitionType] || submission.data.acquisition_type || submission.data.method || "gift";

        // Extra donor info
        const donorTitle = submission.data.donor_title || "";
        const donorPhone = submission.data.donor_phone || "";
        const donorAddress = submission.data.donor_address || "";

        // Provision donor account
        let donorAccountId = null;
        if (donorEmail) {
          const accountDetails = await this._provisionDonorAccount(
            donorEmail,
            donorName,
            { title: donorTitle, phone: donorPhone, address: donorAddress },
          );
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
                `,
              });
            } else {
              await sendEmail({
                to: donorEmail,
                subject: "Donation Update - Items Accepted for Review",
                html: `
                    <h2>Hello again, ${donorName}!</h2>
                    <p>Your new donation has passed our initial screening.</p>
                    <p>Track progress in your Visitor Portal: <a href="${portalUrl}">${portalUrl}</a></p>
                `,
              });
            }
          }
        }

        // 1. Pure Extraction: Parse the data into Javascript objects (NO DB CALLS HERE)
        const parsedItems = this._extractSubmissionItems(submission.data, mapping);

        const intakes = [];
        const donationItems = [];

        // 2. Strict Delegation: Pass clean data to the domain service
        for (const item of parsedItems) {
          let method = acquisitionMethod?.toLowerCase() || "gift";
          if (!["gift", "loan", "purchase", "existing"].includes(method)) {
            method = "gift";
          }

          const result = await acquisitionService.registerExternalIntake(
              staffId, 
              submission.id, 
              donorAccountId, 
              donorName, 
              method, 
              item
          );
          
          intakes.push(result.intake);
          donationItems.push(result.donationItem);
        }

        await pbService.pb
          .collection("form_submissions")
          .update(submissionId, { status: "processed" });

        notificationService.sendToRole(
          "admin",
          "New Intake Created",
          `External submission processed into ${intakes.length} intake(s).`,
        );

        return { intakes, donationItems };
      } catch (error) {
        logger.error(`Error processing external intake: ${error.message}`, {
          details: error.data || error.response?.data,
        });
        throw error;
      }
    });
  },
  /**
   * Processes an Artifact Health Form submission.
   */
  async processHealthReportForm(staffId, submissionId, files = null) {
    return this._executeFormWorkflow(
      submissionId,
      "processHealthReportForm",
      async (data) => {
        const { artifact_id, condition, detailed_notes, reporter } = data;

        // Resolve reporter name cleanly
        let reporterName =
          reporter?.trim() ||
          (await this._resolveReporterName(staffId)) ||
          "System";

        const report = await acquisitionService.createConditionReport(
          staffId,
          "inventory",
          artifact_id,
          condition,
          detailed_notes,
          submissionId,
          reporterName,
        );

        // Attach files if they exist
        if (files?.length > 0) {
          await pbService.uploadToField(
            "condition_reports",
            report.id,
            "attachments",
            files,
          );
        }

        return report;
      },
    );
  },

  /**
   * Processes an Artifact Movement Trail Form submission.
   */

  async processMovementTrailForm(staffId, submissionId, files = null) {
    return this._executeFormWorkflow(
      submissionId,
      "processMovementTrailForm",
      async (data) => {
        const { artifact_id, to_location, reason, moved_by } = data;

        const compiledReason = `${reason}\n\nMoved by: ${moved_by || "Unknown"}`;

        return await acquisitionService.transferLocation(
          staffId,
          artifact_id,
          to_location,
          compiledReason,
          submissionId,
        );
      },
    );
  },

  // ==========================================
  // HELPERS
  // ==========================================

  async _resolveReporterName(staffId) {
    try {
      const pbUserId = await pbService.getAppUserId(staffId);
      if (pbUserId) {
        const user = await pbService.pb
          .collection("app_users")
          .getOne(pbUserId);
        return user.name;
      }
    } catch (err) {
      return null; // Fail silently, default fallback will catch it
    }
  },

  // ==========================================
  // HELPERS (Moved from AcquisitionService)
  // ==========================================

  /**
   * Standardizes the lifecycle of processing a form submission.
   * Handles fetching, error logging, and marking the submission as processed.
   */
  async _executeFormWorkflow(submissionId, workflowName, processorFn) {
    try {
      // 1. Fetch the standard submission
      const submission = await pbService.pb
        .collection("form_submissions")
        .getOne(submissionId);

      // 2. Validate core requirements universally
      if (!submission.data.artifact_id) {
        throw new Error("MISSING_ARTIFACT_ID");
      }

      // 3. Execute the unique business logic injected via the callback
      const result = await processorFn(submission.data);

      // 4. Standardize the success state
      await pbService.pb
        .collection("form_submissions")
        .update(submissionId, { status: "processed" });

      return result;
    } catch (error) {
      // 5. Standardize error logging
      logger.error(`Error in ${workflowName}: ${error.message}`, {
        details: error.data || error.response?.data,
      });
      throw error;
    }
  },
  async _provisionDonorAccount(email, name, extras = {}) {
    try {
      const existingUser = await pbService.pb
        .collection("app_users")
        .getFirstListItem(`email="${email}"`)
        .catch(() => null);

      if (existingUser) {
        return { userId: existingUser.id, isNew: false, password: null };
      }

      const [fname, ...rest] = (name || "Valued Donor").split(" ");
      const lname = rest.join(" ") || "";

      const { userId, tempPassword, username } =
        await userService.provisionDonor({ fname, lname, email, ...extras });
      const pbUserId = await pbService.getAppUserId(userId);

      return {
        userId: pbUserId,
        isNew: true,
        password: tempPassword,
        username,
      };
    } catch (error) {
      logger.error(`Error provisioning donor account: ${error.message}`);
      return null;
    }
  },

// Pure function: Extracts and normalizes form data into clean JSON objects
  _extractSubmissionItems(submissionData, mapping) {
    const itemsKey = mapping.items || "items";
    
    // Safely extract the target data
    let rawData = submissionData[itemsKey];
    if (!rawData) rawData = submissionData;

    // Normalize to an array
    const rawItems = Array.isArray(rawData) ? rawData : [rawData];

    // Return mapped objects without executing any database transactions
    return rawItems.map((raw) => ({
      itemName:
        raw[mapping.itemName] ||
        raw.item_name ||
        raw.itemName ||
        raw.name ||
        raw.title ||
        (raw.item_description
          ? raw.item_description.substring(0, 50)
          : "Unnamed Item"),
      description:
        raw[mapping.description] ||
        raw.item_description ||
        raw.description ||
        "",
      quantity: raw.quantity || 1
    }));
  },
};
