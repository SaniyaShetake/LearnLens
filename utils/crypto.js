const { randomString } = require("./random");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config");

const TOKEN_TYPES = ["user", "student", "researcher"];

const genRandom = (len = 64) => {
  return randomString({ length: len });
};

/**
 * Signs an access token for the given account type.
 * config.token.expiresIn is in milliseconds; jsonwebtoken expects seconds for numeric values.
 */
const signAccessToken = ({ _id, email }, type) => {
  if (!TOKEN_TYPES.includes(type)) throw new Error("Invalid token type: " + type);
  const { expiresIn, secret } = config.token;
  const token = jwt.sign({ _id: String(_id), email, type }, secret, {
    expiresIn: Math.max(1, Math.floor(expiresIn / 1000)),
    algorithm: "HS256",
  });
  return { token: "Bearer " + token, expiry: expiresIn };
};

// Hash of a random secret with the same cost as real password hashes. Compared against when an
// account doesn't exist, so sign-in takes the same time whether or not the email is registered.
let dummyHashPromise = null;
const getDummyHash = () => {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash(randomString({ length: 32 }), config.saltRounds);
  return dummyHashPromise;
};

/** Burns one bcrypt comparison (same cost as a real one) and always resolves to false. */
const compareDummyPassword = async (password) => {
  try {
    await bcrypt.compare(typeof password === "string" ? password : "", await getDummyHash());
  } catch (error) {
    // ignore: this comparison only exists to equalize timing
  }
  return false;
};

/** Async, constant-shape password check. Never throws; resolves to a boolean. */
const comparePassword = async (password, hash) => {
  if (typeof password !== "string") return compareDummyPassword("");
  if (typeof hash !== "string" || !hash) return compareDummyPassword(password);
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    return false;
  }
};

const genToken = (doc, type) => signAccessToken(doc, type);

module.exports = {
  TOKEN_TYPES,
  genToken,
  genRandom,
  signAccessToken,
  getDummyHash,
  comparePassword,
  compareDummyPassword,
};
