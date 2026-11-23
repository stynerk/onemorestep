import { defineConfig } from "@playwright/test";

// 데모 영상 녹화 전용 설정(#99). 공개 시연 주소(저장된 결과)만 연다. 키·메일 설정을 쓰지 않는다.
export default defineConfig({
  testDir: ".",
  testMatch: "record.spec.ts",
  workers: 1,
  timeout: 15 * 60_000,
  outputDir: "../video-out",
  reporter: "list",
  use: {
    browserName: "chromium",
    baseURL: process.env.DEMO_URL ?? "https://onemorestep-wheat.vercel.app",
    headless: true,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    video: { mode: "on", size: { width: 1440, height: 900 } },
    launchOptions: { slowMo: 250 },
  },
});
