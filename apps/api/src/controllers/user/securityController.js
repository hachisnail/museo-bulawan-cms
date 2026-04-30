import { userService } from '../../services/userService.js';
import { schemas } from './schemas.js';

/**
 * SecurityController
 * 
 * Handles password changes and reset requests.
 */
export const securityController = {
    async changeMyPassword(req, res, next) {
        try {
            const { error, value } = schemas.changePassword.validate(req.body);
            if (error) return res.status(400).json({ error: error.details[0].message });

            await userService.changePassword(req.user.id, value);

            res.status(200).json({ 
                status: 'success', 
                message: 'Password changed successfully.' 
            });
        } catch (error) {
            if (error.message === 'INCORRECT_PASSWORD') {
                return res.status(403).json({ error: 'Current password is incorrect.' });
            }
            next(error);
        }
    },

    async requestPasswordReset(req, res, next) {
        try {
            const { email } = req.body;
            await userService.requestPasswordReset(email);

            // Always return success even if email isn't found (Security Best Practice)
            res.status(200).json({ 
                message: "If that email exists, a reset link has been sent." 
            });
        } catch (error) { next(error); }
    },

    async resetPassword(req, res, next) {
        try {
            const { token, newPassword } = req.body;
            await userService.resetPassword({ token, newPassword });

            res.status(200).json({ message: "Password has been successfully reset." });
        } catch (error) { next(error); }
    }
};
