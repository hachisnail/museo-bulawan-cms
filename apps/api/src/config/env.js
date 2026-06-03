import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();



const envSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    
    // Database Config
    DB_HOST: Joi.string().default('localhost'),
    DB_USER: Joi.string().default('root'),
    DB_PASS: Joi.string().allow('').default(''),
    DB_NAME: Joi.string().default('scratch'), 
    
    // Security
    SESSION_SECRET: Joi.string().required().messages({
        'any.required': 'SESSION_SECRET is required in your .env file!'
    }),
    
    // Mailer Config 
    SMTP_HOST: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
    SMTP_PORT: Joi.number().when('NODE_ENV', { is: 'production', then: Joi.required() }),
    SMTP_USER: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
    SMTP_PASS: Joi.string().when('NODE_ENV', { is: 'production', then: Joi.required() }),
    EMAIL_FROM: Joi.string().default('noreply@museum.com'),

    // App & CORS Config
    FRONTEND_URL: Joi.string().default('http://localhost:5173'), // Used for email links
    ADMIN_PANEL_URL: Joi.string().default('http://localhost:3001'), // Staff management panel
    VISITOR_PORTAL_URL: Joi.string().default('http://localhost:4321'), // Donor/visitor portal
    CORS_ORIGINS: Joi.string().default('http://localhost:5173'),  // Comma-separated list for CORS
    COOKIE_DOMAIN: Joi.string().optional().allow(''),


    // ==========================================
    // File Storage Config
    // ==========================================
    UPLOAD_DIR: Joi.string().default('./uploads'),

    // Redis (optional — used for OTP store in production)
    REDIS_URL: Joi.string().allow('').optional().default(''),

}).unknown().required();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
    throw new Error(`Environment Variable Validation Error: ${error.message}`);
}

export const env = {
    isDev: envVars.NODE_ENV === 'development',
    isProd: envVars.NODE_ENV === 'production',
    port: envVars.PORT,
    
    frontendUrl: envVars.FRONTEND_URL,
    adminPanelUrl: envVars.ADMIN_PANEL_URL,
    visitorPortalUrl: envVars.VISITOR_PORTAL_URL,
    // Parse the comma-separated string into an array and trim whitespace
    corsOrigins: envVars.CORS_ORIGINS.split(',').map(origin => origin.trim()),
    cookieDomain: envVars.COOKIE_DOMAIN || undefined,

    db: {
        host: envVars.DB_HOST,
        user: envVars.DB_USER,
        pass: envVars.DB_PASS,
        name: envVars.DB_NAME
    },
    security: {
        sessionSecret: envVars.SESSION_SECRET
    },
    mail: {
        host: envVars.SMTP_HOST,
        port: envVars.SMTP_PORT,
        user: envVars.SMTP_USER,
        pass: envVars.SMTP_PASS,
        from: envVars.EMAIL_FROM
    },

    uploadDir: envVars.UPLOAD_DIR,
    redisUrl: envVars.REDIS_URL || ''
};