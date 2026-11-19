import { expect, type Page, type TestInfo } from "@playwright/test";
import { createForwardingMailService } from "../../src/lib/forwarding/forwarding-mail.server";
import { type MailEnv, type SendGmail } from "../../src/lib/forwarding/gmail-test-transport.server";
import { mailKindFor } from "../../src/lib/forwarding/inbox";
import { FORWARDING_STORAGE_KEY } from "../../src/lib/forwarding/store";
import type { ForwardingEvent } from "../../src/lib/forwarding/types";

export const mailPath = "/api/forwarding/mail";
export const testMailbox = "scene5-qa@example.test";
export const testMailEnv = {
  TEST_MAIL_TO: testMailbox,
  MAIL_FROM: "scene5-sender@example.test",
  GMAIL_APP_PASSWORD: "dummy fixture only",
};

type MailPayload = { event: ForwardingEvent; retryOf?: string };

export function leadRow(page: Page, leadId: "L01" | "L06") {
  return page.getByRole("button", { name: new RegExp(`^${leadId}\\b`) });
}

export async function assessLead(page: Page, leadId: "L01" | "L06", home = "/") {
  await page.goto(home);
  await leadRow(page, leadId).click();
  const card = page.getByRole("article", { name: leadId === "L01" ? "서울대학교병원" : "Singapore General Hospital" });
  await card.getByRole("button", { name: "이 문의 판정", exact: true }).click();
  await expect(card.getByRole("heading", { name: "판정 근거" })).toBeVisible();
  return card;
}

export async function storedEvents(page: Page, leadId: "L01" | "L06", type: ForwardingEvent["type"]) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), FORWARDING_STORAGE_KEY);
  const events: ForwardingEvent[] = raw ? JSON.parse(raw).events : [];
  return events.filter((event) => event.leadId === leadId && event.type === type);
}

export async function mockMail(
  page: Page,
  testInfo: TestInfo,
  options: { env?: MailEnv; send?: SendGmail } = {},
) {
  const requests: MailPayload[] = [];
  const mailboxes: string[] = [];
  const service = createForwardingMailService({
    directory: testInfo.outputPath("mock-mail-ledger"),
    env: () => options.env ?? testMailEnv,
    log: () => {},
    send: async (...input) => {
      const [, mailbox] = input;
      mailboxes.push(mailbox);
      return options.send ? await options.send(...input) : "sent";
    },
  });

  await page.route("**" + mailPath, async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    const payload = request.postDataJSON() as MailPayload;
    requests.push(payload);
    const { event, retryOf } = payload;
    const kind = mailKindFor(event);
    if (!kind) {
      await route.fulfill({ status: 400, json: { message: "Mock mail has no business event" } });
      return;
    }
    const result = await service.dispatch({ eventId: event.id, leadId: event.leadId, kind, retryOf });
    await route.fulfill({
      status: result.event ? 200 : 409,
      json: result.event ? { ...result, event: { ...result.event, causeEventId: event.id } } : result,
    });
  });
  return { requests, mailboxes };
}
