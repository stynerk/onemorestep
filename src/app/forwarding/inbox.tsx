"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { isAvailableIndustry } from "../../lib/forwarding/industry-demo";
import { inboxOrder } from "../../lib/forwarding/inbox";
import { forwardingPolicy } from "../../lib/forwarding/policy";
import { useAppWorkspace } from "../app-workspace";
import { DecisionCard } from "./decision-card";
import { handoffLabel } from "./handoff-label";
import { inboxFilterLabel, inboxFilterPath, inboxGroups, inboxRows, matchesInboxFilter, readInboxFilter, type InboxGroup } from "./inbox-view";

const rowState = {
  new: "미선별", "decision-pending": "결정 대기", "reply-pending": "회신 대기",
  "manager-confirmation-pending": "담당자 확인", "manager-direct-pending": "담당자 직접 처리", "dealer-assigned": "딜러 배정",
  connected: "결과 기록", disqualified: "처리 완료",
};

function elapsedSince(receivedAt: string, now: number) {
  if (!now) return "—";
  const hours = Math.max(0, Math.floor((now - Date.parse(receivedAt)) / 3_600_000));
  return hours < 24 ? `${hours}시간` : `${Math.floor(hours / 24)}일`;
}

export default function Inbox() {
  const { busy, inbox, industry, publicDemo, industries, chooseIndustry, href } = useAppWorkspace();
  const filter = readInboxFilter(useSearchParams().get("filter"));
  const leadList = useRef<HTMLDivElement>(null);
  const wasRunning = useRef(false);
  const { state } = inbox;
  const unavailable = industries.find((option) => !isAvailableIndustry(option));
  const rows = inboxRows(state, inbox.responseNow);
  const byLead = new Map(rows.map((row) => [row.lead.id, row]));
  const visibleRows = rows.filter((row) => matchesInboxFilter(row, filter));
  const shown = inboxGroups.filter((group) => filter === "all" || filter === group || visibleRows.some((row) => row.group === group));
  const groups = shown.map((group) => {
    const bucket = group === "new" ? null : group;
    const leads = visibleRows.filter((row) => row.group === group).map((row) => row.lead);
    const ordered = inboxOrder(leads, bucket, industry.id === "medicom" ? "L06" : null);
    return { group, leads: ordered.sort((a, b) => Number(byLead.get(b.id)?.reassignment) - Number(byLead.get(a.id)?.reassignment)) };
  });
  const selected = visibleRows.find(({ lead }) => lead.id === inbox.selected)?.lead ?? (filter === "all" ? undefined : groups.find(({ leads }) => leads.length)?.leads[0]);
  const assessed = rows.filter((row) => row.group !== "new").length;
  const canBulk = visibleRows.some(({ group, lead }) => group === "invalid" && state.leadStates[lead.id].workflow !== "disqualified");
  const directionIds = new Set(inbox.directionLeads.map((lead) => lead.id));

  useEffect(() => {
    const completed = wasRunning.current && !inbox.running;
    wasRunning.current = inbox.running;
    if (!completed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    leadList.current?.querySelectorAll<HTMLElement>('.lead:not([data-group="new"])').forEach((row) => {
      row.animate([{ transform: "translateY(4px)", opacity: 0.86 }, { transform: "none", opacity: 1 }], {
        duration: 200, easing: "ease-out",
      });
    });
  }, [inbox.running]);

  function setGroup(group: InboxGroup | "all") {
    if (filter === group) return;
    window.history.replaceState(null, "", href(inboxFilterPath(group)));
  }

  return <main className="workspace triage-workspace">
    <header className="masthead triage-toolbar">
      <h1>문의함</h1>
      {publicDemo && <div className="industry-control" role="group" aria-label="시연 업종">
        {industries.map((option) => <button key={option.id} type="button" className="button button-light"
          aria-pressed={option.id === industry.id} disabled={busy || !isAvailableIndustry(option)}
          aria-describedby={isAvailableIndustry(option) ? undefined : "industry-unavailable"}
          onClick={() => { if (isAvailableIndustry(option)) chooseIndustry(option); }}>{option.label}</button>)}
        {unavailable && !isAvailableIndustry(unavailable)
          ? <p id="industry-unavailable">{unavailable.unavailable}</p>
          : industry.id !== "medicom" && <p className="triage-visually-hidden">같은 선별 엔진에 업종별 리드, {industry.dealer} 표와 정책을 적용합니다.</p>}
      </div>}
      <div className="triage-status">
        <span className="demo-disclosure">가상 리드, 공개 기관 정보만</span>
        {publicDemo && <p role="status">저장된 결과로 보는 시연 버전 · 메일 발송 없음</p>}
      </div>
      {inbox.responseNow > inbox.now && <div className="triage-clock">
        <p>{inbox.simulatedNow === null ? "저장된 시연 기록 기준" : "시연 시각"} · {new Intl.DateTimeFormat("ko-KR", {
          timeZone: forwardingPolicy.responseTimeZone, dateStyle: "medium", timeStyle: "short",
        }).format(inbox.responseNow)}</p>
        {inbox.simulatedNow !== null && <button type="button" className="button button-light" onClick={inbox.clearSimulation}>시연 시각 해제</button>}
      </div>}
      <div className="masthead-actions">
        <button type="button" className="button button-primary run-button" disabled={!inbox.ready || inbox.running}
          onClick={() => void inbox.assessAll()}>{inbox.running ? "선별 중…" : assessed === state.leads.length ? "다시 선별" : "선별 시작"}</button>
      </div>
    </header>
    <div className="workspace-inner">
      {inbox.error && <p className="feedback" role="alert">{inbox.error}</p>}
      <div className="triage-strip">
        <aside className="triage-groups" aria-label="선별 그룹">
          <nav className="group-nav" aria-label="문의함 필터">
            <button type="button" onClick={() => setGroup("all")} aria-pressed={filter === "all"}>
              <span>전체 문의</span><span>{state.leads.length}</span>
            </button>
            {inboxGroups.map((group) => <button key={group} type="button" onClick={() => setGroup(group)} aria-pressed={filter === group}>
              <span>{inboxFilterLabel[group]}</span><span>{rows.filter((row) => row.group === group).length}</span>
            </button>)}
          </nav>
        </aside>
      </div>
      {filter !== "all" && !inboxGroups.some((group) => group === filter) &&
        <p className="inbox-current-filter">{inboxFilterLabel[filter]} <strong>{visibleRows.length}건</strong></p>}
      <div className="board">
        <div className="inbox-column" aria-label="문의 목록" ref={leadList} data-filter={filter}>
          <div className="triage-columns" aria-hidden="true">
            <span>선별</span><span>기관명</span><span>받는 곳</span><span>경과</span>
          </div>
          {groups.length === 0 && <p className="empty-group">필터에 맞는 문의가 없습니다.</p>}
          {groups.map(({ group, leads }) => <section key={group} className="inbox-group" aria-labelledby={"group-" + group} data-empty={leads.length === 0}>
            <div className="group-heading">
              <h2 id={"group-" + group}><i aria-hidden="true" className={"dot " + group} />{inboxFilterLabel[group]} <span>{leads.length}</span></h2>
              {group === "invalid" && canBulk && (filter === "all" || filter === "invalid") && <button type="button" className="button button-light bulk-button"
                disabled={!inbox.ready || inbox.running} onClick={inbox.bulkInvalid}>일괄 무효 처리</button>}
            </div>
            {leads.length > 0 ? <ul className="leads">
              {leads.map((lead) => {
                const status = state.leadStates[lead.id];
                const row = byLead.get(lead.id);
                const route = row?.ambiguousPath;
                const handoff = route === "automatic-confirmation" ? null : row?.handoff;
                const workflowLabel = route ? inboxFilterLabel[route]
                  : status.workflow === "dealer-assigned" ? industry.dealer + " 배정" : rowState[status.workflow];
                const showReason = group === "invalid" || (group === "ambiguous" && status.assessment?.details?.domain === "suspicious");
                return <li key={lead.id} className={"lead" + (lead.id === selected?.id ? " selected" : "")}
                  data-group={group} data-risk={group === "ambiguous" && status.assessment?.details?.domain === "suspicious"}>
                  <button type="button" className="lead-button" aria-pressed={lead.id === selected?.id}
                    onClick={() => inbox.setSelected(lead.id)}>
                    <span className="lead-meta"><span>{lead.id}</span>
                      {row?.reassignment ? <span className="reassignment-label">재배정 제안</span>
                        : <span>{inbox.pending.includes(lead.id) ? "조사 중…" : workflowLabel}</span>}</span>
                    <span aria-hidden="true" className="triage-verdict">{inboxFilterLabel[group]}</span>
                    <strong title={lead.institution}>{lead.institution || "소속 미기재"}</strong>
                    {handoff && <span className="lead-handoff">
                      <span className="triage-visually-hidden">{directionIds.has(lead.id) ? "모르겠으면 넘길 곳" : "넘길 곳"} · </span>
                      {handoffLabel(handoff, state.dealers, industry.dealer)}
                    </span>}
                    {!handoff && <span className="lead-no-handoff" aria-hidden="true">—</span>}
                    <span className="lead-elapsed" aria-hidden="true">{elapsedSince(lead.receivedAt, inbox.now)}</span>
                    <span className={showReason ? "lead-context" : "triage-visually-hidden"}>{showReason ? status.assessment?.reason ?? "담당자 무효 처리" : lead.country + " · " + lead.product}</span>
                  </button>
                  {group === "invalid" && !status.dealerId && <button type="button" className="reopen"
                    disabled={!inbox.ready || inbox.pending.includes(lead.id)} onClick={() => inbox.reopen(lead)}>다시 검토</button>}
                </li>;
              })}
            </ul> : <p className="empty-group">문의가 없습니다.</p>}
          </section>)}
        </div>
        <div className="detail-column" id="direction-result" tabIndex={-1}>
          {selected ? <DecisionCard key={selected.id} lead={selected} inbox={inbox}
            directionHref={directionIds.has(selected.id) && !inbox.running ? href("/inbox/feedback#direction-" + selected.id) : undefined}
            confirmationHref={byLead.get(selected.id)?.ambiguousPath === "automatic-confirmation" && !inbox.running
              ? href("/inbox/feedback#confirmation-" + selected.id) : undefined} /> :
            <div className="empty-card"><span aria-hidden="true">✦</span><h2>문의를 선택해 주세요</h2><p>선별 근거와 결정 카드를 볼 수 있습니다.</p></div>}
        </div>
      </div>
    </div>
  </main>;
}
