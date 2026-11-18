import { createTransport } from "nodemailer";

export type MailCode =
  | "sent"
  | "recipient-unset"
  | "recipient-blocked"
  | "sender-unset"
  | "authentication-failed"
  | "smtp-failed"
  | "delivery-unknown";

export type MailRecipients = { to: string; cc?: string[]; bcc?: string[] };
export type MailEnv = { TEST_MAIL_TO?: string; MAIL_FROM?: string; GMAIL_APP_PASSWORD?: string };
export type GmailSettings = { from: string; appPassword: string };
export type TestMailMessage = { subject: string; text: string };

// Plain mailbox only. Display names, address lists and mail header syntax are rejected.
export function isMailbox(value: string) {
  return value.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

export function isOnlyTestMailbox(recipients: MailRecipients, testMailbox: string) {
  return isMailbox(testMailbox) && recipients.to === testMailbox
    && (recipients.cc ?? []).every((address) => address === testMailbox)
    && (recipients.bcc ?? []).every((address) => address === testMailbox);
}

export function classifySmtpError(error: unknown): MailCode {
  if (typeof error !== "object" || error === null) return "delivery-unknown";
  const fields = error as { code?: string; responseCode?: number; command?: string };
  if (fields.code === "EAUTH" || fields.code === "ENOAUTH") return "authentication-failed";
  if (fields.code === "ETIMEDOUT" || fields.code === "EABORT" || fields.code === "ABORT_ERR") return "delivery-unknown";
  const command = fields.command ?? "";
  if (command === "DATA" && fields.responseCode !== undefined && fields.responseCode >= 400 && fields.responseCode < 600) return "smtp-failed";
  // Nodemailer can report CONN for a disconnect during DATA. Only named pre-DATA phases are definitive.
  if (fields.code === "EDNS" || /^(EHLO|HELO|STARTTLS|AUTH(?: .*)?|MAIL FROM|RCPT TO)$/.test(command)) return "smtp-failed";
  return "delivery-unknown";
}

export type SendGmail = (settings: GmailSettings, mailbox: string, message: TestMailMessage) => Promise<MailCode>;

async function sendGmail({ from, appPassword }: GmailSettings, mailbox: string, message: TestMailMessage): Promise<MailCode> {
  const transport = createTransport({
    host: "smtp.gmail.com",
    port: 587,
    requireTLS: true,
    auth: { user: from, pass: appPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    const response = await transport.sendMail({
      from,
      to: mailbox,
      envelope: { from, to: [mailbox] },
      subject: message.subject,
      text: message.text,
      signal: AbortSignal.timeout(25_000),
    });
    if (response.accepted.length === 1 && response.rejected.length === 0) return "sent";
    return response.rejected.length === 1 && response.accepted.length === 0 ? "smtp-failed" : "delivery-unknown";
  } catch (error) {
    return classifySmtpError(error);
  } finally {
    transport.close();
  }
}

/** Only the configured mailbox can reach the SMTP envelope. The send adapter receives no CC or BCC. */
export async function sendTestMail(
  env: MailEnv,
  recipients: MailRecipients,
  message: TestMailMessage,
  send: SendGmail = sendGmail,
): Promise<MailCode> {
  const mailbox = env.TEST_MAIL_TO?.trim();
  if (!mailbox) return "recipient-unset";
  if (!isOnlyTestMailbox(recipients, mailbox)) return "recipient-blocked";

  const from = env.MAIL_FROM?.trim();
  const appPassword = env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!from || !isMailbox(from) || !appPassword) return "sender-unset";

  try {
    return await send({ from, appPassword }, mailbox, message);
  } catch (error) {
    return classifySmtpError(error);
  }
}
