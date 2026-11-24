"use client";

import Link from "next/link";
import { useAppWorkspace } from "../../app-workspace";
import { dealerFilters, handoffFilters, inboxFilterLabel, inboxFilterPath, inboxGroups, inboxRows, matchesInboxFilter, type InboxFilter } from "../../forwarding/inbox-view";

export default function InboxStatusPage() {
  const { inbox, industry, href } = useAppWorkspace();
  const rows = inboxRows(inbox.state, inbox.responseNow);
  const count = (filter: InboxFilter) => rows.filter((row) => matchesInboxFilter(row, filter)).length;
  const assessed = count("assessed");
  const summary = (filter: InboxFilter) => <li key={filter}>
    <Link href={href(inboxFilterPath(filter))}><span>{inboxFilterLabel[filter]}</span> <strong>{count(filter)}</strong></Link>
  </li>;

  return <main className="workspace triage-workspace inbox-report">
    <header className="masthead triage-toolbar"><h1>선별 현황</h1><p className="muted">{industry.label}</p></header>
    <div className="workspace-inner">
      {inbox.error && <p className="feedback" role="alert">{inbox.error}</p>}
      <section className="inbox-report-section" aria-labelledby="assessment-progress-title">
        <h2 id="assessment-progress-title">선별 진행</h2>
        <progress value={assessed} max={rows.length} aria-label="선별 완료 건수" />
        <ul className="inbox-report-counts">
          {summary("assessed")}
          {summary("new")}
        </ul>
      </section>
      <section className="inbox-report-section" aria-labelledby="assessment-result-title">
        <h2 id="assessment-result-title">선별 결과</h2>
        <ul className="inbox-report-counts">{inboxGroups.filter((filter) => filter !== "new").map(summary)}</ul>
      </section>
      <section className="inbox-report-section" aria-labelledby="handoff-counts-title">
        <h2 id="handoff-counts-title">넘길 곳</h2>
        <ul className="inbox-report-counts">{handoffFilters.map(summary)}</ul>
      </section>
      <section className="inbox-report-section" aria-labelledby="dealer-status-title">
        <h2 id="dealer-status-title">딜러 처리</h2>
        <ul className="inbox-report-counts">{dealerFilters.map(summary)}</ul>
      </section>
    </div>
  </main>;
}
