// Strips MongoDB operator keys ("$..." or dotted paths) from user-controlled input
// to prevent NoSQL operator injection (Mongoose 5 has no sanitizeFilter).

const MAX_DEPTH = 32;

const isUnsafeKey = (key) => typeof key === "string" && (key.startsWith("$") || key.includes("."));

class TooDeepError extends Error {
  constructor() {
    super("Request input is nested too deeply");
    this.name = "TooDeepError";
  }
}

/**
 * Removes unsafe keys in place. Throws TooDeepError when objects/arrays are nested deeper than
 * MAX_DEPTH (such input is never legitimate here and can't be fully sanitized).
 */
const sanitize = (value, depth = 0) => {
  if (value === null || typeof value !== "object") return value;
  if (depth > MAX_DEPTH) throw new TooDeepError();

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = sanitize(value[i], depth + 1);
    return value;
  }

  Object.keys(value).forEach((key) => {
    if (isUnsafeKey(key)) {
      delete value[key];
    } else {
      value[key] = sanitize(value[key], depth + 1);
    }
  });

  return value;
};

const sanitizeMiddleware = (req, res, next) => {
  try {
    ["body", "query", "params"].forEach((prop) => {
      if (req[prop] && typeof req[prop] === "object") sanitize(req[prop]);
    });
  } catch (error) {
    if (error instanceof TooDeepError) return res.status(400).send({ success: false, message: "Invalid request body." });
    return next(error);
  }
  return next();
};

module.exports = sanitizeMiddleware;
module.exports.sanitize = sanitize;
module.exports.TooDeepError = TooDeepError;
module.exports.MAX_DEPTH = MAX_DEPTH;
