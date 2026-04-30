import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const csrfProtection = (req, res, next) => {
    // 1. Generate CSRF token for the session if it doesn't exist
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }

    // 2. Set the cookie so the frontend (like Axios) can automatically read and send it
    res.cookie('XSRF-TOKEN', req.session.csrfToken, {
        sameSite: env.isProd ? 'none' : 'lax',
        secure: env.isProd,
        httpOnly: false // MUST be false so client-side JS can read it
    });

    // 3. Skip validation for safe methods (read-only)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // 4. Exempt certain public entry points that might not have a session/cookie yet
    const path = req.originalUrl.split('?')[0];
    const exemptPaths = [
        '/api/v1/auth/login',
        '/api/v1/user/onboard',
        '/api/v1/user/setup',
        '/api/v1/user/forgot-password',
        '/api/v1/user/reset-password'
    ];

    // Public Form Regex: /api/v1/forms/:slug/(request-otp|verify-otp|submit)
    const publicFormRegex = /^\/api\/v1\/forms\/[^/]+\/(request-otp|verify-otp|submit)$/;

    if (exemptPaths.includes(path) || publicFormRegex.test(path)) {
        return next();
    }

    // 5. Validate CSRF token for all other unsafe methods (POST, PUT, PATCH, DELETE)
    const tokenFromHeader = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];
    
    if (!tokenFromHeader || tokenFromHeader !== req.session.csrfToken) {
        logger.warn('CSRF validation failed', {
            ip: req.ip,
            url: req.originalUrl,
            user: req.user ? req.user.id : 'Guest'
        });
        return res.status(403).json({ error: 'CSRF token missing or invalid.' });
    }

    next();
};
