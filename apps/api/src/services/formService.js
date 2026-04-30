import { definitionService } from './form/definitionService.js';
import { verificationService } from './form/verificationService.js';
import { submissionService } from './form/submissionService.js';
import { queryService } from './form/queryService.js';

/**
 * FormService Facade
 * 
 * Provides a unified entry point for all form-related operations.
 * Delegates to specialized sub-services while maintaining backward compatibility.
 * 
 * Domain breakdown:
 * - Definition: Fetching and configuration of forms.
 * - Verification: OTP flows for email identity.
 * - Submission: Public processing and validation.
 * - Query: Staff-facing listing and detail views.
 */
export const formService = {
    // ==========================================
    // DEFINITIONS
    // ==========================================
    getFormDefinition: definitionService.getFormDefinition.bind(definitionService),

    // ==========================================
    // OTP VERIFICATION
    // ==========================================
    requestEmailOtp: verificationService.requestEmailOtp.bind(verificationService),
    verifyOtp: verificationService.verifyOtp.bind(verificationService),

    // ==========================================
    // SUBMISSIONS
    // ==========================================
    submitForm: submissionService.submitForm.bind(submissionService),
    _buildFingerprint: submissionService._buildFingerprint.bind(submissionService),

    // ==========================================
    // QUERIES (STAFF)
    // ==========================================
    listSubmissions: queryService.listSubmissions.bind(queryService),
    listAllSubmissions: queryService.listAllSubmissions.bind(queryService),
    getSubmission: queryService.getSubmission.bind(queryService),
    getSubmissionItems: queryService.getSubmissionItems.bind(queryService)
};