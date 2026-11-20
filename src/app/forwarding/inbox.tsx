"use client";

import { useState } from "react";
import { handoffForLead } from "../../lib/forwarding/handoff";
import { inboxBucket, inboxOrder, verdictLabels } from "../../lib/forwarding/inbox";
import { forwardingPolicy } from "../../lib/forwarding/policy";
import { reassignmentProposal } from "../../lib/forwarding/reassignment";
import { VERDICTS, type LeadInput } from "../../lib/forwarding/types";
import { DecisionCard } from "./decision-card";
import { handoffLabel } from "./handoff-label";
import { useInbox } from "./inbox-controller";
import { PublicDemoResults } from "./public-demo-results";

const sections = [...VERDICTS, "new"] as const;
type Group = (typeof sections)[number];
const title = (group: Group) => group === "new" ? "미판정" : verdictLabels[group];
const rowState = {
  new: "미판정", "decision-pending": "결정 대기", "reply-pending": "회신 대기",
  "manager-confirmation-pending": "담당자 확인", "manager-direct-pending": "담당자 직접 처리", "dealer-assigned": "딜러 배정",
  connected: "결과 기록", disqualified: "처리 완료",
};

export default function Inbox({ publicDemo, liveAssessment }: { publicDemo: boolean; liveAssessment: boolean }) {
  const inbox = useInbox(publicDemo, liveAssessment);
  const [filter, setFilter] = useState<Group | "all">("all");
  const [confirmReset, setConfirmReset] = useState(false);
  const { state } = inbox;
  const overdue = new Set(inbox.ready
    ? state.leads.filter((lead) => reassignmentProposal(state, lead, inbox.responseNow)).map((lead) => lead.id)
    : []);
  const groups = Object.fromEntries(sections.map((group) => {
    const bucket = group === "new" ? null : group;
    const ordered = inboxOrder(state.leads.filter((lead) => inboxBucket(state, lead) === bucket), bucket);
    return [group, ordered.sort((a, b) => Number(overdue.has(b.id)) - Number(overdue.has(a.id)))];
  })) as Record<Group, LeadInput[]>;
  const shown = filter === "all" ? sections : [filter];
  const selected = state.leads.find((lead) => lead.id === inbox.selected);
  const assessed = state.leads.length - groups.new.length;
  const canBulk = groups.invalid.some((lead) => state.leadStates[lead.id].workflow !== "disqualified");
  const busy = inbox.running || inbox.pending.length > 0 || Object.values(inbox.mail).some((item) => item.pending);

  function setGroup(group: Group | "all") {
    setFilter(group);
    if (group !== "all" && !groups[group].some((lead) => lead.id === inbox.selected)) {
      inbox.setSelected(groups[group][0]?.id ?? null);
    }
  }

  return <main className="workspace">
    <header className="masthead">
      <div className="brand"><span className="brand-icon" aria-hidden="true">✦</span><div>
        <p className="brand-name">미리내</p><p className="brand-company">MEDICOM</p>
      </div></div>
      <div className="masthead-actions">
        <span className="demo-disclosure">가상 리드, 공개 기관 정보만</span>
        <button type="button" className="button button-reset" disabled={busy} onClick={() => setConfirmReset(true)}>시연 초기화</button>
      </div>
    </header>
    <div className="workspace-inner">
      <div className="page-heading">
        <div><h1>문의함</h1><p>기관 근거를 확인하고 다음 조치를 결정하세요.</p></div>
        <button type="button" className="button button-primary run-button" disabled={!inbox.ready || inbox.running}
          onClick={() => void inbox.assessAll()}>{inbox.running ? "판정 중…" : assessed === state.leads.length ? "다시 판정" : "판정 시작"}</button>
      </div>
      {publicDemo && <p className="feedback" role="status">저장된 결과로 보는 시연 버전 · 메일 발송 없음</p>}
      {confirmReset && <div className="feedback confirm" role="status">
        <p>이 브라우저의 판정, 결정, 회신 기록을 지울까요?</p>
        <button type="button" className="button button-light" onClick={() => setConfirmReset(false)}>취소</button>
        <button type="button" className="button button-primary" disabled={busy} onClick={() => {
          inbox.reset(); setFilter("all"); setConfirmReset(false);
        }}>초기화 확인</button>
      </div>}
      {inbox.responseNow > inbox.now && <div className="feedback">
        <p>{inbox.simulatedNow === null ? "저장된 시연 기록 기준" : "시연 시각"} · {new Intl.DateTimeFormat("ko-KR", {
          timeZone: forwardingPolicy.responseTimeZone, dateStyle: "medium", timeStyle: "short",
        }).format(inbox.responseNow)}</p>
        {inbox.simulatedNow !== null && <button type="button" className="button button-light" onClick={inbox.clearSimulation}>시연 시각 해제</button>}
      </div>}
      {inbox.error && <p className="feedback" role="alert">{inbox.error}</p>}
      {publicDemo && <PublicDemoResults />}
      <div className="board">
        <aside className="sidebar" aria-label="판정 그룹">
          <div className="progress-block">
            <div><strong>판정 현황</strong><span aria-live="polite">{assessed} / {state.leads.length}</span></div>
            <progress aria-label="판정 완료 건수" value={assessed} max={state.leads.length} />
          </div>
          <nav className="group-nav" aria-label="문의함 필터">
            <button type="button" onClick={() => setGroup("all")} aria-pressed={filter === "all"}>
              <span>전체 문의</span><span>{state.leads.length}</span>
            </button>
            {sections.map((group) => <button key={group} type="button" onClick={() => setGroup(group)} aria-pressed={filter === group}>
              <span><i aria-hidden="true" className={"dot " + group} />{title(group)}</span><span>{groups[group].length}</span>
            </button>)}
          </nav>
        </aside>
        <div className="inbox-column" aria-label="문의 목록">
          {shown.map((group) => <section key={group} className="inbox-group" aria-labelledby={"group-" + group}>
            <div className="group-heading">
              <h2 id={"group-" + group}><i aria-hidden="true" className={"dot " + group} />{title(group)} <span>{groups[group].length}</span></h2>
              {group === "invalid" && canBulk && <button type="button" className="button button-light bulk-button"
                disabled={!inbox.ready || inbox.running} onClick={inbox.bulkInvalid}>일괄 무효 처리</button>}
            </div>
            {groups[group].length > 0 ? <ul className="leads">
              {groups[group].map((lead) => {
                const status = state.leadStates[lead.id];
                const handoff = handoffForLead(state, lead);
                const showReason = group === "invalid" || (group === "ambiguous" && status.assessment?.details?.domain === "suspicious");
                return <li key={lead.id} className={"lead" + (lead.id === selected?.id ? " selected" : "")}>
                  <button type="button" className="lead-button" aria-pressed={lead.id === selected?.id}
                    onClick={() => inbox.setSelected(lead.id)}>
                    <span className="lead-meta"><span>{lead.id}</span>
                      {overdue.has(lead.id) ? <span className="reassignment-label">재배정 제안</span>
                        : <span>{inbox.pending.includes(lead.id) ? "조사 중…" : rowState[status.workflow]}</span>}</span>
                    <strong title={lead.institution}>{lead.institution || "소속 미기재"}</strong>
                    {handoff && <span className="lead-handoff">넘길 곳 · {handoffLabel(handoff, state.dealers)}</span>}
                    <span>{showReason ? status.assessment?.reason ?? "담당자 무효 처리" : lead.country + " · " + lead.product}</span>
                  </button>
                  {group === "invalid" && !status.dealerId && <button type="button" className="reopen"
                    disabled={!inbox.ready || inbox.pending.includes(lead.id)} onClick={() => inbox.reopen(lead)}>다시 검토</button>}
                </li>;
              })}
            </ul> : <p className="empty-group">문의가 없습니다.</p>}
          </section>)}
        </div>
        <div className="detail-column">
          {selected ? <DecisionCard key={selected.id} lead={selected} inbox={inbox} /> :
            <div className="empty-card"><span aria-hidden="true">✦</span><h2>문의를 선택해 주세요</h2><p>판정 근거와 결정 카드를 볼 수 있습니다.</p></div>}
        </div>
      </div>
    </div>
  </main>;
}
