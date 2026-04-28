import rateLimit from "express-rate-limit";

const createLimiter = (windowMs, max, errorMessage) =>
  rateLimit({
    windowMs,
    max,
    message: { error: errorMessage },
    standardHeaders: true,
    legacyHeaders: false,
  });

export const globalLimiter = createLimiter(
  15 * 60 * 1000,
  100,
  "Too many requests from this IP, please try again after 15 minutes.",
);
export const authLimiter = createLimiter(
  15 * 60 * 1000,
  5,
  "Too many login attempts from this IP, please try again after 15 minutes.",
);
export const strictActionLimiter = createLimiter(
  60 * 60 * 1000,
  3,
  "Too many requests for this action. Please try again in an hour.",
);
