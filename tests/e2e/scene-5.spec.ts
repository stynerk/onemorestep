import { expect, test } from "@playwright/test";
import { sendTestMail } from "../../src/lib/forwarding/gmail-test-transport.server";
import { mailKindFor } from "../../src/lib/forwarding/inbox";
import { getSavedIndustry } from "../../src/lib/forwarding/industry-demo.server";
import { assessLead, leadRow, mailPath, mockMail, storedEvents, testMailbox, testMailEnv } from "./scene-5-helper";

const publicBaseUrl = "http://127.0.0.1:3150";

test("S5-01 승인 대기 카드의 머리, 마스킹과 추천 이유", async ({ page }, testInfo) => {
  await mockMail(page, testInfo);
  const card = await assessLead(page, "L01");

  await expect(page.getByRole("group", { name: "시연 업종" })).toHaveCount(0);
  await expect(card.getByRole("heading", { name: "서울대학교병원", exact: true })).toBeVisible();
  await expect(card.getByText("대한민국", { exact: true })).toBeVisible();
  await expect(card.getByText("PM-50", { exact: true })).toBeVisible();
  await expect(card.getByText(/\d+시간 경과/)).toBeVisible();
  await expect(card.getByText(/mr•••@snuh\.org.*•••• -L01/)).toBeVisible();
  await expect(card).not.toContainText("mrn-demo-01@snuh.org");
  await expect(card).not.toContainText("DEMO-NOT-A-PHONE-L01");
  await expect(card.getByRole("heading", { name: "A Medical에 넘기세요." })).toBeVisible();
  await expect(card.getByText("소속 기관과 이메일 도메인이 확인됐고 제품 구매·검토 의향이 있어요.")).toBeVisible();
  await card.getByText("딜러 요약 미리보기", { exact: true }).click();
  await expect(card.getByText(/가상 리드 테스트 메일, 원래 수신자: 딜러/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("scene-5-decision.png"), fullPage: true });
});

test("S5-02 저장된 유효 판정에 기관 링크와 검색 시각, 도메인 대조와 자사 기록을 표시", async ({ page }, testInfo) => {
  await mockMail(page, testInfo);
  const card = await assessLead(page, "L01");

  await expect(card.getByText("유효", { exact: true })).toBeVisible();
  await expect(card.getByText("저장된 결과", { exact: true })).toBeVisible();
  await expect(card.getByRole("heading", { name: "소속 기관 확인" })).toBeVisible();
  await expect(card.getByRole("link", { name: "www.snuh.org" })).toHaveAttribute("href", "https://www.snuh.org/global/en/main.do");
  await expect(card.getByText(/^2026\.\s*11\.\s*18\..*9:00/, { exact: true })).toBeVisible();
  await expect(card.getByRole("heading", { name: "이메일 도메인" })).toBeVisible();
  await expect(card.getByText("기관 공식 이메일과 일치")).toBeVisible();
  await expect(card.getByRole("heading", { name: "자사 기록" })).toBeVisible();
  await expect(card.getByText("같은 기관의 전달 이력 0건")).toBeVisible();
});

test("S5-03 1순위 A Medical 점수와 이력, 2순위 D Medi", async ({ page }, testInfo) => {
  await mockMail(page, testInfo);
  const card = await assessLead(page, "L01");

  await expect(card.getByRole("heading", { name: "추천 딜러" })).toBeVisible();
  await expect(card.locator(".dealer-entry-head").getByText("A Medical", { exact: true })).toBeVisible();
  await expect(card.locator(".handoff-summary dd")).toHaveText("A Medical");
  await expect(card.getByText("0.53", { exact: true })).toBeVisible();
  await expect(card.getByText(/전달 8건.*전환율 42\.9%.*진행 1건.*미응답 0건/)).toBeVisible();
  await expect(card.getByText("이 기관 거래 기록 있음", { exact: true })).toBeVisible();
  await expect(card.getByText(/2순위 · D Medi · 0\.03/)).toBeVisible();
});

