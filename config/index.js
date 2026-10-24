require("dotenv").config({ quiet: true });

const env = process.env.NODE_ENV || "development";
const isProduction = env === "production";
const port = process.env.PORT || 3000;

const MIN_SECRET_LENGTH = 32;

const requireSecret = (name) => {
  const value = process.env[name];
  // Also reject the .env.example placeholders, which are long enough to pass the length check
  if (typeof value !== "string" || value.length < MIN_SECRET_LENGTH || /^</.test(value) || value.includes("replace_with")) {
    throw new Error(
      `[config] Environment variable ${name} is missing or too short (minimum ${MIN_SECRET_LENGTH} characters). ` +
        `Set it in .env (see .env.example), e.g. generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  return value;
};

const resolveAppUrl = () => {
  const value = (process.env.APP_URL || "").trim();
  if (value) return value.replace(/\/+$/, "");
  if (isProduction) {
    throw new Error("[config] Environment variable APP_URL is required in production (e.g. https://tcherly.example.com). It is used to build password-reset links.");
  }
  return `http://localhost:${port}`;
};

const parseList = (value) =>
  String(value || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const resolveCorsOrigins = () => {
  if (typeof process.env.CORS_ORIGINS === "string") return parseList(process.env.CORS_ORIGINS);
  return isProduction ? [] : ["http://localhost:8080", "http://localhost:3000"];
};

// Accepts the same values as express "trust proxy": true/false, a hop count, or a comma-separated list of IPs/subnets/names.
const resolveTrustProxy = () => {
  const value = (process.env.TRUST_PROXY || "").trim();
  if (!value) return "loopback";
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  return value;
};

module.exports = {
  app: {
    host: process.env.HOSTNAME || "localhost",
    port,
    env,
    url: resolveAppUrl(),
    trustProxy: resolveTrustProxy(),
  },
  cors: {
    origins: resolveCorsOrigins(),
  },
  rateLimit: {
    disabled: process.env.RATE_LIMIT_DISABLED === "true",
  },
  db: {
    uri: process.env.DB_URI || "mongodb://localhost:27017/test-debe",
    options: {
      serverSelectionTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT || 10000),
    },
  },
  session: {
    maxAge: parseInt(process.env.SESSION_EXPIRATION || 604800000),
    secret: requireSecret("SESSION_SECRET"),
  },
  token: {
    // Milliseconds. Converted to seconds when signing JWTs.
    expiresIn: parseInt(process.env.JWT_EXPIRY || 3600000),
    refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRY || 2592000000),
    secret: requireSecret("JWT_SECRET"),
  },
  saltRounds: 13,
};
