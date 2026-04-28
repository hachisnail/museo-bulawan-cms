import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// 1. Define the custom format for our logs
const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    // If it's an error with a stack trace, print the stack. Otherwise, print the message.
    let logMessage = `${timestamp} [${level}]: ${stack || message}`;
    
    // If we passed extra metadata (like user IDs or CRUD actions), append it
    if (Object.keys(meta).length) {
        logMessage += ` | Meta: ${JSON.stringify(meta)}`;
    }
    return logMessage;
});

// 2. Create the Winston instance
export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        errors({ stack: true }), // Automatically capture stack traces
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports: [
        // Write all logs with level 'error' and below to `error.log`
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        // Write all logs with level 'info' and below to `combined.log`
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// 3. If we're not in production, also log to the console with colors
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: combine(
            colorize({ all: true }), // Add colors to console output
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            customFormat
        )
    }));
}