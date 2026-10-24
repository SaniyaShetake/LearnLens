const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const config = require("../config");

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const createLimiter = ({ max, message, skipSuccessfulRequests = false, keyGenerator }) =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: max,
    skipSuccessfulRequests,
    ...(keyGenerator ? { keyGenerator } : {}),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.rateLimit.disabled,
    message: { success: false, message },
  });

const authMessage = "Too many attempts, please try again later.";
const forgotMessage = "Too many password reset requests, please try again later.";
const joinMessage = "Too many invalid join codes, please try again later.";

// Each export is a separate limiter (separate counter per IP).
// Sign in: 20 failed attempts per 15 minutes per IP (successful logins are not counted, so a
// classroom behind one NAT IP can still sign in).
const signinLimiter = () => createLimiter({ max: 20, message: authMessage, skipSuccessfulRequests: true });
// Sign up: 20 requests per 15 minutes per IP
const signupLimiter = () => createLimiter({ max: 20, message: authMessage });

// Key for per-account limits: client IP + the (normalized) email being tried
const ipAndEmailKey = (req) => {
  const email = req.body && typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  // ipKeyGenerator groups IPv6 addresses by /56 subnet (express-rate-limit v7+ requirement for custom keys)
  return `${ipKeyGenerator(req.ip)}|${email}`;
};

// Student sign in: a whole class shares one NAT IP, so failures are counted per (IP + email)
// (20 failed attempts / 15 min per account) plus a generous per-IP ceiling (300 failed / 15 min).
// Successful logins are not counted by either. Returns an array of middlewares.
const studentSigninLimiter = ({ perAccountMax = 20, perIpMax = 300 } = {}) => [
  createLimiter({ max: perIpMax, message: authMessage, skipSuccessfulRequests: true }),
  createLimiter({ max: perAccountMax, message: authMessage, skipSuccessfulRequests: true, keyGenerator: ipAndEmailKey }),
];

// A whole class often signs up from one campus IP (NAT), so student sign-up gets a much higher ceiling
const studentSignupLimiter = () => createLimiter({ max: 300, message: authMessage });
// Forgot password: 5 requests per 15 minutes per IP
const forgotPasswordLimiter = () => createLimiter({ max: 5, message: forgotMessage });

// Join course (runs after student auth): wrong join codes are counted per student account
// (20 / 15 min) plus a per-IP ceiling (300 / 15 min, a class shares one NAT IP), so codes can't be
// guessed by brute force. Successful joins are not counted. Returns an array of middlewares.
const joinCourseLimiter = ({ perAccountMax = 20, perIpMax = 300 } = {}) => [
  createLimiter({ max: perIpMax, message: joinMessage, skipSuccessfulRequests: true }),
  createLimiter({
    max: perAccountMax,
    message: joinMessage,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `student|${req.user && req.user._id}`,
  }),
];

// Drive video streaming: players send a request per seek/buffer refill, and a class shares one NAT
// IP, so the ceiling is high (3000 requests / 15 min per IP); it only stops runaway clients.
const videoStreamLimiter = () => createLimiter({ max: 3000, message: "Too many video requests, please try again later." });

module.exports = {
  createLimiter,
  signinLimiter,
  signupLimiter,
  studentSigninLimiter,
  studentSignupLimiter,
  forgotPasswordLimiter,
  joinCourseLimiter,
  videoStreamLimiter,
};
