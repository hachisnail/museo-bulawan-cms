import Joi from 'joi';
import { userService } from "../services/userService.js";
import { env } from "../config/env.js";

// ==========================================
// JOI VALIDATION SCHEMAS
// ==========================================
export const schemas = {
    invite: Joi.object({
        fname: Joi.string().trim().min(1).max(100).required(),
        lname: Joi.string().trim().min(1).max(100).required(),
        email: Joi.string().email().required(),
        role: Joi.string().valid(
            'admin', 'registrar', 'conservator', 'inventory_staff',
            'content_editor', 'content_writer', 'appointment_coordinator', 'guest'
        ).default('guest')
    }),

    updateProfile: Joi.object({
        fname: Joi.string().trim().min(1).max(100).required(),
        lname: Joi.string().trim().min(1).max(100).required()
    }),

    changePassword: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).required()
    }),

    adminUpdateUser: Joi.object({
        fname: Joi.string().trim().min(1).max(100).optional(),
        lname: Joi.string().trim().min(1).max(100).optional(),
        email: Joi.string().email().optional(),
        role: Joi.string().valid(
            'admin', 'registrar', 'conservator', 'inventory_staff',
            'content_editor', 'content_writer', 'appointment_coordinator', 'guest'
        ).optional()
    }).min(1) // At least one field must be provided
};

// ==========================================
// PUBLIC / PRE-AUTH ROUTES
// ==========================================

export const onboardAdmin = async (req, res, next) => {
    try {
        const { fname, lname, email, username, password } = req.body;

        if (!fname || !lname || !email || !username || !password) {
            return res.status(400).json({ error: "All fields are required to initialize the system." });
        }

        await userService.onboardFirstAdmin({ fname, lname, email, username, password });

        res.status(201).json({ message: "System initialized. Master Admin created successfully. You may now log in." });

    } catch (error) {
        next(error);
    }
};

export const completeSetup = async (req, res, next) => {
    try {
        const { token, username, password } = req.body;

        await userService.completeSetup({ token, username, password });

        res.status(200).json({ message: "Account setup complete. You may now log in." });

    } catch (error) {
        next(error);
    }
};

export const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;

        await userService.requestPasswordReset(email);

        // Always return success even if email isn't found (Security Best Practice)
        res.status(200).json({ message: "If that email exists, a reset link has been sent." });

    } catch (error) {
        next(error);
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        await userService.resetPassword({ token, newPassword });

        res.status(200).json({ message: "Password has been successfully reset." });

    } catch (error) {
        next(error);
    }
};

// ==========================================
// SELF-EDIT (Authenticated User)
// ==========================================

export const getMe = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        res.status(200).json({ status: 'success', data: user });
    } catch (error) {
        next(error);
    }
};

export const updateMe = async (req, res, next) => {
    try {
        const { error, value } = schemas.updateProfile.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const updated = await userService.updateProfile(req.user.id, value);

        res.status(200).json({ status: 'success', message: 'Profile updated.', data: updated });
    } catch (error) {
        next(error);
    }
};

export const changeMyPassword = async (req, res, next) => {
    try {
        const { error, value } = schemas.changePassword.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        await userService.changePassword(req.user.id, value);

        res.status(200).json({ status: 'success', message: 'Password changed successfully.' });
    } catch (error) {
        if (error.message === 'INCORRECT_PASSWORD') {
            return res.status(403).json({ error: 'Current password is incorrect.' });
        }
        next(error);
    }
};

// ==========================================
// ADMIN MANAGEMENT
// ==========================================

export const listUsers = async (req, res, next) => {
    try {
        const users = await userService.listUsers();
        res.status(200).json({ status: 'success', data: users });
    } catch (error) {
        next(error);
    }
};

export const inviteUser = async (req, res, next) => {
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
};

export const updateUser = async (req, res, next) => {
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
};

export const deactivateUser = async (req, res, next) => {
    try {
        await userService.deactivateUser(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', message: 'User deactivated.' });
    } catch (error) {
        if (error.message === 'CANNOT_DEACTIVATE_SELF') {
            return res.status(403).json({ error: 'You cannot deactivate your own account.' });
        }
        next(error);
    }
};

export const forceLogoutUser = async (req, res, next) => {
    try {
        await userService.forceLogoutUser(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', message: 'User session terminated.' });
    } catch (error) {
        if (error.message === 'CANNOT_FORCE_LOGOUT_SELF') {
            return res.status(403).json({ error: 'You cannot force logout yourself. Use the normal logout.' });
        }
        next(error);
    }
};

export const resendInvite = async (req, res, next) => {
    try {
        await userService.resendInvite(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', message: 'Invite resent.' });
    } catch (error) {
        if (error.message === 'NOT_AN_INVITED_USER') {
            return res.status(400).json({ error: 'This user is not in an invited state.' });
        }
        next(error);
    }
};