import rateLimit from "express-rate-limit";

// Express-rate-limit 7+ requires us to use their internal IP generator 
// or it throws an ERR_ERL_KEY_GEN_IPV6 warning.
const defaultIpGenerator = (req, res) => req.ip || req.connection?.remoteAddress || 'unknown-ip';

const createLimiter = (windowMs, max, errorMessage) =>
  rateLimit({
    windowMs,
    max,
    message: { error: errorMessage },
    standardHeaders: true,
    legacyHeaders: false,
    
    // The keyGenerator now wraps the user ID or falls back safely
    keyGenerator: (req, res) => {
      if (req.user && req.user.id) {
          return req.user.id;
      }
      return defaultIpGenerator(req, res);
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
  keyGenerator: (req, res) => {
    if (req.user && req.user.id) {
        return req.user.id;
    }
    return defaultIpGenerator(req, res);
  }
});

export const strictActionLimiter = createLimiter(
  60 * 60 * 1000,
  3,
  "Too many requests for this action. Please try again in an hour."
);