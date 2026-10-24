// Cryptographically secure random strings (replaces the `crypto-random-string` package, whose
// current versions are ESM-only). No config/DB dependencies so scripts can use it too.
const crypto = require("crypto");

// RFC 3986 unreserved characters, same alphabet as crypto-random-string's "url-safe" type
const URL_SAFE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/** Random string of `length` characters drawn uniformly (no modulo bias) from `characters`. */
const randomFromCharacters = (length, characters) => {
  if (typeof characters !== "string" || characters.length < 2 || characters.length > 256) {
    throw new TypeError("`characters` must contain between 2 and 256 characters");
  }
  let out = "";
  for (let i = 0; i < length; i += 1) out += characters[crypto.randomInt(characters.length)];
  return out;
};

/**
 * randomString({ length, type?, characters? })
 *  - type "hex" (default), "base64url" or "url-safe"; or a custom `characters` alphabet.
 */
const randomString = ({ length, type = "hex", characters } = {}) => {
  if (!Number.isInteger(length) || length < 0) throw new TypeError("`length` must be a non-negative integer");
  if (characters) return randomFromCharacters(length, characters);
  switch (type) {
    case "hex":
      return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
    case "base64url":
      return crypto.randomBytes(Math.ceil((length * 3) / 4)).toString("base64url").slice(0, length);
    case "url-safe":
      return randomFromCharacters(length, URL_SAFE_CHARS);
    default:
      throw new TypeError(`Unknown random string type: ${type}`);
  }
};

module.exports = { randomString, URL_SAFE_CHARS };
