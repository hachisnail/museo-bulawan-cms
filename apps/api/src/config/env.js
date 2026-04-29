import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const minioRequiredStr = Joi.string().when('MINIO_ENABLED', { is: true, then: Joi.required() });

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
    CORS_ORIGINS: Joi.string().default('http://localhost:5173'),  // Comma-separated list for CORS
        // Add this inside envSchema in api/src/config/env.js
    PB_URL: Joi.string().default('http://127.0.0.1:8090'),
    PB_ADMIN_EMAIL: Joi.string().required(),
    PB_ADMIN_PASSWORD: Joi.string().required(),

    // ==========================================
    // NEW: MinIO / S3 Config
    // ==========================================
    MINIO_ENABLED: Joi.boolean().default(false),
    MINIO_ENDPOINT: minioRequiredStr,
    MINIO_BUCKET: minioRequiredStr,
    MINIO_ACCESS_KEY: minioRequiredStr,
    MINIO_SECRET_KEY: minioRequiredStr,
    MINIO_REGION: Joi.string().default('us-east-1'),

    // Redis (optional — used for OTP store in production)
    REDIS_URL: Joi.string().optional().default(''),

}).unknown().required();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
    throw new Error(`Environment Variable Validation Error: ${error.message}`);
}

export const env = {
    isDev: envVars.NODE_ENV === 'development',
    isProd: envVars.NODE_ENV === 'production',
    port: envVars.PORT,
    
    frontendUrl: envVars.FRONTEND_URL, // String
    // Parse the comma-separated string into an array and trim whitespace
    corsOrigins: envVars.CORS_ORIGINS.split(',').map(origin => origin.trim()), 

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
    pb: {
        url: envVars.PB_URL,
        adminEmail: envVars.PB_ADMIN_EMAIL,
        adminPassword: envVars.PB_ADMIN_PASSWORD
    },
    minio: {
        enabled: envVars.MINIO_ENABLED,
        endpoint: envVars.MINIO_ENDPOINT,
        bucket: envVars.MINIO_BUCKET,
        accessKey: envVars.MINIO_ACCESS_KEY,
        secret: envVars.MINIO_SECRET_KEY,
        region: envVars.MINIO_REGION
    },
    redisUrl: envVars.REDIS_URL || ''
};