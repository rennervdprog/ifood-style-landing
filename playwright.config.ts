import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const AUTH_FILE = path.resolve(".auth/pdv-user.json");
const hasAuth = fs.existsSync(AUTH_FILE);
const baseURL = process.env.E2E_BASE_URL || "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }], ["github"]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...(hasAuth ? { storageState: AUTH_FILE } : {}),
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
