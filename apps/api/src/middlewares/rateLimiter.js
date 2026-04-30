import rateLimit from "express-rate-limit";

const createLimiter = (windowMs, max, errorMessage) =>
  rateLimit({
    windowMs,
    max,
    message: { error: errorMessage },
    standardHeaders: true,
    legacyHeaders: false,
    // Add a key generator to handle auth context if needed
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user?.id || req.ip;
    }
  });

/**
 * Strict limiter for public entry points like login
 */
export const authLimiter = createLimiter(
  15 * 60 * 1000,
  10, // 10 attempts per 15 minutes
  "Too many authentication attempts. Please try again later."
);

/**
 * Public Form Limiter
 */
export const publicFormLimiter = createLimiter(
  60 * 60 * 1000,
  5, // 5 submissions per hour per IP
  "Submission threshold reached. Please try again later."
);

/**
 * Dynamic Global Limiter
 * Lax for logged in users, moderate for public.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    // If the request is authenticated, give them 10,000 requests per window
    if (req.user || req.isAuthenticated?.()) {
      return 10000;
    }
    // Moderate limit for general public API consumption
    return 200;
  },
  message: { error: "API rate limit exceeded. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictActionLimiter = createLimiter(
  60 * 60 * 1000,
  3,
  "Too many requests for this action. Please try again in an hour.",
);
