import Joi from 'joi';

/**
 * User Validation Schemas
 * 
 * Centralized schemas for user invitations, updates, and credential management.
 */
export const schemas = {
    invite: Joi.object({
        fname: Joi.string().trim().min(1).max(100).required(),
        lname: Joi.string().trim().min(1).max(100).required(),
        email: Joi.string().email().required(),
        role: Joi.string().valid(
            'admin', 'curator', 'registrar', 'conservator', 'inventory_staff',
            'content_editor', 'content_writer', 'appointment_coordinator', 'donor', 'visitor'
        ).default('visitor')
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
        phone: Joi.string().trim().max(50).optional().allow(null, ''),
        address: Joi.string().trim().max(1000).optional().allow(null, ''),
        title: Joi.string().trim().max(100).optional().allow(null, ''),
        role: Joi.string().valid(
            'admin', 'curator', 'registrar', 'conservator', 'inventory_staff',
            'content_editor', 'content_writer', 'appointment_coordinator', 'donor', 'visitor'
        ).optional()
    }).min(1)
};
