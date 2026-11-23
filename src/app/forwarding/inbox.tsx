"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { industryHandoffForLead, isAvailableIndustry, medicom, type DemoIndustry, type DemoIndustryOption } from "../../lib/forwarding/industry-demo";
import { confirmedCountry, inboxBucket, inboxOrder, verdictLabels } from "../../lib/forwarding/inbox";
import { forwardingPolicy } from "../../lib/forwarding/policy";
import { reassignmentProposal } from "../../lib/forwarding/reassignment";
import { VERDICTS, type LeadInput } from "../../lib/forwarding/types";
import { DecisionCard } from "./decision-card";
import { DirectionPanel } from "./direction-panel";
import { handoffLabel } from "./handoff-label";
import { useInbox } from "./inbox-controller";
import { PublicDemoResults } from "./public-demo-results";
import { resetMarketingDemo } from "../marketing/storage";
import "./triage-layout.css";

const sections = [...VERDICTS, "new"] as const;
type Group = (typeof sections)[number];
const title = (group: Group) => group === "new" ? "미판정" : verdictLabels[group];
const rowState = {
  new: "미판정", "decision-pending": "결정 대기", "reply-pending": "회신 대기",
  "manager-confirmation-pending": "담당자 확인", "manager-direct-pending": "담당자 직접 처리", "dealer-assigned": "딜러 배정",
  connected: "결과 기록", disqualified: "처리 완료",
};

function elapsedSince(receivedAt: string, now: number) {
  if (!now) return "—";
  const hours = Math.max(0, Math.floor((now - Date.parse(receivedAt)) / 3_600_000));
  return hours < 24 ? `${hours}시간` : `${Math.floor(hours / 24)}일`;
}

type InboxProps = { publicDemo: boolean; liveAssessment: boolean; industries?: readonly DemoIndustryOption[] };

export default function Inbox({ publicDemo, liveAssessment, industries }: InboxProps) {
  const [industry, setIndustry] = useState<DemoIndustry>(medicom);
  const selected = publicDemo ? industry : medicom;
  return <IndustryInbox key={selected.id} industry={selected} publicDemo={publicDemo} liveAssessment={liveAssessment && selected.id === "medicom"}
    industries={publicDemo ? industries : undefined} chooseIndustry={(id) => {
      const option = industries?.find((row) => row.id === id);
      if (option && isAvailableIndustry(option)) setIndustry(option);
    }} />;
}

