import { expect, test } from "@playwright/test";

type Counts = { live: number; replayed: number; blocked: number };

test("Liner 기록·재생은 문의함의 실제 판정 경로를 거친다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^L03 미판정/ }).click();
  const request = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/forwarding/assess" && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "이 문의 판정" }).click();
  const response = await request;
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result).toMatchObject({ leadId: "L03", assessment: { mode: "live" } });
  expect(result.assessment.details.externalStatus).not.toBe("failed");
  await expect(page.getByRole("article").getByRole("heading", { name: "판정 근거" })).toBeVisible();

  const metrics = await page.request.get("/__e2e/liner");
  expect(metrics.ok()).toBe(true);
  const counts: Counts = await metrics.json();
  expect(counts.blocked).toBe(0);
  expect(counts.live + counts.replayed).toBe(2);
  if (process.env.MIRINAE_E2E_EXPECT_LINER === "live") expect(counts.live).toBe(2);
  if (process.env.MIRINAE_E2E_EXPECT_LINER === "replay") expect(counts.live).toBe(0);
  console.info(`Liner 실제 ${counts.live}회 / 재생 ${counts.replayed}회 / 차단 ${counts.blocked}회`);
});
