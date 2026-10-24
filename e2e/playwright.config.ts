import { defineConfig, devices } from "@playwright/test";
import path from "path";

import { BASE_URL, DB_URI, PORT } from "./tests/constants";

const SERVER_LOG = process.env.E2E_SERVER_LOG || path.join(__dirname, ".server.log");

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  outputDir: "./test-results",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    acceptDownloads: true,
    launchOptions: {
      // Let the YouTube player start without a real user gesture.
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Wrapper builds the client (Vite, Node $E2E_CLIENT_NODE, default 24) when E2E_BUILD=1, runs the
    // server with Node $E2E_SERVER_NODE and redirects stdout/stderr to e2e/.server.log
    command: `bash ${path.join(__dirname, "scripts/start-server.sh")}`,
    url: `${BASE_URL}/api/misc/columns`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      DB_URI,
      APP_URL: BASE_URL,
      RATE_LIMIT_DISABLED: "true",
      MAIL_TRANSPORT: "log",
      // Never send real mail from the test run, even if the log transport is missing.
      MG_APIKEY: "e2e-invalid-key",
      MG_DOMAIN: "example.test",
      JWT_SECRET: "e2e-jwt-secret-0123456789abcdefghijklmnop",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdefghijk",
      CORS_ORIGINS: BASE_URL,
      E2E_SERVER_LOG: SERVER_LOG,
    },
  },
});
