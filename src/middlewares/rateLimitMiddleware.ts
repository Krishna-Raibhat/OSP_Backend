import rateLimit from "express-rate-limit";

// Rate limiting for contact form to prevent spam
export const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 contact requests per windowMs
  message: {
    message: "Too many contact requests from this IP. Please try again in 15 minutes.",
    error: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests from rate limiting
  skipSuccessfulRequests: false,
  // Skip failed requests from rate limiting  
  skipFailedRequests: true,
});

// General API rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    message: "Too many requests from this IP. Please try again later.",
    error: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});