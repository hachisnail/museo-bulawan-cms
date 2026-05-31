import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import cors from 'cors';
import passport from './config/passport.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js'; 
import { csrfProtection } from './middlewares/csrfHandler.js';
import { env } from './config/env.js';
import { corsOptions } from './config/cors.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import { redisManager } from './utils/redisClient.js';

// 0. GLOBAL FIX: Enable BigInt serialization for JSON responses (MariaDB BIGINT support)
BigInt.prototype.toJSON = function() { return this.toString() };

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
    crossOriginResourcePolicy: false,
}));

// Apply CORS options BEFORE routes
app.use(cors(corsOptions));

// Middleware setup...

app.use(morgan('dev', {
    stream: { write: (message) => logger.info(message.trim()) }
}));

app.use(express.json({ limit: '64kb' }))
app.use(express.urlencoded({ extended: true })); 

let sessionStore = undefined;

if (env.isProd && env.redisUrl) {
    try {
        const redisClient = await redisManager.getClient();
        sessionStore = new RedisStore({
            client: redisClient,
            prefix: "sess:"
        });
        logger.info("Using Redis Session Store for production sessions.");
    } catch (redisErr) {
        logger.error(`Failed to initialize Redis session store: ${redisErr.message}. Falling back to memory store.`);
    }
}

app.use(session({
    store: sessionStore,
    secret: env.security.sessionSecret, 
    resave: false,
    saveUninitialized: false, 
    cookie: {
        // In production (cross-domain), SameSite MUST be 'none' and Secure MUST be true.
        // In development (localhost), 'lax' and false are required because you don't have HTTPS.
        sameSite: env.isProd ? 'none' : 'lax', 
        secure: env.isProd, 
        httpOnly: true, // Prevents JavaScript from reading the cookie (XSS protection)
        maxAge: 1000 * 60 * 60 * 8 
    }
}));

// Apply CSRF protection immediately after session is established
app.use(csrfProtection);

app.use(passport.initialize());
app.use(passport.session());

// Apply dynamic global rate limiting (lax for logged in users)
app.use(globalLimiter);

app.use('/api/v1/', routes);

app.use(errorHandler);

export default app;