test("S5-04 승인 시 딜러 배정·응답 기한과 딜러 요약 메일 한 건", async ({ page }, testInfo) => {
  const { requests, mailboxes } = await mockMail(page, testInfo);
  const card = await assessLead(page, "L01");
  await card.getByRole("button", { name: "승인", exact: true }).click();

  await expect(leadRow(page, "L01")).toContainText("딜러 배정");
  await expect(card.getByText(/딜러 응답 기한.*한국 시간/)).toBeVisible();
  await expect(card.getByText(/테스트 메일 발송 완료/)).toBeVisible();
  expect(requests).toEqual([{ event: expect.objectContaining({
    type: "decision", leadId: "L01", action: "approve", dealerId: "dealer-a",
  }) }]);
  expect(requests.map(({ event }) => mailKindFor(event))).toEqual(["dealer-summary"]);
  expect(mailboxes).toEqual([testMailbox]);
});

test("S5-05 승인 두 번에 저장된 결정·메일 요청 각각 한 건", async ({ page }, testInfo) => {
  const { requests, mailboxes } = await mockMail(page, testInfo);
  const card = await assessLead(page, "L01");
  const approve = card.getByRole("button", { name: "승인", exact: true });
  await expect(approve).toBeEnabled();
  await approve.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });

  await expect(card.getByText(/테스트 메일 발송 완료/)).toBeVisible();
  expect(await storedEvents(page, "L01", "decision")).toHaveLength(1);
  expect(await storedEvents(page, "L01", "mail-delivery")).toHaveLength(1);
  expect(requests).toHaveLength(1);
  expect(mailboxes).toEqual([testMailbox]);
});

test("S5-06 메일 실패에도 배정을 유지하고 수동 재시도 성공", async ({ page }, testInfo) => {
  let attempts = 0;
  const { requests } = await mockMail(page, testInfo, {
    send: async () => ++attempts === 1 ? "smtp-failed" : "sent",
  });
  const card = await assessLead(page, "L01");
  await card.getByRole("button", { name: "승인", exact: true }).click();

  await expect(card.getByText(/Gmail SMTP 발송 실패/)).toBeVisible();
  await expect(leadRow(page, "L01")).toContainText("딜러 배정");
  const latestMail = (await storedEvents(page, "L01", "mail-delivery"))[0];
  expect(latestMail).toEqual(expect.objectContaining({ status: "failed" }));
  await card.getByRole("button", { name: "다시 보내기", exact: true }).click();
  await expect(card.getByText(/테스트 메일 발송 완료/)).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual({ event: requests[0].event, retryOf: latestMail.id });
  expect(await storedEvents(page, "L01", "decision")).toHaveLength(1);
});

test("S5-07 지연된 SMTP 타임아웃은 전송 불명으로 저장되고 자동 재시도되지 않음", async ({ page }, testInfo) => {
  const { promise: finishDelay, resolve: releaseTimeout } = Promise.withResolvers<void>();
  const { requests, mailboxes } = await mockMail(page, testInfo, {
    send: async () => {
      await finishDelay;
      throw { code: "ETIMEDOUT", command: "DATA" };
    },
  });
  const card = await assessLead(page, "L01");
  await card.getByRole("button", { name: "승인", exact: true }).click();
  try {
    await expect(card.getByText(/테스트 메일 처리 중/)).toBeVisible();
  } finally {
    releaseTimeout();
  }

  await expect(card.getByText(/전송 불명/)).toBeVisible();
  await expect(card.getByRole("button", { name: /다시 보내기|메일 상태 확인/ })).toHaveCount(0);
  expect(await storedEvents(page, "L01", "mail-delivery")).toEqual([expect.objectContaining({ status: "unknown" })]);
  await page.reload();
  await leadRow(page, "L01").click();
  await expect(card.getByText(/전송 불명/)).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(mailboxes).toEqual([testMailbox]);
});

test("S5-08 테스트 수신함 미설정 안내와 정상 승인", async ({ page }, testInfo) => {
  const { requests, mailboxes } = await mockMail(page, testInfo, { env: { TEST_MAIL_TO: "" } });
  const card = await assessLead(page, "L01");
  await card.getByRole("button", { name: "승인", exact: true }).click();

  await expect(card.getByText(/테스트 수신함 미설정/)).toBeVisible();
  await expect(leadRow(page, "L01")).toContainText("딜러 배정");
  expect(await storedEvents(page, "L01", "decision")).toHaveLength(1);
  expect(requests).toHaveLength(1);
  expect(mailboxes).toEqual([]);
});

