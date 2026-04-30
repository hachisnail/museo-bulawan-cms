import { identityService } from './user/identityService.js';
import { securityService } from './user/securityService.js';
import { lifecycleService } from './user/lifecycleService.js';
import { managementService } from './user/managementService.js';

/**
 * UserService Facade
 * 
 * Provides a unified entry point for all user-related operations.
 * Delegates to specialized sub-services while maintaining backward compatibility.
 * 
 * Domain breakdown:
 * - Identity: User fetching, listing, and profile updates.
 * - Security: Passwords, resets, and validation.
 * - Lifecycle: Onboarding, invitations, and setup flows.
 * - Management: Admin-level actions and session control.
 */
export const userService = {
    // ==========================================
    // IDENTITY & PROFILE
    // ==========================================
    getUserById: identityService.getUserById.bind(identityService),
    getUserByUsername: identityService.getUserByUsername.bind(identityService),
    listUsers: identityService.listUsers.bind(identityService),
    updateProfile: identityService.updateProfile.bind(identityService),

    // ==========================================
    // SECURITY & PASSWORDS
    // ==========================================
    validatePasswordStrength: securityService.validatePasswordStrength.bind(securityService),
    requestPasswordReset: securityService.requestPasswordReset.bind(securityService),
    resetPassword: securityService.resetPassword.bind(securityService),
    changePassword: securityService.changePassword.bind(securityService),

    // ==========================================
    // LIFECYCLE & ONBOARDING
    // ==========================================
    hasAnyUsers: lifecycleService.hasAnyUsers.bind(lifecycleService),
    onboardFirstAdmin: lifecycleService.onboardFirstAdmin.bind(lifecycleService),
    inviteUser: lifecycleService.inviteUser.bind(lifecycleService),
    resendInvite: lifecycleService.resendInvite.bind(lifecycleService),
    provisionDonor: lifecycleService.provisionDonor.bind(lifecycleService),
    completeSetup: lifecycleService.completeSetup.bind(lifecycleService),

    // ==========================================
    // MANAGEMENT (ADMIN)
    // ==========================================
    updateUserById: managementService.updateUserById.bind(managementService),
    deactivateUser: managementService.deactivateUser.bind(managementService),
    forceLogoutUser: managementService.forceLogoutUser.bind(managementService)
};