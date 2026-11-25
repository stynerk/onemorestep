"use client";

import { useRef, useState } from "react";
import { confirmationReply } from "../../../lib/forwarding/confirmation";
import { automaticConfirmationForLead, confirmedCountry } from "../../../lib/forwarding/inbox";
import type { AutomaticConfirmation, LeadInput } from "../../../lib/forwarding/types";
import { useAppWorkspace } from "../../app-workspace";
import { DirectionPanel } from "../../forwarding/direction-panel";

export default function InboxFeedbackPage() {
  const { inbox, industry } = useAppWorkspace();
  const title = useRef<HTMLHeadingElement>(null);
  const { state } = inbox;
  const confirmationRows = inbox.confirmationLeads.flatMap((lead) => {
    const kind = automaticConfirmationForLead(state, lead);
    return kind ? [{ lead, kind }] : [];
  });
  const rows = inbox.directionLeads.flatMap((lead) => {
    const assessment = state.leadStates[lead.id].assessment;
    const country = confirmedCountry(state, lead.id);
    return assessment ? [{ lead: country ? { ...lead, country } : lead, assessment }] : [];
  });

  return <main className="workspace triage-workspace inbox-feedback">
    <header className="masthead triage-toolbar"><h1 ref={title} tabIndex={-1}>피드백 요청</h1><p className="muted">{industry.label}</p></header>
    <div className="workspace-inner">
      {inbox.error && <p className="feedback" role="alert">{inbox.error}</p>}
      <DirectionPanel rows={rows} isPending={(id) => inbox.pending.includes(id)}
        answeringDisabled={!inbox.ready || inbox.running} onAnswer={(lead, answer) => {
          if (inbox.answerDirection(lead, answer)) title.current?.focus({ preventScroll: true });
        }} />
      <section className="direction-panel confirmation-panel" aria-labelledby="automatic-confirmation-title">
        <h2 id="automatic-confirmation-title">자동 확인 메일 대기 {confirmationRows.length}건</h2>
        {confirmationRows.length > 0 ? <>
          {inbox.publicDemo && <p className="muted">공개 시연에서는 메일을 보내지 않습니다. 받은 회신은 기록할 수 있습니다.</p>}
          <ul className="direction-list">
            {confirmationRows.map(({ lead, kind }) => <ConfirmationReply key={lead.id + "-" + kind} lead={lead} kind={kind}
              disabled={!inbox.ready || inbox.running || inbox.pending.includes(lead.id)}
              onReply={async (text) => {
                const success = await inbox.saveConfirmationReply(lead, kind, text);
                if (success) title.current?.focus({ preventScroll: true });
                return success;
              }} />)}
          </ul>
        </> : <p className="muted" role="status">회신을 기다리는 문의가 없습니다.</p>}
      </section>
    </div>
  </main>;
}

function ConfirmationReply({ lead, kind, disabled, onReply }: {
  lead: LeadInput;
  kind: AutomaticConfirmation;
  disabled: boolean;
  onReply: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [invalidEmail, setInvalidEmail] = useState(false);
  const titleId = "confirmation-" + lead.id + "-title";
  const freeEmail = kind === "free-email";

  return <li className="direction-lead" id={"confirmation-" + lead.id} aria-labelledby={titleId}>
    <h3 id={titleId}>{lead.id} {lead.institution || "소속 미기재"}</h3>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (disabled || !text.trim()) return;
      if (freeEmail && !confirmationReply({ kind, text })) {
        setInvalidEmail(true);
        return;
      }
      if (await onReply(text.trim())) setText("");
    }}>
      <fieldset disabled={disabled}>
        <label className="direction-note">{freeEmail ? "회신한 기관 공식 이메일" : "회신한 구매 계획(수량·시기·용도)"}
          {freeEmail ? <input type="email" required maxLength={254} value={text} aria-invalid={invalidEmail || undefined}
            aria-describedby={invalidEmail ? titleId + "-email-error" : undefined} onChange={(event) => {
              setText(event.target.value);
              setInvalidEmail(false);
            }} />
            : <textarea required rows={3} maxLength={400} value={text} onChange={(event) => setText(event.target.value)} />}
        </label>
        {invalidEmail && <p id={titleId + "-email-error"} role="alert">무료 이메일 대신 기관 공식 이메일을 입력해 주세요.</p>}
        <button type="submit" className="button button-primary" disabled={!text.trim()}>회신 기록 및 다시 선별</button>
      </fieldset>
    </form>
  </li>;
}