test("S5-09 허용 외 수신자는 전송 계층에서 차단되고 차단 상태만 기록", async ({ page }, testInfo) => {
  const wrong = "unlisted@example.test";
  const { requests, mailboxes } = await mockMail(page, testInfo, {
    env: { ...testMailEnv, TEST_MAIL_TO: `${testMailbox}, ${wrong}` },
  });
  const card = await assessLead(page, "L01");
  await card.getByRole("button", { name: "승인", exact: true }).click();

  await expect(card.getByText(/테스트 수신함 주소 검증 실패/)).toBeVisible();
  expect(await storedEvents(page, "L01", "mail-delivery")).toEqual([expect.objectContaining({ status: "blocked" })]);
  expect(requests).toHaveLength(1);
  expect(mailboxes).toEqual([]);

  let transportCalls = 0;
  for (const recipients of [{ to: wrong }, { to: testMailbox, cc: [wrong] }, { to: testMailbox, bcc: [wrong] }]) {
    expect(await sendTestMail(testMailEnv, recipients, { subject: "[TEST] scene 5", text: "" }, async () => {
      transportCalls++;
      return "sent";
    })).toBe("recipient-blocked");
  }
  expect(transportCalls).toBe(0);
});

test("S5-10 이유가 빈 딜러 변경의 필수 입력 안내와 기록 차단", async ({ page }, testInfo) => {
  const { requests } = await mockMail(page, testInfo);
  const card = await assessLead(page, "L01");
  await card.getByRole("button", { name: "딜러 변경", exact: true }).click();
  await card.getByLabel("배정 딜러").selectOption({ label: "D Medi" });

  const reason = card.getByLabel("변경 이유");
  await expect(reason).toBeVisible();
  await expect(reason).toHaveAttribute("required", "");
  await expect(reason).toHaveAccessibleDescription("딜러를 변경하려면 이유를 입력해 주세요.");
  await expect(card.getByText("딜러를 변경하려면 이유를 입력해 주세요.")).toBeVisible();
  await expect(reason).toHaveValue("");
  const save = card.getByRole("button", { name: "딜러 변경 기록", exact: true });
  await expect(save).toBeDisabled();
  await save.evaluate((button: HTMLButtonElement) => button.form?.requestSubmit());
  expect(await storedEvents(page, "L01", "decision")).toEqual([]);
  expect(requests).toEqual([]);
});

test("S5-11 L06 담당자 확인 전 승인 불가, 확인 메일 한 건", async ({ page }, testInfo) => {
  const { requests, mailboxes } = await mockMail(page, testInfo);
  const card = await assessLead(page, "L06");

  await expect(card.getByRole("heading", { name: "담당 APAC의 딜러 확인이 필요해요." })).toBeVisible();
  await expect(leadRow(page, "L06")).toContainText("담당자 확인");
  await expect(card.getByRole("button", { name: "승인", exact: true })).toHaveCount(0);
  await expect(card.getByText(/테스트 메일 발송 완료/)).toBeVisible();
  expect(requests).toEqual([{ event: expect.objectContaining({
    leadId: "L06", type: "assessed", workflow: "manager-confirmation-pending",
  }) }]);
  expect(requests.map(({ event }) => mailKindFor(event))).toEqual(["manager-confirmation"]);
  expect(mailboxes).toEqual([testMailbox]);
  expect(await storedEvents(page, "L06", "decision")).toEqual([]);
});

