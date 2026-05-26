import { defineAbilityFor } from '../config/ability.js';
import { subject } from '@casl/ability';

export const buildAbility = async (req, res, next) => {
    try {
        if (!req.user) {
            req.ability = defineAbilityFor({ role: 'visitor' });
            return next();
        } 

        // SECURITY CHECK: Enforce Single Instance
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
    // Normalize casing to prevent staff with capitalized roles from failing the check
    const role = String(req.user?.role || '').toLowerCase().trim();
    
    if (!req.user || role === 'visitor' || role === 'donor') {
        return res.status(401).json({ 
            error: "Unauthorized", 
            message: "You must be logged in as staff to access this resource." 
        });
    }

    next();
};

export const requireVisitorAuth = (req, res, next) => {
    const role = String(req.user?.role || '').toLowerCase().trim();
    
    if (!req.user || (role !== 'donor' && role !== 'visitor')) {
        return res.status(401).json({ 
            error: "Unauthorized", 
            message: "You must be logged in as a donor/visitor to access this resource." 
        });
    }
    next();
};

export { subject };