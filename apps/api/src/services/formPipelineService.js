import { db } from "../config/db.js";
import { userService } from "./userService.js";
import { logger } from "../utils/logger.js";
import { donationPipeline } from "./form/pipeline/donationPipeline.js";
import { compliancePipeline } from "./form/pipeline/compliancePipeline.js";
import { globalMutex } from "../utils/mutex.js";
import { assertTransition } from "../utils/stateMachine.js";

/**
 * FormPipelineService Facade
 *
 * Orchestrates high-level form-driven workflows by segregating "pipeline" automation 
 * from core domain logic.
 */
export const formPipelineService = {

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

  /**
   * PROCESS: Appointment Form Submission
   */
  async processAppointmentForm(staffId, submissionId, files = null) {
    const { ulid } = await import("ulidx");
    const { mediaService } = await import("./mediaService.js");
    return await db.transaction(async (tx) => {
      // 1. Fetch form submission
      const [submission] = await tx.query('SELECT * FROM form_submissions WHERE id = ?', [submissionId]);
      if (!submission) throw new Error("SUBMISSION_NOT_FOUND");

      const data = typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data;

      // 2. Combine name fields
      const visitor_name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Walk-in Visitor';

      // 3. Address fields mapped to additional notes
      let additional_notes = data.additionalNotes || "";
      if (data.province || data.city || data.barangay) {
        const addr = `Address: ${data.barangay || ''}, ${data.city || ''}, ${data.province || ''}`.replace(/^Address:\s*,\s*,\s*$/, '').trim();
        if (addr) {
          additional_notes = additional_notes ? `${additional_notes}\n${addr}` : addr;
        }
      }

      // 4. Resolve media names
      const submissionMedia = await mediaService.listMedia('form_submissions', submissionId, {}, tx);
      const requestFiles = (submissionMedia.items || []).map(m => m.file_name);

      // 5. Generate appointment ID and insert record
      const appointmentId = ulid();
      const initialStatus = staffId ? 'APPROVED' : 'PENDING';

      const appointmentData = {
        id: appointmentId,
        visitor_name,
        visitor_email: data.email || '',
        visitor_phone: data.phone || null,
        organization: data.organization || null,
        purpose_of_visit: data.purpose || 'Walk-in Visit',
        preferred_date: data.visitDate,
        start_time: data.startTime || null,
        end_time: data.endTime || null,
        population_count: parseInt(data.populationCount, 10) || 1,
        additional_notes: additional_notes || null,
        request_letter_files: JSON.stringify(requestFiles),
        status: initialStatus,
        submission_id: submissionId
      };

      await tx.insertRecord('appointments', appointmentData);

      // 6. Promote submission media to appointments entity
      await mediaService.promoteSubmissionMedia(staffId, submissionId, 'appointments', appointmentId, tx);

      // 7. Update form submission status to processed
      await tx.query('UPDATE form_submissions SET status = "processed" WHERE id = ?', [submissionId]);

      // 8. Broadcast event
      const { appEvents } = await import("../utils/eventBus.js");
      appEvents.emit('db_change', { resource: 'Appointment', action: 'create', id: appointmentId });
      appEvents.emit('db_change', { resource: 'AppointmentStatus', action: 'create', id: appointmentId });
      appEvents.emit('db_change', { resource: 'Submission', action: 'update', id: submissionId });

      logger.info(`Pipeline successfully processed appointment form submission ${submissionId} -> appointment ${appointmentId}`);

      return { appointmentId, status: initialStatus };
    });
  },

  /**
   * ADMIN: Reject/Archive Submission
   * H-3 FIX: Use audited update path instead of raw SQL to maintain audit trail.
   */
  async rejectSubmission(submissionId) {
    const { baseService } = await import('./acquisition/baseService.js');
    const [submission] = await db.query('SELECT status FROM form_submissions WHERE id = ?', [submissionId]);
    if (!submission) throw new Error("SUBMISSION_NOT_FOUND");

    assertTransition('submission', submission.status, 'archived');
    const updated = await baseService._updateRecord('system', 'form_submissions', submissionId, { status: 'archived' });
    return { id: submissionId, status: 'archived' };
  },

  /**
   * ADMIN: Reopen/Restore Submission
   * H-3 FIX: Use audited update path instead of raw SQL to maintain audit trail.
   */
  async reopenSubmission(submissionId) {
    const { baseService } = await import('./acquisition/baseService.js');
    const [submission] = await db.query('SELECT status FROM form_submissions WHERE id = ?', [submissionId]);
    if (!submission) throw new Error("SUBMISSION_NOT_FOUND");

    assertTransition('submission', submission.status, 'pending');
    const updated = await baseService._updateRecord('system', 'form_submissions', submissionId, { status: 'pending' });
    return { id: submissionId, status: 'pending' };
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
      const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

      if (existingUser) {
        return { userId: existingUser.id, isNew: false, setupUrl: null };
      }

      const [fname, ...rest] = (name || "Valued Donor").split(" ");
      const lname = rest.join(" ") || "";

      const result = await userService.provisionDonor({ fname, lname, email, ...extras });

      return {
        userId: result.userId,
        isNew: true,
        setupUrl: result.setupUrl,
      };
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
