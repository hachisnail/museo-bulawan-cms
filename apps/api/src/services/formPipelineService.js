import crypto from "crypto";
import { pbService } from "./pocketbaseService.js";
import { userService } from "./userService.js";
import { logger } from "../utils/logger.js";
import { donationPipeline } from "./form/pipeline/donationPipeline.js";
import { compliancePipeline } from "./form/pipeline/compliancePipeline.js";

/**
 * FormPipelineService Facade
 *
 * Orchestrates high-level form-driven workflows by segregating "pipeline" automation 
 * from core domain logic.
 */
export const formPipelineService = {
  // ==========================================
  // SHARED HELPERS
  // ==========================================
  _genId() {
    return crypto.randomBytes(8).toString("hex").substring(0, 15);
  },

  // ==========================================
  // PIPELINE DELEGATION
  // ==========================================

  /**
   * PHASE 1A: Process External Form → Intake(s)
   */
  async processExternalIntake(staffId, submissionId) {
    return await donationPipeline.processExternalIntake(staffId, submissionId, this);
  },

  /**
   * COMPLIANCE: Health Report
   */
  async processHealthReportForm(staffId, submissionId, files = null) {
    return await compliancePipeline.processHealthReportForm(staffId, submissionId, files, this);
  },

  /**
   * COMPLIANCE: Movement Trail
   */
  async processMovementTrailForm(staffId, submissionId, files = null) {
    return await compliancePipeline.processMovementTrailForm(staffId, submissionId, files, this);
  },

  // ==========================================
  // INTERNAL LOGIC HELPERS (Shared across pipelines)
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
      return null;
    }
  },

  /**
   * Standardizes the lifecycle of processing a form submission.
   */
  async _executeFormWorkflow(submissionId, workflowName, processorFn) {
    try {
      const submission = await pbService.pb
        .collection("form_submissions")
        .getOne(submissionId);

      if (!submission.data.artifact_id) {
        throw new Error("MISSING_ARTIFACT_ID");
      }

      const result = await processorFn(submission.data);

      await pbService.pb
        .collection("form_submissions")
        .update(submissionId, { status: "processed" });

      return result;
    } catch (error) {
      logger.error(`Error in ${workflowName}: ${error.message}`);
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

  _extractSubmissionItems(submissionData, mapping) {
    const itemsKey = mapping.items || "items";
    let rawData = submissionData[itemsKey] || submissionData;
    const rawItems = Array.isArray(rawData) ? rawData : [rawData];

    return rawItems.map((raw) => ({
      itemName:
        raw[mapping.itemName] ||
        raw.artifact_name ||
        raw.item_name ||
        raw.itemName ||
        raw.name ||
        raw.title ||
        (raw.artifact_description || raw.item_description
          ? (raw.artifact_description || raw.item_description).substring(0, 50)
          : "Unnamed Item"),
      description:
        raw[mapping.description] ||
        (raw.artifact_description && raw.artifact_provenance 
            ? `${raw.artifact_description}\n\nProvenance: ${raw.artifact_provenance}` 
            : (raw.artifact_description || raw.artifact_provenance || raw.item_description || raw.description || "")),
      quantity: raw.quantity || 1
    }));
  },
};
