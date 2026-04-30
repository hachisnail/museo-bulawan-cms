import { identityController } from './user/identityController.js';
import { securityController } from './user/securityController.js';
import { lifecycleController } from './user/lifecycleController.js';
import { managementController } from './user/managementController.js';
import { schemas } from './user/schemas.js';

/**
 * UserController Facade
 * 
 * Provides a unified entry point for all user-related operations.
 * Delegates to specialized sub-controllers while maintaining backward compatibility.
 * 
 * Domain breakdown:
 * - Identity: Profile retrieval and updates.
 * - Security: Password changes and reset flows.
 * - Lifecycle: Onboarding, invitations, and setup.
 * - Management: Admin actions (role updates, deactivation).
 */
export const userController = {
    // ==========================================
    // VALIDATION SCHEMAS
    // ==========================================
    schemas,

    // ==========================================
    // PUBLIC / PRE-AUTH
    // ==========================================
    onboardAdmin: lifecycleController.onboardAdmin.bind(lifecycleController),
    completeSetup: lifecycleController.completeSetup.bind(lifecycleController),
    requestPasswordReset: securityController.requestPasswordReset.bind(securityController),
    resetPassword: securityController.resetPassword.bind(securityController),

    // ==========================================
    // SELF-EDIT (AUTHENTICATED)
    // ==========================================
    getMe: identityController.getMe.bind(identityController),
    updateMe: identityController.updateMe.bind(identityController),
    changeMyPassword: securityController.changeMyPassword.bind(securityController),

    // ==========================================
    // ADMIN MANAGEMENT
    // ==========================================
    listUsers: identityController.listUsers.bind(identityController),
    inviteUser: lifecycleController.inviteUser.bind(lifecycleController),
    resendInvite: lifecycleController.resendInvite.bind(lifecycleController),
    updateUser: managementController.updateUser.bind(managementController),
    deactivateUser: managementController.deactivateUser.bind(managementController),
    forceLogoutUser: managementController.forceLogoutUser.bind(managementController)
};

// Re-export schemas for route-level validation if necessary
export { schemas };