import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { createForwardingMailService } from "../src/lib/forwarding/forwarding-mail.server";
import { classifySmtpError, sendTestMail } from "../src/lib/forwarding/gmail-test-transport.server";
import { renderForwardingMail } from "../src/lib/forwarding/mail-template";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { applyForwardingEvent } from "../src/lib/forwarding/store";
import type { MailKind } from "../src/lib/forwarding/types";

const inbox = "qa@example.test";
const sender = "sender@example.test";
const env = { MAIL_FROM: sender, GMAIL_APP_PASSWORD: "fake app password", TEST_MAIL_TO: inbox };
const request = { eventId: "approve-demo-1", leadId: "L01", kind: "dealer-summary" } as const;
const state = createInitialForwardingState();
const lead = state.leads.find((row) => row.id === request.leadId)!;

async function tempDirectory(t: TestContext) {
  const root = resolve(".forwarding-mail");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "test-"));
  assert.ok(directory.startsWith(root + sep));
  t.after(async () => rm(directory, { force: true, recursive: true }));
  return directory;
}

test("test templates identify the intended role and omit lead contact details", () => {
  const labels: Record<MailKind, string> = {
    "dealer-summary": "딜러",
    "country-check": "리드",
    "partnership-check": "리드",
    "free-email-confirmation": "리드",
    "weak-intent-confirmation": "리드",
    "manager-confirmation": "지역 담당자",
    operations: "운영",
  };
  for (const [kind, label] of Object.entries(labels)) {
    const mail = renderForwardingMail(kind as MailKind, lead);
    assert.match(mail.subject, /^\[TEST\] L01 /);
    assert.equal(mail.text.split("\n")[0], `가상 리드 테스트 메일, 원래 수신자: ${label}`);
    if (kind === "partnership-check") assert.match(mail.text, /문의 기관의 소재지/);
    if (kind === "free-email-confirmation") assert.match(mail.text, /기관 공식 메일 주소로 회신/);
    if (kind === "weak-intent-confirmation") assert.match(mail.text, /구매 계획\(수량·시기·용도\)/);
    assert.ok(!mail.text.includes(lead.email));
    assert.ok(!mail.text.includes(lead.phone));
  }
});

test("the last transport boundary rejects addresses in To, Cc and Bcc, including seed lead address", async () => {
  let calls = 0;
  const transport = async () => {
    calls += 1;
    return "sent" as const;
  };
  const mail = renderForwardingMail(request.kind, lead);
  for (const recipients of [
    { to: lead.email },
    { to: inbox, cc: [lead.email] },
    { to: inbox, bcc: [inbox, lead.email] },
    { to: `${inbox}, ${lead.email}` },
    { to: `QA <${inbox}>` },
    { to: `${inbox}\r\nBcc: ${lead.email}` },
  ]) {
    assert.equal(await sendTestMail(env, recipients, mail, transport), "recipient-blocked");
  }
  assert.equal(await sendTestMail({ ...env, TEST_MAIL_TO: `${inbox}, ${lead.email}` }, { to: inbox }, mail, transport), "recipient-blocked");
  assert.equal(await sendTestMail({ ...env, TEST_MAIL_TO: "  " }, { to: inbox }, mail, transport), "recipient-unset");
  assert.equal(await sendTestMail({ ...env, MAIL_FROM: "" }, { to: inbox }, mail, transport), "sender-unset");
  assert.equal(calls, 0);

  assert.equal(await sendTestMail(env, { to: inbox, cc: [inbox], bcc: [inbox] }, mail, async (settings, to, message) => {
    assert.equal(settings.from, sender);
    assert.equal(to, inbox);
    assert.equal(message.subject, mail.subject);
    return transport();
  }), "sent");
  assert.equal(calls, 1);
});

