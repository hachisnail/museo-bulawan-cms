import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
    // Determine the status code based on custom error names, or default to 500
    let statusCode = err.status || 500;
    let errorCode = err.message || 'INTERNAL_SERVER_ERROR';

    // Map business logic errors to HTTP codes
    if (['ALREADY_ONBOARDED', 'EMAIL_EXISTS', 'USERNAME_TAKEN', 'INVALID_TOKEN'].includes(err.message)) {
        statusCode = 400;
    }

    // 1. Log the error with Winston
    logger.error(`HTTP ${statusCode} - ${errorCode}`, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        user: req.user ? req.user.id : 'Guest', // Log who caused the error
        stack: err.stack // Winston will format this nicely
    });

    // 2. Send the sanitized response to the client
    res.status(statusCode).json({
        error: errorCode,
        message: statusCode === 500 ? "An unexpected error occurred." : err.message
    });
};