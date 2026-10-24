// Runs before any module is required in every test file (and from global setup).
// dotenv never overrides variables that are already set, so these win over .env.
// One database per jest run (the name is fixed in global setup, whose env is inherited by all test
// files/workers), so concurrent runs don't clobber each other. Dropped in global teardown.
if (!process.env.TCHERLY_JEST_DB) process.env.TCHERLY_JEST_DB = `tcherly_test_jest_${process.pid}`;

const TEST_ENV = {
  NODE_ENV: "test",
  PORT: "0", // in case an old server.js still calls listen() on require
  DB_URI: `mongodb://127.0.0.1:27018/${process.env.TCHERLY_JEST_DB}`,
  RATE_LIMIT_DISABLED: "true",
  MAIL_TRANSPORT: "log",
  JWT_SECRET: "test_jwt_secret_0123456789_abcdefghijklmnopqrstuvwxyz",
  SESSION_SECRET: "test_session_secret_0123456789_abcdefghijklmnopqrstuvwxyz",
  APP_URL: "http://tcherly.test",
  GOOGLE_API_KEY: "",
  MG_APIKEY: "test-key",
  MG_DOMAIN: "mg.tcherly.test",
};

Object.assign(process.env, TEST_ENV);
// Use defaults from config for expiries (do not inherit dev .env overrides).
delete process.env.JWT_EXPIRY;
delete process.env.JWT_REFRESH_EXPIRY;

module.exports = TEST_ENV;