test("SMTP reports authentication, definite rejection and ambiguous disconnects separately", () => {
  assert.equal(classifySmtpError({ code: "EAUTH", responseCode: 535 }), "authentication-failed");
  assert.equal(classifySmtpError({ code: "EENVELOPE", responseCode: 550, command: "RCPT TO" }), "smtp-failed");
  assert.equal(classifySmtpError({ code: "ETIMEDOUT", command: "DATA" }), "delivery-unknown");
  assert.equal(classifySmtpError({ code: "ECONNECTION", command: "DATA" }), "delivery-unknown");
  assert.equal(classifySmtpError({ code: "EMESSAGE", responseCode: 451, command: "DATA" }), "smtp-failed");
  assert.equal(classifySmtpError({ code: "ECONNECTION", responseCode: 421, command: "CONN" }), "delivery-unknown");
  assert.equal(classifySmtpError({ code: "EDNS", command: "CONN" }), "smtp-failed");
});

test("concurrent duplicate requests and a new service instance reuse one business-event attempt", async (t) => {
  const directory = await tempDirectory(t);
  const logged: string[] = [];
  let calls = 0;
  const options = {
    directory, env: () => env,
    log: (code: string, message: string) => logged.push(`${code} ${message}`),
    send: async () => {
      calls += 1;
      return "sent" as const;
    },
  };
  const service = createForwardingMailService(options);
  const [first, second] = await Promise.all([service.dispatch(request), service.dispatch(request)]);
  assert.deepEqual(first, second);
  assert.equal(first.code, "sent");

  const restored = createForwardingMailService(options);
  assert.deepEqual(await restored.dispatch(request), first);
  assert.equal((await restored.dispatch({ ...request, leadId: "L02" })).code, "event-conflict");
  assert.equal(calls, 1);

  assert.ok(first.event);
  assert.equal(applyForwardingEvent(state, first.event).ok, true);
  const mailDirectory = join(directory, first.event.mailId);
  const records = await Promise.all((await readdir(mailDirectory)).map((filename) => readFile(join(mailDirectory, filename), "utf8")));
  for (const output of [JSON.stringify(first), ...logged, ...records]) {
    for (const value of [...Object.values(env), lead.email]) assert.ok(!output.includes(value), "mail output must omit configuration and addresses");
  }
});

test("separate mail kinds for one business event each deliver only to the configured mailbox", async (t) => {
  const directory = await tempDirectory(t);
  const mailboxes: string[] = [];
  const service = createForwardingMailService({
    directory, env: () => env, log: () => {},
    send: async (_settings, mailbox, message) => {
      mailboxes.push(mailbox);
      for (const value of [lead.email, lead.phone, inbox, sender]) assert.ok(!message.text.includes(value));
      return "sent";
    },
  });
  const kinds: MailKind[] = ["dealer-summary", "country-check", "partnership-check", "manager-confirmation", "operations"];
  const first = await Promise.all(kinds.map((kind) => service.dispatch({ ...request, kind })));
  const duplicate = await Promise.all(kinds.map((kind) => service.dispatch({ ...request, kind })));
  assert.deepEqual(first, duplicate);
  assert.deepEqual(mailboxes, kinds.map(() => inbox));
  assert.equal(new Set(first.map((row) => row.event?.id)).size, 5);
});

test("automatic confirmation deduplicates the same lead and reason even across assessment events", async (t) => {
  const directory = await tempDirectory(t);
  const mailboxes: string[] = [];
  const service = createForwardingMailService({
    directory, env: () => env, log: () => {},
    send: async (_settings, mailbox) => {
      mailboxes.push(mailbox);
      return "sent";
    },
  });
  const first = { eventId: "first-assessment", leadId: "L08", kind: "free-email-confirmation" } as const;
  const second = { ...first, eventId: "second-assessment" };
  const [one, two] = await Promise.all([service.dispatch(first), service.dispatch(second)]);
  assert.equal(one.code, "sent");
  assert.deepEqual(two, one);
  assert.deepEqual(mailboxes, [inbox]);
});

