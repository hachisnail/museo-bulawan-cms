import rateLimit from 'express-rate-limit';

// 1. General API Limiter 
// Applies to most routes (100 requests per 15 minutes)
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// 2. Strict Limiter for Authentication 
// Prevents brute-force credential stuffing (5 attempts per 15 minutes)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, 
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// 3. Email & Critical Action Limiter 
// Prevents email spam via forgot-password or invite routes (3 attempts per hour)
export const strictActionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, 
    message: { error: 'Too many requests for this action. Please try again in an hour.' },
    standardHeaders: true,
    legacyHeaders: false,
});