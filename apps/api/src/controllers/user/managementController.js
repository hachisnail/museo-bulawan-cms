import { userService } from '../../services/userService.js';
import { schemas } from './schemas.js';

/**
 * ManagementController
 * 
 * Handles administrative actions like updating, deactivating, and force-logging out users.
 */
export const managementController = {
    async updateUser(req, res, next) {
        try {
            const { error, value } = schemas.adminUpdateUser.validate(req.body);
            if (error) return res.status(400).json({ error: error.details[0].message });

            const updated = await userService.updateUserById(req.user.id, req.params.id, value);

            res.status(200).json({ status: 'success', message: 'User updated.', data: updated });
        } catch (error) {
            if (error.message === 'CANNOT_CHANGE_OWN_ROLE') {
                return res.status(403).json({ error: 'You cannot change your own role.' });
            }
            next(error);
        }
    },

    async deactivateUser(req, res, next) {
        try {
            await userService.deactivateUser(req.user.id, req.params.id);
            res.status(200).json({ status: 'success', message: 'User deactivated.' });
        } catch (error) {
            if (error.message === 'CANNOT_DEACTIVATE_SELF') {
                return res.status(403).json({ error: 'You cannot deactivate your own account.' });
            }
            next(error);
        }
    },

    async forceLogoutUser(req, res, next) {
        try {
            await userService.forceLogoutUser(req.user.id, req.params.id);
            res.status(200).json({ status: 'success', message: 'User session terminated.' });
        } catch (error) {
            if (error.message === 'CANNOT_FORCE_LOGOUT_SELF') {
                return res.status(403).json({ 
                    error: 'You cannot force logout yourself. Use the normal logout.' 
                });
            }
            next(error);
        }
    }
};
