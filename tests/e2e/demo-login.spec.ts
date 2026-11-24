import { expect, test, type Page } from "@playwright/test";
import { assessLead, leadRow, storedEvents } from "./scene-5-helper";

const publicBaseUrl = "http://127.0.0.1:3150";
const loginUrl = publicBaseUrl + "/login";
const inboxUrl = publicBaseUrl + "/inbox";
const demoId = "medicom";
const demoPassword = "\u0031\u0032\u0033\u0034\u0021";

test.use({ storageState: { cookies: [], origins: [] } });

async function submitLogin(page: Page, password = demoPassword) {
  await page.getByLabel("ID", { exact: true }).fill(demoId);
  await page.getByLabel("PW", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}

test("공개 시연의 직접 진입, 로그인 유지와 로그아웃 이후 선별 기록을 확인한다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(publicBaseUrl);
  await expect(page).toHaveURL(loginUrl);
  await expect(page.getByRole("heading", { name: "One More Step", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "문의함", exact: true })).toHaveCount(0);

  for (const path of ["/inbox", "/inbox/status", "/inbox/feedback", "/marketing", "/marketing/campaigns", "/research"]) {
    await page.goto(publicBaseUrl + path);
    await expect(page).toHaveURL(loginUrl);
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
  }

  await submitLogin(page);
  await expect(page).toHaveURL(inboxUrl);
  await expect(page.getByRole("heading", { name: "문의함", exact: true })).toBeVisible();
  await assessLead(page, "L01", inboxUrl);
  await expect.poll(() => storedEvents(page, "L01", "assessed")).toEqual([
    expect.objectContaining({ assessment: expect.objectContaining({ verdict: "valid", mode: "saved" }) }),
  ]);

  await page.reload();
  await expect(page).toHaveURL(inboxUrl);
  await expect(leadRow(page, "L01")).toContainText("유효");
  await page.getByRole("link", { name: "마케팅 요청", exact: true }).click();
  await expect(page).toHaveURL(publicBaseUrl + "/marketing");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(loginUrl);

  await page.goto(publicBaseUrl + "/marketing");
  await expect(page).toHaveURL(loginUrl);
  await submitLogin(page);
  await expect(page).toHaveURL(inboxUrl);
  await expect(leadRow(page, "L01")).toContainText("유효");
});

test("틀린 시연 값에는 오류를 안내하고 보호 화면 접근을 막는다", async ({ page }) => {
  await page.goto(loginUrl);
  await submitLogin(page, "incorrect-demo-value");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("ID 또는 비밀번호가 맞지 않습니다.");
  await expect(page).toHaveURL(loginUrl);
  await page.goto(publicBaseUrl + "/marketing");
  await expect(page).toHaveURL(loginUrl);
});

test("회원 가입과 비밀번호 찾기는 같은 시연 계정 안내 팝업을 연다", async ({ page }) => {
  await page.goto(loginUrl);
  const dialog = page.getByRole("dialog", { name: "시연 계정 안내" });
  const signup = page.getByRole("button", { name: "회원 가입", exact: true });
  const recover = page.getByRole("button", { name: "비밀번호 찾기", exact: true });
  for (const trigger of [signup, recover]) {
    await trigger.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("현재는 테스트 기간이므로 아래 계정으로 로그인해주세요");
    await expect(dialog).toContainText(demoId);
    await expect(dialog).toContainText(demoPassword);
    if (trigger === signup) {
      await page.keyboard.press("Escape");
    } else {
      await dialog.getByRole("button", { name: "닫기", exact: true }).press("Enter");
    }
    await expect(dialog).toBeHidden();
  }
});
