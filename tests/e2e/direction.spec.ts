import { expect, test, type Page } from "@playwright/test";
import type { Assessment } from "../../src/lib/forwarding/types";

const publicUrl = "http://127.0.0.1:3150";
const card = (page: Page) => page.getByRole("article");
const feedback = (page: Page) => page.getByRole("link", { name: "피드백 요청", exact: true });
const row = (page: Page, id: string) => page.locator(".direction-lead").filter({
  has: page.getByRole("heading", { name: new RegExp("^" + id + " ") }),
});
const chooseLead = async (page: Page, id: string) => {
  await page.getByRole("button", { name: new RegExp("^" + id + " ") }).click();
  await card(page).getByRole("button", { name: "이 문의 선별", exact: true }).click();
};

test("의료기기 사칭 의심을 담당자가 확인하면 근거와 기존 딜러 추천이 나온다", async ({ page }) => {
  await page.goto(publicUrl + "/inbox", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "선별 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "다시 선별", exact: true })).toBeEnabled();
  await expect(feedback(page)).toContainText("6");
  await feedback(page).click();
  const panel = page.getByRole("region", { name: "방향이 필요한 리드 6건" });
  await expect(panel.locator(".direction-lead")).toHaveCount(6);
  await expect(row(page, "L17")).toHaveCount(0);
  const inquiry = row(page, "L29");
  await expect(inquiry.getByRole("link").first()).toBeVisible();
  await inquiry.getByRole("radio", { name: "정상 고객으로 진행" }).check();
  await inquiry.getByRole("textbox", { name: "답변 메모" }).fill("대표 연락처로 확인함");
  await inquiry.getByRole("button", { name: "답변 반영" }).click();
  await expect(row(page, "L29")).toHaveCount(0);
  await expect(feedback(page)).toContainText("5");
  await page.getByRole("link", { name: "전체 문의", exact: true }).click();
  await expect(card(page).getByText("유효", { exact: true })).toBeVisible();
  await expect(card(page).getByRole("heading", { name: "추천 딜러" })).toBeVisible();
  await expect(card(page).getByText("담당자 확인", { exact: true })).toBeVisible();
  await expect(card(page).getByText("대표 연락처로 확인함")).toBeVisible();
  await expect(card(page).locator("time[datetime]").last()).toHaveAttribute("datetime", /T/);
  const mail = await page.request.post(publicUrl + "/api/forwarding/mail", {
    headers: { Origin: publicUrl }, data: {},
  });
  expect(mail.status()).toBe(403);
});

test("같은 기관과 도메인의 다음 SaaS 문의는 새로고침 뒤에도 이전 답을 재사용한다", async ({ page }) => {
  // The fixed demo has no pair with the same eligible domain. Substitute only the browser's copy of the two leads.
  const domain = "vendor.de";
  const firstEmail = "mrn-saas-04@gmail.com";
  const secondEmail = "mrn-saas-09@siemens-procurement.test";
  await page.addInitScript(({ domain, firstEmail, secondEmail }) => {
    // Test only. Swap these two serialized lead props before React consumes Next's streamed data.
    const secondInstitution = /Siemens AG(?=[^;]{0,60}mrn-saas-09@siemens-procurement\.test)/gu;
    const paddedLocal = "mrn-saas-09".padEnd(secondEmail.length - domain.length - 1, "x");
    const queue: unknown[] = [];
    let push = queue.push.bind(queue);
    Object.defineProperty(queue, "push", {
      get: () => (...entries: unknown[]) => push(...entries.map((entry) => {
        if (!Array.isArray(entry) || entry[0] !== 1 || typeof entry[1] !== "string") return entry;
        const data = entry[1].replaceAll(secondInstitution, "BASF    SE")
          .replaceAll(firstEmail, "mrn-saas-04@" + domain)
          .replaceAll(secondEmail, paddedLocal + "@" + domain);
        return [entry[0], data];
      })),
      set: (callback: typeof push) => { push = callback; },
    });
    Reflect.set(window, "__next_f", queue);
  }, { domain, firstEmail, secondEmail });
  await page.route("**/api/forwarding/assess", async (route) => {
    const { leadId } = route.request().postDataJSON() as { leadId: string };
    if (leadId !== "I04" && leadId !== "I09") return route.continue();
    const assessment: Assessment = {
      verdict: "ambiguous", mode: "saved", reason: "이메일 도메인과 기관의 관계를 확인하지 못했어요.",
      searchedAt: "2026-11-22T00:00:00.000Z", sources: ["https://www.basf.com/global/en.html"],
      handoff: { kind: "regional-sales", region: "EU" },
      details: { domain: "unverified", countries: ["독일"], industry: null, memoIntent: "buying", memoQuote: null,
        externalStatus: "complete", sourceKind: "cache" },
    };
    await route.fulfill({ json: { leadId, assessment, workflow: "decision-pending" } });
  });
  await page.goto(publicUrl + "/inbox", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "선별 시작", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "B2B SaaS" }).click();
  await expect(page.getByRole("button", { name: /^I09 .*BASF SE/ })).toBeVisible();
  await chooseLead(page, "I04");
  await expect(feedback(page)).toContainText("1");
  await feedback(page).click();
  const first = row(page, "I04");
  await expect(first.getByRole("group", { name: new RegExp(domain.replaceAll(".", "\\.")) })).toBeVisible();
  await first.getByRole("radio", { name: "맞다", exact: true }).check();
  await first.getByRole("button", { name: "답변 반영" }).click();
  await page.getByRole("link", { name: "전체 문의", exact: true }).click();
  await expect(card(page).getByText("담당자 확인", { exact: true })).toBeVisible();
  await expect(card(page).getByRole("heading", { name: "추천 파트너" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "B2B SaaS" })).toHaveAttribute("aria-pressed", "true");
  await chooseLead(page, "I09");
  await expect(card(page).getByText("유효", { exact: true })).toBeVisible();
  await expect(card(page).getByText("이전 담당자 확인", { exact: true })).toBeVisible();
  await expect(card(page).getByRole("heading", { name: "추천 파트너" })).toBeVisible();
  await expect(feedback(page)).not.toContainText("1");

  await page.getByRole("button", { name: "시연 초기화", exact: true }).click();
  await page.getByRole("button", { name: "초기화 확인", exact: true }).click();
  await chooseLead(page, "I09");
  await expect(feedback(page)).toContainText("1");
});
