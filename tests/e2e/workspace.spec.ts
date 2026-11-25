import { expect, test } from "@playwright/test";

const publicOrigin = "http://127.0.0.1:3150";

test("사이드바 화면을 직접 열고 선별 현황을 문의 목록 필터에서 확인한다", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(publicOrigin + "/inbox/status");
  const menu = page.getByRole("navigation", { name: "업무 메뉴" });
  const link = (name: string) => menu.getByRole("link", { name, exact: true });

  await expect(link("선별 현황")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "미선별 30", exact: true })).toBeVisible();
  await expect(page.locator(".decision-card")).toHaveCount(0);

  await link("문의 선별").click();
  await expect(page).toHaveURL(publicOrigin + "/inbox");
  await expect(link("전체 문의")).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "선별 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "다시 선별", exact: true })).toBeEnabled({ timeout: 30_000 });

  await link("선별 현황").click();
  for (const [label, id, count] of [
    ["유효", "valid", 8],
    ["애매", "ambiguous", 6],
    ["국가 확인", "country-check", 3],
    ["제휴 확인", "partnership-check", 2],
    ["무효", "invalid", 11],
  ] as const) {
    await expect(page.getByRole("link", { name: `${label} ${count}`, exact: true }))
      .toHaveAttribute("href", "/inbox?filter=" + id);
  }

  for (const [name, filter] of [["딜러 6", "dealer"], ["권역팀 10", "regional-sales"], ["인사팀 1", "hr"], ["없음 10", "none"]]) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", "/inbox?filter=" + filter);
  }

  await page.getByRole("link", { name: "유효 8", exact: true }).click();
  await expect(page).toHaveURL(publicOrigin + "/inbox?filter=valid");
  const valid = page.getByRole("region", { name: "유효 8", exact: true });
  await expect(valid.getByRole("listitem")).toHaveCount(8);
  await expect(page.getByRole("region", { name: "애매 6", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(valid.getByRole("listitem")).toHaveCount(8);

  await link("피드백 요청").click();
  await expect(link("피드백 요청")).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".direction-lead")).toHaveCount(6);
  await expect(page.locator(".decision-card")).toHaveCount(0);

  await link("마케팅 요청").click();
  await expect(page).toHaveURL(publicOrigin + "/marketing");
  await expect(link("전체 요청 확인")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("list", { name: "요청 우선순위" })).toBeVisible();
  await expect(page.getByRole("region", { name: "캠페인 효과", exact: true })).toHaveCount(0);

  await link("캠페인 효과 보기").click();
  await expect(link("캠페인 효과 보기")).toHaveAttribute("aria-current", "page");
  const campaigns = page.getByRole("region", { name: "캠페인 효과", exact: true });
  await expect(campaigns).toBeVisible();
  await expect(page.getByRole("list", { name: "요청 우선순위" })).toHaveCount(0);
  await page.reload();
  await expect(campaigns).toBeVisible();
  await expect(link("캠페인 효과 보기")).toHaveAttribute("aria-current", "page");
});
