import { logger } from '../utils/logger.js';

const errorMessages = {
    'ALREADY_ONBOARDED': { status: 403, message: 'Forbidden: The system has already been initialized.' },
    'EMAIL_EXISTS': { status: 409, message: 'Email is already registered.' },
    'USERNAME_TAKEN': { status: 409, message: 'Username is already taken.' },
    'INVALID_TOKEN': { status: 400, message: 'Invalid or expired token.' },
    'USER_NOT_FOUND': { status: 404, message: 'User not found.' },
    'INCORRECT_PASSWORD': { status: 403, message: 'Current password is incorrect.' },
    'CANNOT_CHANGE_OWN_ROLE': { status: 403, message: 'You cannot change your own role.' },
    'CANNOT_DEACTIVATE_SELF': { status: 403, message: 'You cannot deactivate your own account.' },
    'CANNOT_FORCE_LOGOUT_SELF': { status: 403, message: 'You cannot force logout yourself.' },
    'NOT_AN_INVITED_USER': { status: 400, message: 'This user is not in an invited state.' },
    'NO_FIELDS_TO_UPDATE': { status: 400, message: 'No fields provided to update.' },
    'FORM_NOT_FOUND': { status: 404, message: 'Form definition not found.' },
    'OTP_EXPIRED_OR_NOT_FOUND': { status: 400, message: 'OTP not found or expired. Please request a new one.' },
    'OTP_EXPIRED': { status: 400, message: 'OTP has expired.' },
    'INVALID_OTP': { status: 400, message: 'Invalid OTP.' },
    'EMAIL_AND_OTP_REQUIRED': { status: 400, message: 'Email and OTP are required.' }
};

export const errorHandler = (err, req, res, next) => {
    // Determine the status code based on custom error names, or default to 500
    let statusCode = err.status || 500;
    let errorCode = err.message || 'INTERNAL_SERVER_ERROR';
    let errorMessage = statusCode === 500 ? "An unexpected error occurred." : err.message;

    // Map business logic errors to HTTP codes and friendly messages
    if (errorMessages[err.message]) {
        statusCode = errorMessages[err.message].status;
        errorMessage = errorMessages[err.message].message;
    } else if (err.message?.startsWith('PASSWORD_TOO_WEAK:')) {
        statusCode = 400;
        errorMessage = err.message.split(': ').slice(1).join(': ');
        errorCode = 'PASSWORD_TOO_WEAK';
    } else if (err.message?.startsWith('VALIDATION_FAILED:')) {
        statusCode = 400;
        errorMessage = err.message.split(': ').slice(1).join(': ');
        errorCode = 'VALIDATION_FAILED';
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
        message: errorMessage
    });
};