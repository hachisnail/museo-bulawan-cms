import { defineAbilityFor } from '../config/ability.js';
import { subject } from '@casl/ability';

export const buildAbility = async (req, res, next) => {
    try {
        if (!req.user) {
            req.ability = defineAbilityFor({ role: 'guest' });
            return next();
        } 

        // ==========================================
        // SECURITY CHECK: Enforce Single Instance
        // ==========================================
        // If the session ID in their cookie doesn't match the active one in the DB,
        // it means they were kicked out by a newer login.
        if (req.session.loginInstanceId !== req.user.current_session_id) {
            return req.logout((err) => {
                req.session.destroy(() => {
                    res.clearCookie('connect.sid');
                    res.status(401).json({ 
                        error: "Session expired. You logged in from another device." 
                    });
                });
            });
        }

        req.ability = defineAbilityFor(req.user);
        next();
    } catch (error) {
        next(error);
    }
};

export const checkPermission = (action, resource) => {
    return (req, res, next) => {
        if (req.ability.cannot(action, resource)) {
            return res.status(403).json({ 
                error: `Forbidden: You do not have permission to ${action} ${resource}` 
            });
        }
        next();
    };
};

export const requireAuth = (req, res, next) => {
    // Check if the user object exists and isn't a guest
    if (!req.user || req.user.role === 'guest') {
        return res.status(401).json({ 
            error: "Unauthorized", 
            message: "You must be logged in to access this resource." 
        });
    }

    // If they are valid, proceed to the next function (the controller)
    next();
};

export { subject };