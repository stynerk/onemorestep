import { defineConfig } from "@playwright/test";

const liner = process.env.MIRINAE_E2E_LINER === "1";
const privateSettings = new Set(["LINER_API_KEY", "MAIL_FROM", "GMAIL_APP_PASSWORD", "TEST_MAIL_TO"]);
const browserEnvironment = Object.fromEntries(Object.entries(process.env)
  .filter(([name, value]) => value !== undefined && !privateSettings.has(name.toUpperCase())));
const origin = (port: number) => "http://127.0.0.1:" + port;
const server = (mode: string, port: number) => ({
  command: "node --import tsx tests/e2e/support/server.ts " + mode + " " + port,
  url: origin(port) + "/__e2e/health",
  reuseExistingServer: false,
  timeout: 120_000,
});

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: liner ? "**/live-recording.spec.ts" : "**/*.spec.ts",
  testIgnore: liner ? [] : ["**/live-recording.spec.ts"],
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/" + (liner ? "liner" : "scenes"),
  reporter: "list",
  use: {
    browserName: "chromium",
    baseURL: origin(liner ? 3151 : 3149),
    storageState: {
      cookies: [],
      origins: [3149, 3150, 3151].map((port) => ({
        origin: origin(port),
        localStorage: [{ name: "onemorestep.demo-session", value: "1" }],
      })),
    },
    headless: true,
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
    screenshot: "on",
    launchOptions: { executablePath: process.env.MIRINAE_E2E_CHROMIUM_EXECUTABLE, env: browserEnvironment },
  },
  webServer: liner ? server("liner", 3151) : [server("saved", 3149), server("public", 3150)],
});
