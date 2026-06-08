import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  // Retry on CI to absorb timing flakiness under load; fail fast locally.
  retries: isCI ? 2 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
    // Keep diagnostics only when a test actually fails/retries.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "bun run dev -- --port 5174",
    cwd: "packages/ui",
    url: "http://localhost:5174",
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