test("S5-12 · S5-13 공개 빌드는 브라우저에 배정만 저장하고 메일 API 자체도 403 차단", async ({ page }, testInfo) => {
  const browserMailRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === mailPath) browserMailRequests.push(request.method());
  });
  const card = await assessLead(page, "L01", publicBaseUrl);
  await expect(page.getByText("저장된 결과로 보는 시연 버전 · 메일 발송 없음")).toBeVisible();
  await card.getByRole("button", { name: "승인", exact: true }).click();

  await expect(leadRow(page, "L01")).toContainText("딜러 배정");
  await expect(card.getByText("공개 시연에서는 메일을 보내지 않습니다.")).toBeVisible();
  const decisions = await storedEvents(page, "L01", "decision");
  expect(decisions).toEqual([expect.objectContaining({ action: "approve", dealerId: "dealer-a" })]);
  expect(await storedEvents(page, "L01", "mail-delivery")).toEqual([]);
  expect(browserMailRequests).toEqual([]);

  const response = await page.request.post(publicBaseUrl + mailPath, {
    headers: { Origin: publicBaseUrl },
    data: { event: decisions[0] },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ code: "public-demo", message: "공개 시연에서는 메일을 보내지 않습니다." });
  await page.screenshot({ path: testInfo.outputPath("scene-5-public-approval.png"), fullPage: true });
});

test("공개 정답 대조 패널에 최종 측정과 오판 사례를 표시한다", async ({ page }, testInfo) => {
  await page.goto(publicBaseUrl);
  const industries = page.getByRole("group", { name: "시연 업종" });
  const medicom = industries.getByRole("button", { name: "의료기기(Medicom)", exact: true });
  const saas = industries.getByRole("button", { name: "B2B SaaS", exact: true });
  await expect(medicom).toHaveAttribute("aria-pressed", "true");
  if (getSavedIndustry("b2b-saas")) {
    await expect(saas).toBeEnabled();
  } else {
    await expect(saas).toBeDisabled();
    await expect(industries.getByText("B2B SaaS 시연 데이터 준비 중", { exact: true })).toBeVisible();
  }
  await page.getByText("판정 정답 대조", { exact: true }).click();
  const panel = page.locator("details").filter({ has: page.getByText("판정 정답 대조", { exact: true }) });
  await expect(panel.getByText(/공개 문의함은 저장된 근거/u)).toBeVisible();
  const blind = panel.getByRole("region", { name: "새 블라인드 평가 30건" });
  await expect(blind.getByText("17/30", { exact: true })).toBeVisible();
  await expect(blind.getByText("21/30", { exact: true })).toBeVisible();
  await expect(blind.getByText(/유효 → 무효 0건, 거짓 유효 0건/u)).toBeVisible();
  await expect(blind.getByRole("link", { name: "새 블라인드 평가 보고서" })).toHaveAttribute(
    "href", /\/docs\/qa\/BLIND_EVALUATION_2026-11-23\.md$/u,
  );
  for (const score of ["30/30", "28/30", "33/70", "47/70"]) {
    await expect(panel.getByText(score, { exact: true })).toBeVisible();
  }
  await expect(panel.getByText("원본 정답 기준 23/70 (32.9%)")).toBeVisible();
  await expect(panel.getByText("넘길 곳 38/67")).toBeVisible();
  await expect(panel.getByText("1차 개선 45/70 (64.3%)")).toBeVisible();
  await expect(panel.getByText("넘길 곳 46/67 → 48/67")).toBeVisible();
  await expect(panel.getByText(/개선 전 27\/30/u)).toBeVisible();
  await expect(panel.getByText(/개선 전·블라인드/u)).toBeVisible();
  await expect(panel.getByText(/2차 개선·평가 결과를 본 뒤/u)).toBeVisible();
  await expect(panel.getByText("유효 오탐 0건 · 유효 → 무효 0건")).toBeVisible();
  await expect(panel.getByText(/23:43:06~23:47:32 KST/u)).toBeVisible();
  await expect(panel.getByRole("link", { name: "최종 평가 기록" })).toHaveAttribute(
    "href", /\/docs\/qa\/FINAL_EVALUATION_2026-11-20\.md$/u,
  );
  const cases = panel.getByRole("listitem");
  await expect(cases).toHaveCount(2);
  await expect(cases.filter({ hasText: "E02" })).toContainText("정답 유효 → 판정 애매");
  await expect(cases.filter({ hasText: "E02" })).toContainText("개선 후 애매");
  await expect(cases.filter({ hasText: "E58" })).toContainText("정답 유효 → 판정 무효");
  await expect(cases.filter({ hasText: "E58" })).toContainText("개선 후 유효");
  await expect(panel.getByRole("button", { name: /마케팅 협조 요청/u })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("public-final-evaluation.png") });
});