function IndustryInbox({ industry, publicDemo, liveAssessment, industries, chooseIndustry }: InboxProps & {
  industry: DemoIndustry; chooseIndustry: (id: string) => void;
}) {
  const inbox = useInbox(publicDemo, liveAssessment, industry);
  const [filter, setFilter] = useState<Group | "all">("all");
  const [confirmReset, setConfirmReset] = useState(false);
  const [showDirection, setShowDirection] = useState(false);
  const leadList = useRef<HTMLDivElement>(null);
  const wasRunning = useRef(false);
  const { state } = inbox;
  const unavailable = industries?.find((option) => !isAvailableIndustry(option));
  const overdue = new Set(inbox.ready
    ? state.leads.filter((lead) => reassignmentProposal(state, lead, inbox.responseNow)).map((lead) => lead.id)
    : []);
  const groups = Object.fromEntries(sections.map((group) => {
    const bucket = group === "new" ? null : group;
    const ordered = inboxOrder(state.leads.filter((lead) => inboxBucket(state, lead) === bucket), bucket, industry.id === "medicom" ? "L06" : null);
    return [group, ordered.sort((a, b) => Number(overdue.has(b.id)) - Number(overdue.has(a.id)))];
  })) as Record<Group, LeadInput[]>;
  const shown = filter === "all" ? sections : [filter];
  const selected = state.leads.find((lead) => lead.id === inbox.selected);
  const assessed = state.leads.length - groups.new.length;
  const canBulk = groups.invalid.some((lead) => state.leadStates[lead.id].workflow !== "disqualified");
  const busy = inbox.running || inbox.pending.length > 0 || Object.values(inbox.mail).some((item) => item.pending);
  const directionRows = inbox.directionLeads.flatMap((lead) => {
    const assessment = state.leadStates[lead.id].assessment;
    const country = confirmedCountry(state, lead.id);
    return assessment ? [{ lead: country ? { ...lead, country } : lead, assessment }] : [];
  });
  const directionIds = new Set(directionRows.map(({ lead }) => lead.id));

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

  function setGroup(group: Group | "all") {
    setFilter(group);
    if (group !== "all" && !groups[group].some((lead) => lead.id === inbox.selected)) {
      inbox.setSelected(groups[group][0]?.id ?? null);
    }
  }

  return <main className="workspace triage-workspace">
    <header className="masthead triage-toolbar">
      <div className="brand"><span className="brand-icon" aria-hidden="true">✦</span><div>
        <p className="brand-name">미리내</p><p className="brand-company">{industry.brand}</p>
      </div></div>
      <h1>문의함</h1>
      {industries && <div className="industry-control" role="group" aria-label="시연 업종">
        {industries.map((option) => <button key={option.id} type="button" className="button button-light"
          aria-pressed={option.id === industry.id} disabled={!isAvailableIndustry(option)}
          aria-describedby={isAvailableIndustry(option) ? undefined : "industry-unavailable"}
          onClick={() => chooseIndustry(option.id)}>{option.label}</button>)}
        {unavailable && !isAvailableIndustry(unavailable)
          ? <p id="industry-unavailable">{unavailable.unavailable}</p>
          : industry.id !== "medicom" && <p className="triage-visually-hidden">같은 판정 엔진에 업종별 리드, {industry.dealer} 표와 정책을 적용합니다.</p>}
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
        {publicDemo && industry.id === "medicom" && <PublicDemoResults />}
        <nav aria-label="업무 메뉴"><Link className="button button-reset masthead-link" href="/marketing">마케팅 협조 요청</Link></nav>
        <button type="button" className="button button-reset" disabled={busy} onClick={() => setConfirmReset(true)}>시연 초기화</button>
        <button type="button" className="button button-primary run-button" disabled={!inbox.ready || inbox.running}
          onClick={() => void inbox.assessAll()}>{inbox.running ? "판정 중…" : assessed === state.leads.length ? "다시 판정" : "판정 시작"}</button>
      </div>
    </header>
    <div className="workspace-inner">
      {confirmReset && <div className="feedback confirm" role="status">
        <p>이 브라우저의 판정, 결정, 회신과 마케팅 기록을 지울까요?</p>
        <button type="button" className="button button-light" onClick={() => setConfirmReset(false)}>취소</button>
        <button type="button" className="button button-primary" disabled={busy} onClick={() => {
          inbox.reset(); resetMarketingDemo(); setFilter("all"); setShowDirection(false); setConfirmReset(false);
        }}>초기화 확인</button>
      </div>}
      {inbox.error && <p className="feedback" role="alert">{inbox.error}</p>}
      <div className="triage-strip">
        <aside className="triage-groups" aria-label="판정 그룹">
          <nav className="group-nav" aria-label="문의함 필터">
            <button type="button" onClick={() => setGroup("all")} aria-pressed={filter === "all"}>
              <span>전체 문의</span><span>{state.leads.length}</span>
            </button>
            {sections.map((group) => <button key={group} type="button" onClick={() => setGroup(group)} aria-pressed={filter === group}>
              <span>{title(group)}</span><span>{groups[group].length}</span>
            </button>)}
          </nav>
          <div className="progress-block">
            <div><strong>판정 현황</strong><span aria-live="polite">{assessed} / {state.leads.length}</span></div>
            <progress aria-label="판정 완료 건수" value={assessed} max={state.leads.length} />
          </div>
        </aside>
        {assessed > 0 && !inbox.running && <DirectionPanel rows={directionRows} expanded={showDirection}
          onToggle={() => setShowDirection((shown) => !shown)} isPending={(id) => inbox.pending.includes(id)}
          answeringDisabled={!inbox.ready} onAnswer={(lead, answer) => {
            if (!inbox.answerDirection(lead, answer)) return;
            setShowDirection(false);
            window.requestAnimationFrame(() => {
              const result = document.getElementById("direction-result");
              result?.focus({ preventScroll: true });
              result?.scrollIntoView({ block: "nearest" });
            });
          }} />}
      </div>
      <div className="board">
        <div className="inbox-column" aria-label="문의 목록" ref={leadList} data-filter={filter}>
          <div className="triage-columns" aria-hidden="true">
            <span>판정</span><span>기관명</span><span>받는 곳</span><span>경과</span>
          </div>
          {shown.map((group) => <section key={group} className="inbox-group" aria-labelledby={"group-" + group} data-empty={groups[group].length === 0}>
            <div className="group-heading">
              <h2 id={"group-" + group}><i aria-hidden="true" className={"dot " + group} />{title(group)} <span>{groups[group].length}</span></h2>
              {group === "invalid" && canBulk && <button type="button" className="button button-light bulk-button"
                disabled={!inbox.ready || inbox.running} onClick={inbox.bulkInvalid}>일괄 무효 처리</button>}
            </div>
            {groups[group].length > 0 ? <ul className="leads">
              {groups[group].map((lead) => {
                const status = state.leadStates[lead.id];
                const handoff = industryHandoffForLead(state, lead);
                const showReason = group === "invalid" || (group === "ambiguous" && status.assessment?.details?.domain === "suspicious");
                return <li key={lead.id} className={"lead" + (lead.id === selected?.id ? " selected" : "")}
                  data-group={group} data-risk={group === "ambiguous" && status.assessment?.details?.domain === "suspicious"}>
                  <button type="button" className="lead-button" aria-pressed={lead.id === selected?.id}
                    onClick={() => inbox.setSelected(lead.id)}>
                    <span className="lead-meta"><span>{lead.id}</span>
                      {overdue.has(lead.id) ? <span className="reassignment-label">재배정 제안</span>
                        : <span>{inbox.pending.includes(lead.id) ? "조사 중…" : status.workflow === "dealer-assigned" ? industry.dealer + " 배정" : rowState[status.workflow]}</span>}</span>
                    <span aria-hidden="true" className="triage-verdict">{title(group)}</span>
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
            openDirection={directionIds.has(selected.id) && !inbox.running ? () => setShowDirection(true) : undefined} /> :
            <div className="empty-card"><span aria-hidden="true">✦</span><h2>문의를 선택해 주세요</h2><p>판정 근거와 결정 카드를 볼 수 있습니다.</p></div>}
        </div>
      </div>
    </div>
  </main>;
}
