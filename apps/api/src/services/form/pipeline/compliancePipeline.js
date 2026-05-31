import { mediaService } from "../../mediaService.js";
import { acquisitionService } from "../../acquisitionService.js";
import { logger } from "../../../utils/logger.js";
import { db } from "../../../config/db.js";

/**
 * CompliancePipeline
 * 
 * Handles form-driven workflows for artifact health reports and movement trails.
 */
export const compliancePipeline = {
    /**
     * Processes an Artifact Health Form submission.
     */
    async processHealthReportForm(staffId, submissionId, files, helpers) {
        return helpers._executeFormWorkflow(
            submissionId,
            "processHealthReportForm",
            async (data) => {
                const { artifact_id, condition, detailed_notes, reporter, stability, hazards, immediate_action_required } = data;

                let reporterName = reporter?.trim() || (await helpers._resolveReporterName(staffId)) || "System";

                // Resolve entity type dynamically based on where the artifact_id is located.
                let entityType = "inventory";
                const [accessionRows] = await db.query("SELECT id FROM accessions WHERE id = ?", [artifact_id]);
                if (accessionRows && accessionRows.length > 0) {
                    entityType = "accession";
                }

                const report = await acquisitionService.createConditionReport(
                    staffId, entityType, artifact_id, condition, detailed_notes, submissionId, reporterName,
                    { stability, hazards, immediate_action_required }
                );

                if (files?.length > 0) {
                    await mediaService.attachMedia(staffId, "condition_reports", report.id, files, "Health Report Evidence");
                }

                return report;
            }
        );
    },

    /**
     * Processes an Artifact Movement Trail Form submission.
     */
    async processMovementTrailForm(staffId, submissionId, files, helpers) {
        return helpers._executeFormWorkflow(
            submissionId,
            "processMovementTrailForm",
            async (data) => {
                const { artifact_id, to_location, reason, moved_by, movement_type, handling_notes } = data;
                const compiledReason = `${reason}\n\nMoved by: ${moved_by || "Unknown"}`;

                return await acquisitionService.transferLocation(
                    staffId, artifact_id, to_location, compiledReason, submissionId,
                    { movement_type, handling_notes }
                );
            }
        );
    },

    /**
     * Processes an Artifact Conservation Log Form submission.
     */
    async processConservationLogForm(staffId, submissionId, files, helpers) {
        return helpers._executeFormWorkflow(
            submissionId,
            "processConservationLogForm",
            async (data) => {
                const { artifact_id, treatment, findings, recommendations, conservator_name, treatment_objective, next_review_date } = data;

                return await acquisitionService.createConservationLog(
                    staffId, artifact_id, treatment, findings, recommendations, submissionId,
                    { conservator_name, treatment_objective, next_review_date }
                );
            }
        );
    }
};
