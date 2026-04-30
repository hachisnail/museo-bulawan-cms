import crypto from "crypto";
import { db } from "../config/db.js";
import { userService } from "./userService.js";
import { logger } from "../utils/logger.js";
import { donationPipeline } from "./form/pipeline/donationPipeline.js";
import { compliancePipeline } from "./form/pipeline/compliancePipeline.js";
import { globalMutex } from "../utils/mutex.js";

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

  /**
   * COMPLIANCE: Conservation Log
   */
  async processConservationLogForm(staffId, submissionId, files = null) {
    return await compliancePipeline.processConservationLogForm(staffId, submissionId, files, this);
  },

  // ==========================================
  // INTERNAL LOGIC HELPERS (Shared across pipelines)
  // ==========================================

  async _resolveReporterName(staffId) {
    try {
      const [user] = await db.query('SELECT fname, lname FROM users WHERE id = ?', [staffId]);
      if (user) {
        return `${user.fname} ${user.lname}`.trim();
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  /**
   * Standardizes the lifecycle of processing a form submission.
   */
  async _executeFormWorkflow(submissionId, workflowName, processorFn) {
    try {
      const [submission] = await db.query('SELECT * FROM form_submissions WHERE id = ?', [submissionId]);

      if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
      
      const data = typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data;

      if (!data.artifact_id) {
        throw new Error("MISSING_ARTIFACT_ID");
      }

      const result = await processorFn(data);

      await db.query('UPDATE form_submissions SET status = "processed" WHERE id = ?', [submissionId]);

      return result;
    } catch (error) {
      logger.error(`Error in ${workflowName}: ${error.message}`);
      throw error;
    }
  },

  async _provisionDonorAccount(email, name, extras = {}) {
    const lockKey = `provision_user_${email.toLowerCase()}`;
    return await globalMutex.runExclusive(lockKey, async () => {
      try {
        const [existingUser] = await db.query('SELECT id, username FROM users WHERE email = ?', [email]);

        if (existingUser) {
          return { userId: existingUser.id, isNew: false, password: null, username: existingUser.username };
        }

        const [fname, ...rest] = (name || "Valued Donor").split(" ");
        const lname = rest.join(" ") || "";

        const result = await userService.provisionDonor({ fname, lname, email, ...extras });

        return {
          userId: result.userId,
          isNew: true,
          password: result.tempPassword,
          username: result.username,
        };
      } catch (error) {
        logger.error(`Error provisioning donor account: ${error.message}`);
        return null;
      }
    });
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
