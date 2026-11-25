import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  sendTestMail,
  type MailCode,
  type MailEnv,
  type SendGmail,
} from "./gmail-test-transport.server";
import { isConfirmationMail } from "./confirmation";
import { isMailKind, renderForwardingMail } from "./mail-template";
import leadRows from "./seed-leads.json";
import type { ForwardingEvent, MailKind, MailStatus } from "./types";

const outcomes: Record<MailCode, { status: MailStatus; message: string }> = {
  sent: { status: "sent", message: "테스트 메일 발송 완료" },
  "recipient-unset": { status: "failed", message: "테스트 수신함 미설정" },
  "recipient-blocked": { status: "blocked", message: "테스트 수신함 주소 검증 실패" },
  "sender-unset": { status: "failed", message: "Gmail 발신 설정 미완료" },
  "authentication-failed": { status: "failed", message: "Gmail SMTP 인증 실패" },
  "smtp-failed": { status: "failed", message: "Gmail SMTP 발송 실패" },
  "delivery-unknown": { status: "unknown", message: "전송 불명" },
};
const noEventMessages = {
  "invalid-request": "메일 요청을 확인할 수 없습니다.",
  "event-conflict": "같은 이벤트 ID에 다른 리드가 연결돼 있습니다.",
  "record-unavailable": "메일 발송 기록을 확인할 수 없습니다.",
};
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,119}$/;

export interface ForwardingMailRequest {
  /** Stable ID of the already accepted business event, unique within the demo. */
  eventId: string;
  leadId: string;
  kind: MailKind;
  /** Event ID from the most recent definite failure. Set only on a user retry. */
  retryOf?: string;
}

type MailEvent = Extract<ForwardingEvent, { type: "mail-delivery" }>;
type RecordedResult = { code: MailCode; message: string; event: MailEvent };
export type ForwardingMailResult = RecordedResult | {
  code: keyof typeof noEventMessages;
  message: string;
  event: null;
};
type Options = {
  directory: string;
  env?: () => MailEnv;
  send?: SendGmail;
  clock?: () => Date;
  log?: (code: MailCode, message: string) => void;
};
type Attempt = { leadId: string; at: string; code: MailCode };

function hasErrorCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function readAttempt(filename: string): Promise<Attempt | null> {
  let json: string;
  try {
    json = await readFile(filename, "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return null;
    throw error;
  }
  const attempt: Attempt = JSON.parse(json);
  if (typeof attempt?.leadId !== "string" || typeof attempt.at !== "string"
    || new Date(attempt.at).toISOString() !== attempt.at || !Object.hasOwn(outcomes, attempt.code)) {
    throw new Error("Invalid mail attempt");
  }
  return attempt;
}

function noEvent(code: keyof typeof noEventMessages): ForwardingMailResult {
  return { code, message: noEventMessages[code], event: null };
}

export function createForwardingMailService({
  directory,
  env = () => ({
    TEST_MAIL_TO: process.env.TEST_MAIL_TO,
    MAIL_FROM: process.env.MAIL_FROM,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  }),
  send,
  clock = () => new Date(),
  log = (code, message) => console.info("[forwarding-mail]", code, message),
}: Options) {
  const inFlight = new Map<string, { leadId: string; result: Promise<ForwardingMailResult> }>();

  async function dispatch(request: ForwardingMailRequest): Promise<ForwardingMailResult> {
    if (typeof request?.eventId !== "string" || !idPattern.test(request.eventId) || !isMailKind(request.kind)
      || (request.retryOf !== undefined && (typeof request.retryOf !== "string" || !idPattern.test(request.retryOf)))) {
      return noEvent("invalid-request");
    }
    const lead = leadRows.find((row) => row.id === request.leadId);
    if (!lead) return noEvent("invalid-request");
    const { eventId, kind, retryOf } = request;
    const leadId = lead.id;
    // A lead may be assessed in multiple tabs. Automatic confirmation uses one delivery per lead and kind.
    const dedupeId = isConfirmationMail(kind) ? leadId : eventId;
    const mailId = createHash("sha256").update(`${kind}\0${dedupeId}`).digest("hex");
    const ongoing = inFlight.get(mailId);
    if (ongoing) return ongoing.leadId === lead.id ? ongoing.result : noEvent("event-conflict");

    const rendered = renderForwardingMail(kind, lead);
    const result = run().catch(() => noEvent("record-unavailable"));
    inFlight.set(mailId, { leadId: lead.id, result });
    try {
      return await result;
    } finally {
      inFlight.delete(mailId);
    }

    async function run(): Promise<ForwardingMailResult> {
      const directoryForMail = join(directory, mailId);
      await mkdir(directoryForMail, { recursive: true });
      let last: RecordedResult | null = null;
      let number = 1;
      for (;; number += 1) {
        const existing = await readRecorded(directoryForMail, number);
        if (!existing) break;
        if (existing.event.leadId !== leadId) return noEvent("event-conflict");
        last = existing;
      }
      if (last && (last.event.status !== "failed" || retryOf !== last.event.id)) return last;
      if (!last && retryOf) return noEvent("invalid-request");

      // Record unknown before SMTP. A crash or concurrent request cannot trigger a duplicate.
      const pending: Attempt = { leadId: leadId, at: clock().toISOString(), code: "delivery-unknown" };
      const claim = join(directoryForMail, `${number}.pending.json`);
      try {
        await writeFile(claim, JSON.stringify(pending), { flag: "wx", mode: 0o600, flush: true });
      } catch (error) {
        if (!hasErrorCode(error, "EEXIST")) throw error;
        const rival = await readRecorded(directoryForMail, number);
        if (!rival) return noEvent("record-unavailable");
        return rival.event.leadId === leadId ? rival : noEvent("event-conflict");
      }

      const settings = env();
      const code = await sendTestMail(settings, { to: settings.TEST_MAIL_TO?.trim() ?? "" }, rendered, send);
      const settled: Attempt = { ...pending, at: clock().toISOString(), code };
      const filename = join(directoryForMail, `${number}.result.json`);
      try {
        await writeFile(`${filename}.tmp`, JSON.stringify(settled), { flag: "wx", mode: 0o600, flush: true });
        await rename(`${filename}.tmp`, filename);
      } catch {
        log(pending.code, outcomes[pending.code].message);
        return makeResult(pending, number, true);
      }
      log(code, outcomes[code].message);
      return makeResult(settled, number);
    }

    async function readRecorded(directoryForMail: string, number: number) {
      const settled = await readAttempt(join(directoryForMail, `${number}.result.json`));
      if (settled) return makeResult(settled, number);
      const pending = await readAttempt(join(directoryForMail, `${number}.pending.json`));
      return pending ? makeResult(pending, number, true) : null;
    }

    function makeResult({ code, leadId, at }: Attempt, number: number, pending = false): RecordedResult {
      const { message, status } = outcomes[code];
      return {
        code,
        message,
        event: {
          type: "mail-delivery",
          id: `mail:${mailId}:${number}${pending ? ":pending" : ""}`,
          leadId,
          at,
          mailId,
          kind,
          recipientKind: rendered.recipientKind,
          status,
        },
      };
    }
  }

  return { dispatch };
}

// Intended for a local Node.js server handling trusted forwarding business events.
export const dispatchForwardingMail = createForwardingMailService({
  directory: join(process.cwd(), ".forwarding-mail"),
}).dispatch;
