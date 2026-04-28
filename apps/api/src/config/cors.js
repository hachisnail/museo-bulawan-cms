import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const corsOptions = {
    // 1. Dynamic Origin Validation
    origin: (origin, callback) => {
        // Allow requests with no origin (like Postman, curl, or server-to-server calls). 
        // If you want to BLOCK Postman/cURL completely, remove the `!origin` condition.
        if (!origin || env.corsOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Log unauthorized attempts to help debug and catch malicious actors
            logger.warn(`Blocked CORS request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },

    // 2. Strict HTTP Methods
    // Explicitly declare which methods your API accepts. Blocks TRACE, CONNECT, etc.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], 

    // 3. Strict Allowed Headers
    // Only allow these specific headers to be sent from the browser
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With', 
        'Accept',
        'x-user-id',   // Add any custom headers your frontend sends
        'x-user-role' 
    ],

    // 4. Exposed Headers
    // Explicitly allow the browser to read the Set-Cookie header so sessions work
    exposedHeaders: ['Set-Cookie'],

    // 5. Credentials Requirement
    // CRITICAL: Must be true for express-session cookies to be attached to requests
    credentials: true, 

    // 6. Preflight Cache Max Age (Performance Boost)
    // Tells the browser to cache the CORS preflight OPTIONS request for 24 hours.
    // This saves an extra HTTP round-trip on every single API call!
    maxAge: 86400, 

    // 7. Legacy Browser Support
    optionsSuccessStatus: 200 
};