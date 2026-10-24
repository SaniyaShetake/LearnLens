// Minimal CSRF protection for the server-rendered password reset forms (replaces the archived
// `csurf` package; same cookie name, form field and 403 behaviour).
//
// A random secret lives in an httpOnly, SameSite=Lax cookie (`_csrf`). The form carries a token
// derived from that secret with an HMAC keyed by SESSION_SECRET, so a forged form cannot produce a
// valid token without both reading the victim's cookie and knowing the server key. Unsafe requests
// must present a token (body field `_csrf` or `X-CSRF-Token` header) matching the cookie's secret;
// the comparison is constant-time.
const crypto = require("crypto");
const createError = require("http-errors");
const config = require("../config");
const { cookieOptions } = require("../handlers/misc");

const COOKIE_NAME = "_csrf";
const FIELD_NAME = "_csrf";
const HEADER_NAME = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

const newSecret = () => crypto.randomBytes(32).toString("base64url");

const tokenFor = (secret) => crypto.createHmac("sha256", config.session.secret).update("csrf:" + secret).digest("base64url");

const tokensMatch = (submitted, expected) => {
  if (typeof submitted !== "string") return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const csrfError = () => {
  const error = createError(403, "invalid csrf token");
  error.code = "EBADCSRFTOKEN";
  return error;
};

/**
 * Express middleware. Requires cookie-parser and a body parser (urlencoded) to run first.
 * Adds `req.csrfToken()` for rendering the hidden form field.
 */
const csrfProtection = (req, res, next) => {
  let secret = req.cookies && req.cookies[COOKIE_NAME];
  const hasValidSecret = typeof secret === "string" && SECRET_PATTERN.test(secret);

  if (SAFE_METHODS.has(req.method)) {
    if (!hasValidSecret) {
      secret = newSecret();
      res.cookie(COOKIE_NAME, secret, cookieOptions());
    }
    req.csrfToken = () => tokenFor(secret);
    return next();
  }

  if (!hasValidSecret) return next(csrfError());
  const submitted = (req.body && req.body[FIELD_NAME]) || req.get(HEADER_NAME);
  if (!tokensMatch(submitted, tokenFor(secret))) return next(csrfError());
  req.csrfToken = () => tokenFor(secret);
  return next();
};

module.exports = csrfProtection;
module.exports.COOKIE_NAME = COOKIE_NAME;
module.exports.tokenFor = tokenFor;
