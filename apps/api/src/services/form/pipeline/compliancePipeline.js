import { pbService } from "../../pocketbaseService.js";
import { acquisitionService } from "../../acquisitionService.js";
import { logger } from "../../../utils/logger.js";

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
                const { artifact_id, condition, detailed_notes, reporter } = data;

                let reporterName = reporter?.trim() || (await helpers._resolveReporterName(staffId)) || "System";

                const report = await acquisitionService.createConditionReport(
                    staffId, "inventory", artifact_id, condition, detailed_notes, submissionId, reporterName
                );

                if (files?.length > 0) {
                    await pbService.uploadToField("condition_reports", report.id, "attachments", files);
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
                const { artifact_id, to_location, reason, moved_by } = data;
                const compiledReason = `${reason}\n\nMoved by: ${moved_by || "Unknown"}`;

                return await acquisitionService.transferLocation(
                    staffId, artifact_id, to_location, compiledReason, submissionId
                );
            }
        );
    }
};
