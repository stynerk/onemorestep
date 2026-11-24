import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createForwardingStore, FORWARDING_STORAGE_KEY, FORWARDING_STORAGE_VERSION } from "../../src/lib/forwarding/store";
import type { ForwardingEvent } from "../../src/lib/forwarding/types";

const storageKey = FORWARDING_STORAGE_KEY;
const assessUrl = "**/api/forwarding/assess";
const mailUrl = "**/api/forwarding/mail";

function group(page: Page, name: string) {
  return page.getByRole("region", { name: new RegExp("^" + name + "\\s+\\d+$") });
}

function row(page: Page, leadId: string) {
  return page.locator(".lead").filter({
    has: page.locator(".lead-meta > span:first-child").filter({ hasText: new RegExp("^" + leadId + "$") }),
  });
}

function status(page: Page, leadId: string) {
  return row(page, leadId).locator(".lead-meta > span:last-child");
}

function card(page: Page) {
  return page.locator(".decision-card");
}

function runButton(page: Page) {
  return page.getByRole("button", { name: "선별 시작", exact: true });
}

async function runAssessment(page: Page) {
  await runButton(page).click();
  await expect(page.getByRole("button", { name: "다시 선별", exact: true })).toBeEnabled({ timeout: 20000 });
}

async function events(page: Page): Promise<ForwardingEvent[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").events ?? [], storageKey);
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(name + ".png");
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

const invalidState = /^처리 완료$/u;

test.beforeEach(async ({ page }) => {
  // Never forward a browser mail write, including the automatic requests during assessment.
  await page.route(mailUrl, (route) => route.fulfill({
    status: 200,
    json: { event: null, message: "테스트 메일 요청 확인" },
  }));
});

test("S2-01 초기 문의함에서 30건 모두 미선별이며 L06이 맨 아래다", async ({ page }) => {
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  const unassessed = group(page, "미선별");
  await expect(unassessed.getByRole("heading")).toHaveText("미선별 30");
  await expect(unassessed.getByRole("listitem")).toHaveCount(30);
  await expect(unassessed.locator(".lead-meta > span:first-child").last()).toHaveText("L06");
  await expect(runButton(page)).toBeEnabled();
});

test("S2-02 한 번 클릭하면 리드당 POST 한 건을 보내고 선별 중에는 버튼을 잠근다", async ({ page }) => {
  const gate = Promise.withResolvers<void>();
  const requests: string[] = [];
  await page.route(assessUrl, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const { leadId } = request.postDataJSON() as { leadId: string };
    requests.push(leadId);
    if (leadId === "L01") await gate.promise;
    await route.continue();
  });
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  try {
    await runButton(page).click();
    await expect(page.getByRole("button", { name: "선별 중…", exact: true })).toBeDisabled();
    await expect.poll(() => requests.includes("L01")).toBe(true);
  } finally {
    gate.resolve();
  }
  await expect(page.getByRole("button", { name: "다시 선별", exact: true })).toBeEnabled({ timeout: 20000 });
  expect(requests.sort()).toEqual(Array.from({ length: 30 }, (_, index) =>
    "L" + String(index + 1).padStart(2, "0")));
});

test("S2-03 저장 결과 그룹은 8·6·3·2·11건이고 유효 그룹 처음은 L06이다", async ({ page }, testInfo) => {
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  await runAssessment(page);
  for (const [label, count] of [
    ["유효", 8], ["애매", 6], ["국가 확인", 3], ["제휴 확인", 2], ["무효", 11],
  ] as const) {
    await expect(group(page, label).getByRole("heading")).toHaveText(label + " " + count);
    await expect(group(page, label).getByRole("listitem")).toHaveCount(count);
  }
  await expect(group(page, "유효").locator(".lead-meta > span:first-child").first()).toHaveText("L06");
  for (const [leadId, team] of [["L28", "APAC"], ["L29", "NA"], ["L30", "EU"]] as const) {
    await expect(group(page, "애매").getByRole("button", { name: new RegExp("^" + leadId) })).toBeVisible();
    await expect(row(page, leadId).locator(".lead-handoff")).toContainText(team + " 권역 세일즈팀");
  }
  await expect(row(page, "L26").locator(".lead-handoff")).toContainText("인사팀");
  for (const leadId of ["L24", "L25"]) {
    await expect(row(page, leadId).locator(".lead-handoff")).toContainText("없음");
  }
  await screenshot(page, testInfo, "scene-2-assessed-inbox");
  await row(page, "L29").getByRole("button", { name: /^L29/u }).click();
  await expect(card(page).locator(".handoff-summary")).toContainText("NA 권역 세일즈팀");
  await expect(card(page).getByText(/사칭 의심/u).first()).toBeVisible();
  await row(page, "L26").getByRole("button", { name: /^L26/u }).click();
  await expect(card(page).locator(".handoff-summary")).toContainText("인사팀");
  await row(page, "L24").getByRole("button", { name: /^L24/u }).click();
  await expect(card(page).locator(".handoff-summary")).toContainText("없음");
});

