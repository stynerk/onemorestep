"use client";

import { useRef } from "react";
import { confirmedCountry } from "../../../lib/forwarding/inbox";
import { useAppWorkspace } from "../../app-workspace";
import { DirectionPanel } from "../../forwarding/direction-panel";

export default function InboxFeedbackPage() {
  const { inbox, industry } = useAppWorkspace();
  const title = useRef<HTMLHeadingElement>(null);
  const { state } = inbox;
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
    </div>
  </main>;
}
