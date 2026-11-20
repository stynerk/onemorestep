import { expect, test, type Page } from "@playwright/test";
import { FORWARDING_STORAGE_KEY } from "../../src/lib/forwarding/store";
import type { ForwardingEvent } from "../../src/lib/forwarding/types";

const friday = new Date("2026-11-20T01:00:00.000Z");
const monday = new Date("2026-11-23T01:00:00.000Z");

async function savedEvents(page: Page): Promise<ForwardingEvent[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"events":[]}').events, FORWARDING_STORAGE_KEY);
}

async function lead(page: Page, id: string) {
  await page.getByRole("button", { name: new RegExp("^" + id + " ") }).click();
}

const card = (page: Page) => page.getByRole("article");
const proposal = (page: Page) => page.getByRole("region", { name: "재배정 제안" });
const simulate = (page: Page) => page.getByRole("button", { name: "기한 경과 시뮬레이션" }).click();
const approveAgain = (page: Page) => page.getByRole("button", { name: "재배정 승인", exact: true });
const confirmAssignment = async (page: Page, dealer: string) =>
  expect(card(page).getByRole("heading", { name: dealer + "에 배정했습니다." })).toBeVisible();

function sceneTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
  }).format(date);
}

async function compare(page: Page) {
  await lead(page, "L23");
  const selection = page.locator("#L23-partnership-choice");
  if (await selection.isVisible()) {
    await selection.selectOption("purchase");
    await page.locator("#L23-partnership-note").fill("시연용 구매 문의 확인");
    await card(page).getByRole("button", { name: "회신 기록" }).click();
  }
  const dealers = card(page).locator("section").filter({ has: page.getByRole("heading", { name: "추천 딜러", exact: true }) });
  const first = dealers.locator(".dealer-entry-head").first();
  const second = dealers.locator(".runner-up > summary");
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  const firstName = await first.locator("strong").innerText();
  const firstScore = Number(await first.locator(".score").innerText());
  const [, secondName, secondScore] = (await second.innerText()).split(" · ");
  return [{ name: firstName, score: firstScore }, { name: secondName, score: Number(secondScore) }];
}

const scenario = test.extend<{ mailRequests: ForwardingEvent[] }>({
  mailRequests: async ({ page }, runTest) => {
    const requests: ForwardingEvent[] = [];
    await page.route("**/api/forwarding/mail", async (route) => {
      const { event } = route.request().postDataJSON() as { event: ForwardingEvent };
      requests.push(event);
      await route.fulfill({ json: { message: "메일 쓰기 모의 완료" } });
    });
    await runTest(requests);
  },
});

scenario.beforeEach(async ({ page, mailRequests }) => {
  expect(mailRequests).toHaveLength(0);
  await page.clock.setFixedTime(friday);
  await page.goto("/");
  await lead(page, "L03");
  await card(page).getByRole("button", { name: "이 문의 판정" }).click();
  await card(page).getByRole("button", { name: "승인", exact: true }).click();
  await confirmAssignment(page, "V MedSource");
});

scenario("S6-01 금요일 배정의 응답 기한은 월요일 한국 시각이다", async ({ page }) => {
  await expect(page.getByRole("button", { name: /^L03 딜러 배정/ })).toBeVisible();
  await expect(card(page).getByText("딜러 응답 기한 " + sceneTime(monday) + " (한국 시간)")).toBeVisible();
});

scenario("S6-02 기한 전에는 재배정 제안을 표시하지 않는다", async ({ page }) => {
  await expect(proposal(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^L03 재배정 제안/ })).toHaveCount(0);
});

scenario("S6-03 기한 경과 시 기기 시각을 유지하고 다음 딜러를 제안한다", async ({ page }, testInfo) => {
  const originalClock = await page.evaluate(() => Date.now());
  await simulate(page);
  await expect(page.getByRole("button", { name: /^L03 재배정 제안/ })).toBeVisible();
  await expect(proposal(page)).toContainText(/원래 딜러 V MedSource.*경과/);
  await expect(proposal(page)).toContainText(/다음 순위 U Health Supply.*점수/);
  await expect(proposal(page)).toContainText(/최근 90일 전달.*전환율.*미응답/);
  expect(await page.evaluate(() => Date.now())).toBe(originalClock);
  await page.screenshot({ path: testInfo.outputPath("scene-6-reassignment.png") });
});

