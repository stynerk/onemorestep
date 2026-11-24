import { expect, test } from "@playwright/test";

const publicDemo = "http://127.0.0.1:3150";

test("마케팅 시연에서 정책 점수를 확인하고 사유를 붙여 순위를 조정한다", async ({ page }) => {
  await page.goto(publicDemo + "/inbox", { waitUntil: "domcontentloaded" });
  await page.getByRole("navigation", { name: "업무 메뉴" })
    .getByRole("link", { name: "마케팅 요청", exact: true }).click();
  await expect(page).toHaveURL(/\/marketing$/);
  const requests = page.getByRole("list", { name: "요청 우선순위" });
  const rows = requests.getByRole("button");
  await expect(rows).toHaveText([
    /M01.*AI 86점/su, /M04.*AI 61점/su, /M06.*AI 53점/su, /M02.*AI 50점/su,
    /M05.*AI 40점/su, /M07.*AI 28점/su, /M03.*AI 24점/su, /M08.*AI 23점/su,
  ]);
  await expect(page.getByRole("region", { name: "반복 요청 묶기 제안" })).toContainText("M03 · M07");

  await requests.getByRole("button", { name: /M06/u }).click();
  await page.getByLabel("새 순위").selectOption("2");
  const saveRank = page.getByRole("button", { name: "순위 저장", exact: true });
  await expect(saveRank).toBeDisabled();
  await expect(rows.nth(2)).toContainText("M06");

  const reason = "입찰 준비 기간이 길어 지금 시작";
  await page.getByLabel("조정 사유").fill(reason);
  await saveRank.click();
  await expect(rows.nth(1)).toContainText("M06");
  await expect(rows.nth(1)).toContainText("AI 53점");

  await page.reload();
  await expect(rows.nth(1)).toContainText("M06");
  const rankHistory = page.getByRole("region", { name: "순위 조정 기록" });
  await expect(rankHistory).toContainText(reason);
  await expect(rankHistory).toContainText("53");

  await page.getByRole("button", { name: "시연 초기화", exact: true }).click();
  await page.getByRole("button", { name: "초기화 확인", exact: true }).click();
  await expect(rows.nth(2)).toContainText("M06");
  await expect(page.getByText(reason)).toHaveCount(0);
});

test("공개 M01은 채널을 골라 저장 초안을 검토하고 근거와 경고를 본다", async ({ page }) => {
  await page.goto(publicDemo + "/marketing");
  const linkedin = page.getByRole("checkbox", { name: "LinkedIn 사용" });
  const viewDraft = page.getByRole("button", { name: "LinkedIn 초안 보기" });
  await expect(linkedin).toBeChecked();
  await linkedin.uncheck();
  await expect(viewDraft).toBeDisabled();
  await linkedin.check();

  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/marketing/draft"));
  await viewDraft.click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  expect((await response.json()).mode).toBe("recorded");

  const draft = page.getByRole("region", { name: "LinkedIn 초안" });
  await expect(draft.getByRole("link").first()).toHaveAttribute("href", /^https?:\/\//);
  await expect(draft.getByRole("list", { name: "의료기기 표현 경고" })).toBeVisible();
  await expect(draft.getByText("확인 필요", { exact: true }).first()).toBeVisible();
  await expect(draft.getByText("공개 참고 발췌", { exact: true })).toHaveCount(1);
  const approve = draft.getByRole("button", { name: "초안 승인" });
  await expect(approve).toBeDisabled();
  await draft.getByRole("checkbox", { name: "표현과 근거를 확인했습니다" }).check();
  await approve.click();
  await expect(draft.getByText("승인됨", { exact: true })).toBeVisible();

  await draft.getByRole("button", { name: "초안 수정", exact: true }).click();
  await draft.getByRole("textbox", { name: "수정한 초안", exact: true }).fill("경쟁사보다 30% 더 우수합니다.");
  await draft.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(draft.getByText("수정됨", { exact: true })).toBeVisible();
  await expect(draft.getByText("확인 필요", { exact: true }).first()).toBeVisible();
  const warnings = draft.getByRole("list", { name: "의료기기 표현 경고" });
  await expect(warnings).toContainText("비교 우위 단정");
  await expect(warnings).toContainText("근거 없는 수치");
  await expect(draft.getByRole("link", { name: "문장 근거" })).toHaveCount(0);
  await expect(approve).toBeDisabled();
});