test("S2-04 무효 11건은 각각 근거가 있고 업종만으로 무효 처리하지 않는다", async ({ page }) => {
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  await runAssessment(page);
  await page.getByRole("navigation", { name: "문의함 필터" }).getByRole("button", { name: /^무효\s+11$/u }).click();
  const reasons = await group(page, "무효").locator(".lead-button > span:last-child").allTextContents();
  expect(reasons).toHaveLength(11);
  for (const reason of reasons) {
    expect(reason).toMatch(/소속.*없|기관을 찾지 못함|영업 제안|과제|논문|학생|채용|구직|경쟁사/u);
    expect(reason).not.toMatch(/업종|사칭 의심/u);
  }
});

test("S2-05 일괄 무효 처리는 무효 11건만 대상으로 한다", async ({ page }) => {
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  await runAssessment(page);
  const untouched = ["유효", "애매", "국가 확인", "제휴 확인"].map((label) =>
    group(page, label).locator(".lead-meta > span:last-child"));
  const snapshots = await Promise.all(untouched.map((statuses) => statuses.allTextContents()));
  const invalid = group(page, "무효");
  const expectedIds = await invalid.locator(".lead-meta > span:first-child").allTextContents();
  await invalid.getByRole("button", { name: "일괄 무효 처리" }).click();
  await expect(invalid.locator(".lead-meta > span:last-child").filter({ hasText: invalidState })).toHaveCount(11);
  for (const [index, statuses] of untouched.entries()) await expect(statuses).toHaveText(snapshots[index]);
  const recorded = await events(page);
  const disqualified = recorded.filter((event) => event.type === "decision" && event.action === "disqualify");
  expect(disqualified.map(({ leadId }) => leadId).sort()).toEqual([...expectedIds].sort());
  const projection = createForwardingStore({
    getItem: () => JSON.stringify({ version: FORWARDING_STORAGE_VERSION, events: recorded }),
    setItem: () => { throw new Error("Unexpected write to captured browser storage"); },
    removeItem: () => { throw new Error("Unexpected removal from captured browser storage"); },
  }).hydrate();
  expect(projection.ok).toBe(true);
  expect(Object.values(projection.state.leadStates).filter((lead) => lead.workflow === "disqualified")
    .map(({ leadId }) => leadId).sort()).toEqual([...expectedIds].sort());
});

test("S2-06 일괄 처리 뒤 L18만 다시 검토로 꺼낸다", async ({ page }) => {
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  await runAssessment(page);
  const invalid = group(page, "무효");
  await invalid.getByRole("button", { name: "일괄 무효 처리" }).click();
  await row(page, "L18").getByRole("button", { name: "다시 검토" }).click();
  await expect(status(page, "L18")).toHaveText("결정 대기");
  await expect(group(page, "애매").getByRole("listitem").filter({ hasText: /\bL18\b/u })).toHaveCount(1);
  await expect(invalid.locator(".lead-meta > span:last-child").filter({ hasText: invalidState })).toHaveCount(10);
  const reopened = (await events(page)).filter((event) => event.type === "review-reopened");
  expect(reopened.map(({ leadId }) => leadId)).toEqual(["L18"]);
});

test("S2-07 L01의 HTTP 500만 애매·재시도로 표시하고 다른 29건을 완료한다", async ({ page }) => {
  await page.route(assessUrl, async (route) => {
    const { leadId } = route.request().postDataJSON() as { leadId: string };
    if (leadId !== "L01") return route.continue();
    await route.fulfill({ status: 500, json: { error: "가상 서버 오류" } });
  });
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  await runAssessment(page);
  const ambiguous = group(page, "애매");
  await expect(ambiguous.getByRole("listitem").filter({ hasText: /\bL01\b/u })).toHaveCount(1);
  await row(page, "L01").getByRole("button", { name: /^L01/u }).click();
  await expect(card(page).getByText("외부 확인 실패, 다시 시도", { exact: true })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "외부 확인 다시 시도" })).toBeEnabled();
  const assessed = (await events(page)).filter((event) => event.type === "assessed");
  expect(assessed).toHaveLength(30);
  expect(assessed.filter((event) => event.assessment.details?.externalStatus === "failed").map(({ leadId }) => leadId))
    .toEqual(["L01"]);
});

