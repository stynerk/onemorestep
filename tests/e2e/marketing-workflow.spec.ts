import { expect, test } from "@playwright/test";

const demo = "http://127.0.0.1:3150";
test.describe.configure({ timeout: 90_000 });

test("문의함 선별 뒤 유입 경로의 효과가 채널 선택에 반영된다", async ({ page }) => {
  await page.goto(demo + "/marketing", { waitUntil: "domcontentloaded" });
  const campaigns = page.getByRole("region", { name: "캠페인 효과" });
  await expect(campaigns.getByRole("row", { name: /\bC1\b/u })).toContainText("선별 전");
  await expect(campaigns.getByRole("row", { name: /\bC2\b/u })).toContainText("선별 전");

  await page.getByRole("link", { name: "문의함", exact: true }).click();
  await page.getByRole("button", { name: "선별 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "다시 선별", exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.locator(".lead").getByRole("button", { name: /^L06\b/u }).click();
  await expect(page.locator(".decision-card")).toContainText(/유입:\s*C1 LinkedIn/u);

  await page.getByRole("navigation", { name: "업무 메뉴" })
    .getByRole("link", { name: "마케팅 협조 요청", exact: true }).click();
  for (const [code, channel, count, effect] of [
    ["C1", "LinkedIn", "3/5", "효과 높음"],
    ["C2", "Instagram", "0/6", "효과 낮음"],
    ["C3", "이메일", "2/4", "효과 높음"],
    ["C4", "블로그", "1/3", "보통"],
  ]) {
    const campaign = campaigns.getByRole("row", { name: new RegExp("\\b" + code + "\\b", "u") });
    await expect(campaign).toContainText(channel);
    await expect(campaign).toContainText(count);
    await expect(campaign).toContainText(effect);
  }
  const instagram = page.getByRole("checkbox", { name: "Instagram 사용" });
  const instagramRow = page.getByRole("listitem").filter({ has: instagram });
  await expect(instagramRow).toContainText("효과 낮음 · 유효 0/6");
  await expect(instagram).toBeEnabled();
  await instagram.check();
  await instagram.uncheck();
  await expect(campaigns.getByRole("row", { name: /\bC2\b/u })).toContainText("0/6");
});

test("연결 리드로 요청을 접수하고 초안을 승인해야 캠페인을 완료할 수 있다", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-24T03:00:00Z"));
  await page.goto(demo);
  await page.getByRole("button", { name: "선별 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "다시 선별", exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("navigation", { name: "업무 메뉴" })
    .getByRole("link", { name: "마케팅 협조 요청", exact: true }).click();
  await page.getByRole("button", { name: "요청 접수", exact: true }).click();

  const form = page.getByRole("region", { name: "마케팅 요청 접수" });
  const submit = form.getByRole("button", { name: "접수하기", exact: true });
  await expect(submit).toBeDisabled();
  await form.getByLabel("요청자", { exact: true }).selectOption({ label: "본사 세일즈 · 유럽 담당" });
  await form.getByLabel("요청 유형", { exact: true }).selectOption({ label: "사례 자료" });
  await form.getByLabel("상품", { exact: true }).selectOption({ label: "PM-50" });
  await form.getByLabel("연결 리드", { exact: true }).selectOption("L03");
  await expect(form.getByLabel("지역", { exact: true })).toHaveValue("NA");
  await expect(form).toContainText("문의함 기록");
  await expect(form.getByLabel("딜 단계", { exact: true })).toHaveText("문의");
  await form.getByLabel("마감일", { exact: true }).fill("2026-11-26");
  await form.getByLabel("딜 규모", { exact: true }).selectOption({ label: "대" });
  await form.getByLabel("메모", { exact: true }).fill("사례 자료를 준비해 주세요.");
  await submit.click();

  const list = page.getByRole("list", { name: "요청 우선순위" });
  await expect(list.getByRole("button", { name: /M09/u })).toContainText("마감 임박");
  await expect(list.getByRole("button", { name: /M09/u })).toContainText("AI 77점");
  await expect(page.getByRole("region", { name: "반복 요청 묶기 제안" })).toContainText("M01 · M09");
  const workflow = page.getByRole("region", { name: "처리 흐름" });
  await expect(workflow.getByRole("button", { name: "진행", exact: true })).toBeDisabled();
  await expect(workflow.getByRole("button", { name: "반려", exact: true })).toBeDisabled();
  await workflow.getByRole("combobox", { name: "담당자", exact: true }).selectOption({ index: 1 });
  await workflow.getByRole("button", { name: "진행", exact: true }).click();
  await workflow.getByRole("button", { name: "검토", exact: true }).click();
  const complete = workflow.getByRole("button", { name: "완료", exact: true });
  await expect(complete).toBeDisabled();

  const linkedin = page.getByRole("checkbox", { name: "LinkedIn 사용" });
  await linkedin.check();
  await page.getByRole("button", { name: "LinkedIn 초안 보기", exact: true }).click();
  const draft = page.getByRole("region", { name: "LinkedIn 초안" });
  await expect(draft.getByText("기본 틀", { exact: true })).toBeVisible();
  await draft.getByRole("button", { name: "초안 수정", exact: true }).click();
  await draft.getByRole("textbox", { name: "수정한 초안", exact: true }).fill("도입 검토용 사례 자료를 소개합니다.");
  await draft.getByRole("button", { name: "수정 저장", exact: true }).click();
  await draft.getByRole("checkbox", { name: "표현과 근거를 확인했습니다" }).check();
  await draft.getByRole("button", { name: "초안 승인", exact: true }).click();
  await complete.click();
  await expect(workflow).toContainText("C05");
  await expect(page.getByRole("row", { name: /\bC05\b/u })).toContainText("판단 보류");

  await page.reload();
  await list.getByRole("button", { name: /M09/u }).click();
  await expect(workflow).toContainText("C05");
  await page.getByRole("button", { name: "요청자 보기", exact: true }).click();
  const requesterView = page.getByRole("region", { name: "요청자 보기" });
  await requesterView.getByRole("combobox", { name: "내 요청 보기", exact: true }).selectOption({ label: "본사 세일즈 · 유럽 담당" });
  await expect(requesterView).toContainText("M09");
  await expect(requesterView).toContainText("완료");

  await page.getByRole("button", { name: "요청자 보기", exact: true }).click();
  await list.getByRole("button", { name: /M04/u }).click();
  await workflow.getByRole("combobox", { name: "담당자", exact: true }).selectOption({ index: 1 });
  const reject = workflow.getByRole("button", { name: "반려", exact: true });
  await expect(reject).toBeDisabled();
  await workflow.getByLabel("반려 사유", { exact: true }).fill("같은 자료를 이미 준비했습니다.");
  await reject.click();
  await expect(workflow).toContainText("현재 상태 반려");
  await expect(workflow).toContainText("같은 자료를 이미 준비했습니다.");
});
