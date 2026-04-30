import { userService } from '../../services/userService.js';
import { schemas } from './schemas.js';

/**
 * LifecycleController
 * 
 * Handles user onboarding, account setup, and invitations.
 */
export const lifecycleController = {
    async onboardAdmin(req, res, next) {
        try {
            const { fname, lname, email, username, password } = req.body;

            if (!fname || !lname || !email || !username || !password) {
                return res.status(400).json({ error: "All fields are required to initialize the system." });
            }

            await userService.onboardFirstAdmin({ fname, lname, email, username, password });

            res.status(201).json({ 
                message: "System initialized. Master Admin created successfully. You may now log in." 
            });
        } catch (error) { next(error); }
    },

    async completeSetup(req, res, next) {
        try {
            const { token, username, password } = req.body;
            await userService.completeSetup({ token, username, password });

            res.status(200).json({ message: "Account setup complete. You may now log in." });
        } catch (error) { next(error); }
    },

    async inviteUser(req, res, next) {
        try {
            const { error, value } = schemas.invite.validate(req.body);
            if (error) return res.status(400).json({ error: error.details[0].message });

            await userService.inviteUser(value);

            res.status(201).json({ message: "User invited successfully." });
        } catch (error) {
            if (error.message === 'EMAIL_EXISTS') {
                return res.status(409).json({ error: 'A user with this email already exists.' });
            }
            next(error);
        }
    },

    async resendInvite(req, res, next) {
        try {
            await userService.resendInvite(req.user.id, req.params.id);
            res.status(200).json({ status: 'success', message: 'Invite resent.' });
        } catch (error) {
            if (error.message === 'NOT_AN_INVITED_USER') {
                return res.status(400).json({ error: 'This user is not in an invited state.' });
            }
            next(error);
        }
    }
};
