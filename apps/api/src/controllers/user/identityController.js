import { userService } from '../../services/userService.js';
import { schemas } from './schemas.js';

/**
 * IdentityController
 * 
 * Handles user profile retrieval and updates.
 */
export const identityController = {
    async getMe(req, res, next) {
        try {
            const user = await userService.getUserById(req.user.id);
            if (!user) return res.status(404).json({ error: 'User not found.' });

            res.status(200).json({ status: 'success', data: user });
        } catch (error) { next(error); }
    },

    async updateMe(req, res, next) {
        try {
            const { error, value } = schemas.updateProfile.validate(req.body);
            if (error) return res.status(400).json({ error: error.details[0].message });

            const updated = await userService.updateProfile(req.user.id, value);

            res.status(200).json({ 
                status: 'success', 
                message: 'Profile updated.', 
                data: updated 
            });
        } catch (error) { next(error); }
    },

    async listUsers(req, res, next) {
        try {
            const users = await userService.listUsers();
            res.status(200).json({ status: 'success', data: users });
        } catch (error) { next(error); }
    }
};