test("S2-08 응답이 8초 넘게 없으면 그 리드만 외부 확인 실패로 바꾼다", async ({ page }) => {
  const requestStarted = Promise.withResolvers<void>();
  const responseGate = Promise.withResolvers<void>();
  await page.route(assessUrl, async (route) => {
    const { leadId } = route.request().postDataJSON() as { leadId: string };
    if (leadId !== "L01") return route.continue();
    requestStarted.resolve();
    await responseGate.promise;
    // Cleanup happens after the timeout assertion, without returning a success to the browser.
    await route.abort().catch(() => {});
  });
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  try {
    await runButton(page).click();
    await requestStarted.promise;
    await expect.poll(async () => (await events(page)).some((event) =>
      event.type === "assessed" && event.leadId === "L01" && event.assessment.details?.externalStatus === "failed"),
    { timeout: 10000, message: "응답하지 않는 L01은 8초 제한 뒤 실패로 기록된다" }).toBe(true);
    await expect(page.getByRole("button", { name: "다시 선별", exact: true })).toBeEnabled({ timeout: 30000 });
    const completed = (await events(page)).filter((event) => event.type === "assessed");
    expect(completed).toHaveLength(30);
    expect(completed.filter((event) => event.assessment.details?.externalStatus === "failed").map(({ leadId }) => leadId))
      .toEqual(["L01"]);
    await row(page, "L01").getByRole("button", { name: /^L01/u }).click();
    await expect(card(page).getByText("외부 확인 실패, 다시 시도", { exact: true })).toBeVisible();
    await expect(card(page).getByRole("button", { name: "외부 확인 다시 시도" })).toBeEnabled();
  } finally {
    responseGate.resolve();
  }
});

test("S2-09 선별 도중 새로고침하면 완료 건만 남고 중복 기록이 없다", async ({ page }) => {
  const gate = Promise.withResolvers<void>();
  await page.route(assessUrl, async (route) => {
    const { leadId } = route.request().postDataJSON() as { leadId: string };
    if (leadId === "L01") return route.continue();
    await gate.promise;
    await route.abort().catch(() => {});
  });
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  try {
    await runButton(page).click();
    await expect.poll(async () => (await events(page)).filter((event) => event.type === "assessed").map(({ leadId }) => leadId))
      .toEqual(["L01"]);
    await expect(page.getByRole("button", { name: "선별 중…", exact: true })).toBeDisabled();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(runButton(page)).toBeEnabled();
    await expect(group(page, "미선별").getByRole("listitem")).toHaveCount(29);
    await expect(group(page, "유효").getByRole("listitem").filter({ hasText: /\bL01\b/u })).toHaveCount(1);
    expect((await events(page)).filter((event) => event.type === "assessed").map(({ leadId }) => leadId)).toEqual(["L01"]);
  } finally {
    gate.resolve();
  }
});

test("S2-10 손상된 브라우저 저장값은 초기화 전까지 보존한다", async ({ page }) => {
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  const broken = "{invalid-json";
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: broken });
  await page.reload();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("저장된 시연 기록을 열 수 없습니다");
  await expect(runButton(page)).toBeDisabled();
  await page.getByRole("button", { name: "시연 초기화", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(broken);
  await page.getByRole("button", { name: "시연 초기화", exact: true }).click();
  await page.getByRole("button", { name: "초기화 확인", exact: true }).click();
  await expect(runButton(page)).toBeEnabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

test("S2-11 빈 기관은 무효이고 200자 기관명은 목록과 카드에서 줄인다", async ({ page }, testInfo) => {
  await page.goto("/inbox", { waitUntil: "domcontentloaded" });
  await runAssessment(page);
  await expect(row(page, "L15").getByText("소속 미기재", { exact: true })).toBeVisible();
  await expect(row(page, "L15").getByText("확인 가능한 소속 기관이 없습니다.", { exact: true })).toBeVisible();
  await expect(group(page, "무효").getByRole("listitem").filter({ hasText: /\bL15\b/u })).toHaveCount(1);

  await row(page, "L01").getByRole("button", { name: /^L01/u }).click();
  const listTitle = row(page, "L01").locator(".lead-button > strong");
  const cardTitle = card(page).getByRole("heading", { level: 2 });
  await expect(listTitle).toHaveAttribute("title", "서울대학교병원");
  await expect(cardTitle).toHaveAttribute("title", "서울대학교병원");
  const name = "긴기관명".repeat(50);
  expect(name).toHaveLength(200);
  // The seed has no 200-character institution. Change only the two rendered labels
  // to measure the production browser layout without replacing the approved data.
  const measurements = await Promise.all([listTitle, cardTitle].map((title) => title.evaluate((element, text) => {
    element.textContent = text;
    const node = element as HTMLElement;
    const { textOverflow, whiteSpace } = getComputedStyle(node);
    return { textOverflow, whiteSpace, clipped: node.scrollWidth > node.clientWidth };
  }, name)));
  await expect(listTitle).toHaveText(name);
  await expect(cardTitle).toHaveText(name);
  await screenshot(page, testInfo, "scene-2-long-institution");
  for (const measurement of measurements) {
    expect(measurement).toEqual({ textOverflow: "ellipsis", whiteSpace: "nowrap", clipped: true });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});
