module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  modulePathIgnorePatterns: ["<rootDir>/client/"],
  setupFiles: ["<rootDir>/tests/setup/env.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/after-env.js"],
  globalSetup: "<rootDir>/tests/setup/global-setup.js",
  globalTeardown: "<rootDir>/tests/setup/global-teardown.js",
  clearMocks: true,
  testTimeout: 30000,
};
