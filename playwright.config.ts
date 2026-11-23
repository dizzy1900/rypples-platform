import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000, env: { LIVE_AI: "off" } },
});
