const { randomUUID } = require("crypto");
const config = require("../config");
const { dashIt } = require("../utils/slug");

// Options for cookies set by the API (refresh tokens, unique-id).
const cookieOptions = (extra = {}) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  ...extra,
});

const VALIDATION_KIND_MESSAGES = {
  required: "is required",
  maxlength: "is too long",
  minlength: "is too short",
  max: "is too large",
  min: "is too small",
  enum: "has an invalid value",
};

/**
 * For mongoose validation/cast errors, returns a client-safe message naming the offending
 * field(s) (never the submitted values); returns null for any other error.
 */
const validationErrorMessage = (error) => {
  if (!error) return null;
  if (error.name === "ValidationError" && error.errors && typeof error.errors === "object") {
    const parts = [];
    // Update validators on arrays of subdocuments nest a ValidationError per array path
    const collect = (errors) =>
      Object.keys(errors).forEach((path) => {
        const e = errors[path] || {};
        if (e.errors && typeof e.errors === "object") return collect(e.errors);
        const field = String(path).split(".").filter((p) => !/^\d+$/.test(p)).pop() || path;
        const part = `${field} ${VALIDATION_KIND_MESSAGES[e.kind] || "is invalid"}`;
        if (!parts.includes(part)) parts.push(part);
      });
    collect(error.errors);
    return parts.length ? `Invalid input: ${parts.join(", ")}.` : "Invalid input.";
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return error.path ? `Invalid input: ${error.path} is invalid.` : "Invalid input.";
  }
  return null;
};

/** Sends 400 { success:false, message } for validation errors, else logs and sends a generic 500. */
const sendError = (res, error, message = "Internal server error") => {
  const validationMessage = validationErrorMessage(error);
  if (validationMessage) return res.status(400).send({ success: false, message: validationMessage });
  console.log(error);
  return res.status(500).send({ success: false, message });
};

module.exports = {
  cookieOptions,
  validationErrorMessage,
  sendError,
  // Relies on express "trust proxy" (TRUST_PROXY env) to resolve the client address from proxy headers.
  getClientIp: req => {
    if (req) {
      if (typeof req.ip === "string") return req.ip;
      if (req.connection) return req.connection.remoteAddress;
    }
    return null;
  },
  setUUIDCookie: (req, res) => {
    if (req.cookies["unique-id"]) return req.cookies["unique-id"];
    const uuid = randomUUID();
    res.cookie("unique-id", uuid, cookieOptions({ maxAge: config.token.refreshExpiresIn }));
    return uuid;
  },
  clearCookie: (res, name) => {
    res.cookie(name, "", cookieOptions({ expires: new Date(0) }));
  },
  dashIt,
  isValidObjectId: str => new RegExp("^[0-9a-fA-F]{24}$").test(str)
};
