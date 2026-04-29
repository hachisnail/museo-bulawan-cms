import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import cors from 'cors'; // <-- Missing in your file
import passport from './config/passport.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js'; 
import { csrfProtection } from './middlewares/csrfHandler.js';
import { env } from './config/env.js'; // <-- Missing in your file
import { corsOptions } from './config/cors.js'; // <-- Missing in your file
import { globalLimiter } from './middlewares/rateLimiter.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
    crossOriginResourcePolicy: false,
}));

// Apply CORS options BEFORE routes
app.use(cors(corsOptions));

// Apply global rate limiting
app.use(globalLimiter);

app.use(morgan('dev', {
    stream: { write: (message) => logger.info(message.trim()) }
}));

app.use(express.json({ limit: '64kb' }))
app.use(express.urlencoded({ extended: true })); 

app.use(session({
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

app.use('/api/v1/', routes);

app.use(errorHandler);

export default app;