test("original and replacement dealer summaries for one lead each send once to the sole test inbox", async (t) => {
  const directory = await tempDirectory(t);
  const mailboxes: string[] = [];
  const options = {
    directory, env: () => env, log: () => {},
    send: async (_settings: unknown, mailbox: string) => {
      mailboxes.push(mailbox);
      return "sent" as const;
    },
  };
  const first = createForwardingMailService(options);
  const original = await first.dispatch(request);
  const replacementRequest = { ...request, eventId: "reassign-demo-1" };
  const replacement = await first.dispatch(replacementRequest);
  assert.equal(original.code, "sent");
  assert.equal(replacement.code, "sent");
  assert.notEqual(original.event?.mailId, replacement.event?.mailId);

  const restored = createForwardingMailService(options);
  assert.deepEqual(await restored.dispatch(request), original);
  assert.deepEqual(await restored.dispatch(replacementRequest), replacement);
  assert.deepEqual(mailboxes, [inbox, inbox]);
});

test("missing settings and authentication failure return UI-safe statuses and permit one explicit retry per failed attempt", async (t) => {
  const directory = await tempDirectory(t);
  let ready = false;
  let calls = 0;
  const service = createForwardingMailService({
    directory, env: () => ready ? env : {}, log: () => {},
    send: async () => {
      calls += 1;
      if (calls === 1) throw { code: "EAUTH", message: `private response for ${sender}` };
      return "sent";
    },
  });
  const first = await service.dispatch(request);
  assert.equal(first.message, "테스트 수신함 미설정");
  assert.equal(calls, 0);
  ready = true;
  assert.deepEqual(await service.dispatch(request), first);

  assert.ok(first.event);
  const failed = await service.dispatch({ ...request, retryOf: first.event.id });
  assert.equal(failed.message, "Gmail SMTP 인증 실패");
  assert.equal(failed.event?.status, "failed");
  assert.ok(!JSON.stringify(failed).includes(sender));
  assert.deepEqual(await service.dispatch({ ...request, retryOf: first.event.id }), failed);

  assert.ok(failed.event);
  const retry = { ...request, retryOf: failed.event.id };
  const [delivered, duplicate] = await Promise.all([service.dispatch(retry), service.dispatch(retry)]);
  assert.deepEqual(delivered, duplicate);
  assert.equal(delivered.event?.status, "sent");
  assert.equal(calls, 2);
});

test("a send timeout records unknown and blocks both automatic and explicit retry after restoration", async (t) => {
  const directory = await tempDirectory(t);
  let calls = 0;
  const options = {
    directory, env: () => env, log: () => {},
    send: async () => {
      calls += 1;
      throw { code: "ETIMEDOUT", command: "DATA" };
    },
  };
  const timedOut = await createForwardingMailService(options).dispatch(request);
  assert.equal(timedOut.message, "전송 불명");
  assert.equal(timedOut.event?.status, "unknown");
  assert.ok(timedOut.event);

  const restored = createForwardingMailService(options);
  assert.deepEqual(await restored.dispatch(request), timedOut);
  assert.deepEqual(await restored.dispatch({ ...request, retryOf: timedOut.event.id }), timedOut);
  assert.equal(calls, 1);
});

test("an interrupted send cannot be repeated by another server instance", async (t) => {
  const directory = await tempDirectory(t);
  let calls = 0;
  let finishSend: () => void = () => {};
  let markStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const blockedSend = new Promise<void>((resolve) => { finishSend = resolve; });
  const options = {
    directory, env: () => env, log: () => {},
    send: async () => {
      calls += 1;
      markStarted();
      await blockedSend;
      return "sent" as const;
    },
  };
  const original = createForwardingMailService(options);
  const pending = original.dispatch(request);
  await started;
  const another = createForwardingMailService(options);
  const recovered = await another.dispatch(request);
  finishSend();
  const completed = await pending;
  assert.equal(recovered.event?.status, "unknown");
  assert.equal(completed.event?.status, "sent");
  assert.notEqual(recovered.event?.id, completed.event?.id);
  assert.equal(calls, 1);
});

test("unknown leads and arbitrary event IDs cannot reach transport", async (t) => {
  const directory = await tempDirectory(t);
  const service = createForwardingMailService({
    directory, env: () => env,
    send: async () => assert.fail("invalid request cannot call transport"),
  });
  assert.equal((await service.dispatch({ ...request, leadId: "L00" })).code, "invalid-request");
  assert.equal((await service.dispatch({ ...request, eventId: "../outside" })).code, "invalid-request");
  assert.deepEqual(await readdir(directory), []);
});
