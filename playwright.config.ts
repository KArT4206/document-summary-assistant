import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  // Default is 30s. Some tests wait on a real AI response, which can now
  // legitimately route through the Ollama fallback (a local model — slower
  // than Gemini, especially under concurrent test-worker load) rather than
  // failing fast, so the per-test budget needs real headroom above the
  // 90s expect-level timeout those specific tests already use.
  timeout: 100_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