scenario("S6-04 재배정은 V의 미응답과 U의 요약 메일 요청을 한 번 기록한다", async ({ page, mailRequests }) => {
  await simulate(page);
  await approveAgain(page).click();
  await confirmAssignment(page, "U Health Supply");
  await expect(card(page).getByText(/V MedSource 미응답 기록/)).toBeVisible();
  const events = (await savedEvents(page)).filter((event) => event.type === "reassigned" && event.leadId === "L03");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ dealerId: "dealer-u", target: "dealer" });
  await expect.poll(() => mailRequests.filter((event) => event.type === "reassigned")).toEqual(events);
});

scenario("S6-05 다음 미국 리드의 V 점수가 0.1 내려가고 순위가 바뀐다", async ({ page }) => {
  await lead(page, "L23");
  await card(page).getByRole("button", { name: "이 문의 판정" }).click();
  await expect(page.locator("#L23-partnership-choice")).toBeVisible();
  const before = await compare(page);
  expect(before.map((entry) => entry.name)).toEqual(["V MedSource", "U Health Supply"]);
  await lead(page, "L03");
  await simulate(page);
  await approveAgain(page).click();
  const after = await compare(page);
  expect(after.map((entry) => entry.name)).toEqual(["U Health Supply", "V MedSource"]);
  expect(before[0].score - after[1].score).toBeCloseTo(0.1, 2);
});

scenario("S6-06 재배정 승인 두 번에도 미응답과 메일 요청은 각각 한 건이다", async ({ page, mailRequests }) => {
  await simulate(page);
  const approval = approveAgain(page);
  await expect(approval).toBeEnabled();
  await approval.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await confirmAssignment(page, "U Health Supply");
  await expect.poll(() => mailRequests.filter((event) => event.type === "reassigned")).toHaveLength(1);
  expect((await savedEvents(page)).filter((event) => event.type === "reassigned")).toHaveLength(1);
});

scenario("S6-07 다음 딜러가 없으면 지역 담당자에게 넘긴다", async ({ page, mailRequests }) => {
  await simulate(page);
  await approveAgain(page).click();
  await confirmAssignment(page, "U Health Supply");
  await simulate(page);
  await expect(proposal(page).getByRole("button", { name: "지역 담당자에게 넘기기" })).toBeVisible();
  await expect(approveAgain(page)).toHaveCount(0);
  await expect(proposal(page)).toContainText("배정 가능한 다음 딜러가 없습니다");
  const before = mailRequests.length;
  await proposal(page).getByRole("button", { name: "지역 담당자에게 넘기기" }).click();
  await expect(page.getByRole("button", { name: /^L03 담당자 직접 처리/ })).toBeVisible();
  expect(mailRequests).toHaveLength(before);
});

scenario("S6-08 시연 시각 해제 후에도 재배정과 미응답은 유지된다", async ({ page }) => {
  await simulate(page);
  await approveAgain(page).click();
  await confirmAssignment(page, "U Health Supply");
  const events = await savedEvents(page);
  const release = page.getByRole("button", { name: "시연 시각 해제" });
  await release.click();
  await expect(release).toHaveCount(0);
  await expect(card(page).getByText(/V MedSource 미응답 기록/)).toBeVisible();
  expect(await savedEvents(page)).toEqual(events);
});

scenario("S6-09 새로고침 뒤 U 배정과 V의 미응답 및 점수가 복원된다", async ({ page }) => {
  await simulate(page);
  await approveAgain(page).click();
  await confirmAssignment(page, "U Health Supply");
  const score = card(page).getByText(/V MedSource 미응답 기록.*갱신 점수/);
  await expect(score).toBeVisible();
  const before = await score.innerText();
  await page.reload();
  await lead(page, "L03");
  await confirmAssignment(page, "U Health Supply");
  await expect(score).toHaveText(before);
  expect((await savedEvents(page)).filter((event) => event.type === "reassigned")).toHaveLength(1);
});

scenario("S6-10 초기화 취소는 기록을 보존하고 확인은 미판정 30건으로 돌린다", async ({ page }) => {
  await simulate(page);
  await approveAgain(page).click();
  const reset = page.getByRole("button", { name: "시연 초기화" });
  await expect(reset).toBeEnabled();
  const before = await savedEvents(page);
  await reset.click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(await savedEvents(page)).toEqual(before);
  await reset.click();
  await page.getByRole("button", { name: "초기화 확인" }).click();
  await expect(page.getByRole("heading", { name: "미판정 30" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^L\d{2} 미판정/ })).toHaveCount(30);
  await expect(page.getByRole("button", { name: /^L\d{2} 미판정/ }).last()).toHaveText(/^L06/);
  await expect(page.getByRole("button", { name: "판정 시작" })).toBeEnabled();
  expect(await savedEvents(page)).toEqual([]);
});
