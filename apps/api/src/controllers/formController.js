import { submissionController } from './form/submissionController.js';
import { queryController } from './form/queryController.js';
import { schemas } from './form/schemas.js';

/**
 * FormController Facade
 * 
 * Provides a unified entry point for all form-related operations.
 * Delegates to specialized sub-controllers while maintaining backward compatibility.
 * 
 * Domain breakdown:
 * - Submission: Public actions (definition, OTP, submitting).
 * - Query: Staff actions (listing, detailed view).
 */
export const formController = {
    // ==========================================
    // VALIDATION SCHEMAS
    // ==========================================
    schemas,

    // ==========================================
    // PUBLIC ACTIONS
    // ==========================================
    getFormDefinition: submissionController.getFormDefinition.bind(submissionController),
    requestOtp: submissionController.requestOtp.bind(submissionController),
    verifyOtp: submissionController.verifyOtp.bind(submissionController),
    submitForm: submissionController.submitForm.bind(submissionController),

    // ==========================================
    // STAFF ACTIONS
    // ==========================================
    listSubmissions: queryController.listSubmissions.bind(queryController),
    listAllSubmissions: queryController.listAllSubmissions.bind(queryController),
    getSubmission: queryController.getSubmission.bind(queryController)
};

// Re-export schemas for route-level validation
export { schemas };