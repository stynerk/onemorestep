"use client";

import { useState } from "react";
import { dealerScore, recommendDealer, type DealerScore } from "../../lib/forwarding/dealers";
import { confirmedCountry, confirmedManagerDealer, hasStaleEvidence, maskEmail, maskPhone, nextBusinessDate, verdictLabels } from "../../lib/forwarding/inbox";
import { locales } from "../../lib/forwarding/institution-policy";
import { renderForwardingMail } from "../../lib/forwarding/mail-template";
import { forwardingPolicy } from "../../lib/forwarding/policy";
import { currentDelivery, openAssignment, reassignmentProposal, type ReassignmentProposal } from "../../lib/forwarding/reassignment";
import type { Assessment, DealerDelivery, DealerOutcome, LeadInput, MailKind, ReplyKind } from "../../lib/forwarding/types";
import type { InboxController } from "./inbox-controller";

const date = new Intl.DateTimeFormat("ko-KR", { timeZone: forwardingPolicy.responseTimeZone, dateStyle: "medium", timeStyle: "short" });
const time = (value: string) => date.format(new Date(value));
const percent = new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 1 });
const score = (value: number | null) => value === null ? "집계 중" : value.toFixed(2);
const domainLabels = { matched: "기관 공식 이메일과 일치", "free-email": "무료 이메일", suspicious: "사칭 의심", unverified: "소유 관계 미확인" };
const modeLabels = { liner: "실시간 검색", cache: "Liner 캐시", mixed: "실시간 및 캐시", curated: "저장된 결과", local: "시연 판정" };
const outcomeLabels: Record<DealerOutcome, string> = { deal: "deal", "no-deal": "no deal", "in-progress": "진행 중", "no-response": "미응답" };
const mailLabels: Record<MailKind, string> = { "dealer-summary": "딜러용 요약", "country-check": "국가 확인", "partnership-check": "제휴 확인", "manager-confirmation": "담당자 확인", operations: "운영 알림" };
const statusLabels = { sent: "테스트 메일 발송 완료", failed: "발송 실패", unknown: "전송 불명", blocked: "수신자 검증으로 차단" };

function Evidence({ assessment, historicalCount }: { assessment: Assessment; historicalCount: number }) {
  const detail = assessment.details;
  return <div className="evidence">
    <div><h3>소속 기관 확인</h3>
      <p>{detail?.industry ?? "업종 확인 전"} · {detail?.countries.join(", ") || "소재지 확인 전"}</p>
      <p className="muted">{time(assessment.searchedAt)}</p>
      {assessment.sources.length > 0 && <ul className="source-list">
        {assessment.sources.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}</a></li>)}
      </ul>}
    </div>
    <div><h3>이메일 도메인</h3><p>{detail ? domainLabels[detail.domain] : "확인 전"}</p></div>
    <div><h3>자사 기록</h3><p>같은 기관의 전달 이력 {historicalCount}건</p></div>
  </div>;
}

function History({ record, saveOutcome, disabled }: {
  record: DealerScore;
  saveOutcome: InboxController["saveOutcome"];
  disabled: boolean;
}) {
  return <div className="dealer-entry">
    <div className="dealer-entry-head"><strong>{record.dealer.name}</strong><span className="score">{score(record.score)}</span></div>
    <p>전달 {record.forwarded}건 · 전환율 {record.conversionRate === null ? "—" : percent.format(record.conversionRate)}
       {" · "}진행 {record.inProgress}건 · 미응답 {record.noResponse}건</p>
    <p>{record.priorRelationship ? "이 기관 거래 기록 있음" : "이 기관 거래 기록 없음"}</p>
    <details className="history"><summary>최근 90일 이력 보기</summary>
      {record.deliveries.length ? <ul className="history-list">
        {record.deliveries.map((row) => <li key={row.id}>
          <span>{time(row.forwardedAt)} · {row.institution} · {outcomeLabels[row.outcome]}</span>
          {row.outcome === "in-progress" &&
            <OutcomeForm delivery={row} saveOutcome={saveOutcome} disabled={disabled} />}
        </li>)}
      </ul> : <p>전달 이력이 없습니다.</p>}
    </details>
  </div>;
}

function OutcomeForm({ delivery, saveOutcome, disabled }: {
  delivery: DealerDelivery;
  saveOutcome: InboxController["saveOutcome"];
  disabled: boolean;
}) {
  const [outcome, setOutcome] = useState<Exclude<DealerOutcome, "in-progress"> | "">("");
  return <form className="inline-form" onSubmit={(event) => {
    event.preventDefault();
    if (outcome) saveOutcome(delivery, outcome);
    setOutcome("");
  }}>
    <select aria-label={delivery.institution + " 딜러 결과"} value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}>
      <option value="">결과 선택</option><option value="deal">deal</option><option value="no-deal">no deal</option><option value="no-response">미응답</option>
    </select>
    <button type="submit" className="button button-light" disabled={disabled || !outcome}>결과 기록</button>
  </form>;
}

function ReplyForm({ formKey, kind, options, submit, disabled }: {
  formKey: string; kind: ReplyKind; options: { value: string; label: string }[];
  submit: (kind: ReplyKind, note: string, selection: string) => void;
  disabled: boolean;
}) {
  const [selection, setSelection] = useState("");
  const [note, setNote] = useState("");
  const label = kind === "manager-confirmation" ? "담당자 확인" : "회신 기록";
  return <form className="reply-form" onSubmit={(event) => {
    event.preventDefault();
    submit(kind, note, selection);
    setNote("");
  }}>
    <h3>{label}</h3>
    <label htmlFor={formKey + "-choice"}>{kind === "country" ? "확인한 국가" : kind === "partnership" ? "회신 분류" : "확인한 딜러"}</label>
    <select required id={formKey + "-choice"} value={selection} onChange={(event) => setSelection(event.target.value)}>
      <option value="">선택</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <label htmlFor={formKey + "-note"}>내용</label>
    <textarea id={formKey + "-note"} required value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} />
    <button type="submit" className="button button-primary" disabled={disabled || !note.trim() || !selection}>{label}</button>
  </form>;
}

function ReassignmentCard({ proposal, approve, disabled }: {
  proposal: ReassignmentProposal;
  approve: () => void;
  disabled: boolean;
}) {
  const { recommendation } = proposal;
  const next = recommendation.route === "dealer" ? recommendation.ranked[0] : null;
  return <section className="reassignment" aria-label="재배정 제안">
    <h3>재배정 제안</h3>
    <p>원래 딜러 <strong>{proposal.previous.name}</strong> · 응답 기한 {time(proposal.deadline)} 경과</p>
    {next ? <>
      <p>다음 순위 <strong>{next.dealer.name}</strong> · 점수 {score(next.score)}</p>
      <p>최근 90일 전달 {next.forwarded}건 · 전환율 {next.conversionRate === null ? "—" : percent.format(next.conversionRate)}
        {" · "}미응답 {next.noResponse}건 · {next.priorRelationship ? "이 기관과 거래 이력 있음" : "이 기관과 거래 이력 없음"}</p>
    </> : recommendation.route === "manager-confirmation"
      ? <p>다음 후보의 이력 또는 전환 근거가 부족합니다. {recommendation.manager.name}의 확인이 필요해요.</p>
      : <p>배정 가능한 다음 딜러가 없습니다. {recommendation.manager.name}에게 직접 처리를 넘겨요.</p>}
    <button type="button" className="button button-primary" disabled={disabled} onClick={approve}>
      {next ? "재배정 승인" : "지역 담당자에게 넘기기"}
    </button>
  </section>;
}

export function DecisionCard({ lead, inbox }: { lead: LeadInput; inbox: InboxController }) {
  const [changeDealer, setChangeDealer] = useState(false);
  const [dealerId, setDealerId] = useState("");
  const [reason, setReason] = useState("");
  const { state } = inbox;
  const status = state.leadStates[lead.id];
  const assessment = status.assessment;
  const country = confirmedCountry(state, lead.id) ?? lead.country;
  const recommendation = recommendDealer(state, lead.id, { country });
  const waitingDealer = confirmedManagerDealer(state, lead.id);
  const ranked = recommendation?.route === "dealer" ? recommendation.ranked : [];
  const dealer = ranked[0]?.dealer ?? (recommendation?.route === "manager-confirmation"
    ? recommendation.candidates.find((row) => row.dealer.id === waitingDealer)?.dealer : undefined);
  const disabled = !inbox.ready || inbox.pending.includes(lead.id);
  const canDecide = !status.dealerId && status.workflow !== "disqualified";
  const dealChoices = recommendation?.route === "dealer"
    ? recommendation.ranked.map((row) => row.dealer).filter((row) => row.id !== dealer?.id) : [];
  const latestDecision = state.events.findLast((event) => event.type === "decision" && event.leadId === lead.id);
  const assigned = state.dealers.find((entry) => entry.id === status.dealerId);
  const delivery = currentDelivery(state, lead.id);
  const active = openAssignment(state, lead.id);
  const proposal = inbox.ready ? reassignmentProposal(state, lead, inbox.responseNow) : null;
  const latestReassignment = state.events.findLast((event) => event.type === "reassigned" && event.leadId === lead.id);
  const previousDelivery = latestReassignment?.type === "reassigned"
    ? state.deliveries.find((row) => row.id === latestReassignment.previousDeliveryId) : undefined;
  const previousDealer = state.dealers.find((entry) => entry.id === previousDelivery?.dealerId);
  const previousScore = previousDealer && dealerScore(state, lead, previousDealer);
  const reference = state.priorRelationships.filter((row) => row.institution === lead.institution).length;
  const historicalCount = state.deliveries.filter((row) => row.institution === lead.institution).length;
  const replyKind = assessment?.verdict === "country-check" ? "country" : assessment?.verdict === "partnership-check" ? "partnership" :
    recommendation?.route === "manager-confirmation" && !waitingDealer ? "manager-confirmation" : null;
  const replyOptions = replyKind === "country" ? Object.keys(locales).map((name) => ({ value: name, label: name })) :
    replyKind === "partnership" ? [{ value: "partnership", label: "제휴 제안 유지" }, { value: "purchase", label: "구매 문의 확인" }] :
    recommendation?.route === "manager-confirmation" ? recommendation.candidates.map((row) => ({ value: row.dealer.id, label: row.dealer.name })) : [];
  const savedReply = state.events.findLast((event) => event.type === "reply" && event.leadId === lead.id);
  const runMail = inbox.mailFor(lead);
  const stale = assessment && hasStaleEvidence(assessment, inbox.now);
  const fault = assessment?.details?.externalStatus === "failed";
  const recommendationText = assigned ? assigned.name + "에 배정했습니다." : dealer ? dealer.name + "에 넘기세요." :
    recommendation?.route === "manager-direct" ? recommendation.manager.name + "에게 넘기세요." :
    recommendation?.route === "manager-confirmation" ? recommendation.manager.name + "의 딜러 확인이 필요해요." :
    recommendation?.route === "operations" ? "운영에 담당 지역 확인을 요청했어요." :
    assessment?.verdict === "country-check" ? "국가 확인 회신이 필요해요." :
    assessment?.verdict === "partnership-check" ? "제휴 내용 확인이 필요해요." :
    assessment?.verdict === "invalid" ? "무효 처리 사유를 확인하세요." : "전화로 문의 내용을 확인하세요.";

  return <article className="decision-card" aria-labelledby="card-heading">
    <div className="card-head">
      <div className="card-meta"><span>{lead.id}</span><span>{country}</span><span>{lead.product}</span></div>
      <h2 id="card-heading">{lead.institution || "소속 미기재"}</h2>
      <p className="contact">{lead.name} · {maskEmail(lead.email)} · {maskPhone(lead.phone)}</p>
      <p className="muted">접수 {time(lead.receivedAt)}{inbox.ready && " · " + Math.max(0, Math.floor((inbox.now - Date.parse(lead.receivedAt)) / 3600000)) + "시간 경과"}</p>
      {assessment && <div className="badges">
        <span className="badge">{assessment.details ? modeLabels[assessment.details.sourceKind] : assessment.mode === "live" ? "실시간 검색" : "저장된 결과"}</span>
        {stale && <span className="badge warning">오래된 출처</span>}
        {fault && <span className="badge warning">외부 확인 실패</span>}
        {status.workflow === "disqualified" && <span className="badge neutral">무효 처리 완료</span>}
      </div>}
    </div>
    {!assessment ? <div className="card-body"><h3>문의 메모</h3><blockquote>{lead.memo}</blockquote>
      <button className="button button-primary" disabled={disabled} onClick={() => void inbox.assess(lead)}>{disabled ? "확인 중…" : "이 문의 판정"}</button>
    </div> : <div className="card-body">
      {proposal && <ReassignmentCard proposal={proposal} disabled={disabled} approve={() => inbox.approveReassignment(lead, proposal)} />}
      <section className="recommendation"><p className="section-kicker">미리내 추천</p><h3>{recommendationText}</h3><p>{assessment.reason}</p></section>
      <section>
        <div className="section-heading"><h3>판정 근거</h3><span className={"verdict " + assessment.verdict}>{verdictLabels[assessment.verdict]}</span></div>
        <Evidence assessment={assessment} historicalCount={historicalCount} />
        {reference > 0 && <p className="muted">과거 거래 관계 {reference}건</p>}
        {fault && <button className="button button-light" disabled={disabled} onClick={() => void inbox.assess(lead)}>외부 확인 다시 시도</button>}
      </section>
      <section>
        <h3>구매 의향 · {assessment.details?.memoIntent === "buying" ? "높음" : "불명"}</h3>
        <blockquote>{lead.memo}</blockquote>
        {assessment.details?.memoQuote && <p className="muted">판단 문구 “{assessment.details.memoQuote}”</p>}
      </section>
      {ranked.length > 0 && <section><h3>추천 딜러</h3>
        <History record={ranked[0]} saveOutcome={inbox.saveOutcome} disabled={disabled} />
        {ranked[1] && <details className="runner-up"><summary>2순위 · {ranked[1].dealer.name} · {score(ranked[1].score)}</summary>
          <History record={ranked[1]} saveOutcome={inbox.saveOutcome} disabled={disabled} />
        </details>}
      </section>}
      {assessment.verdict === "valid" && <details className="preview"><summary>딜러 요약 미리보기</summary>
        <pre>{renderForwardingMail("dealer-summary", { ...lead, country }).text}</pre>
      </details>}
      {savedReply?.type === "reply" && <section><h3>회신 기록</h3><p>{savedReply.text} · {time(savedReply.at)}</p></section>}
      {replyKind && canDecide && <ReplyForm key={replyKind} formKey={lead.id + "-" + replyKind} kind={replyKind} options={replyOptions}
          disabled={disabled} submit={(kind, note, selection) => void inbox.saveReply(lead, kind, note, selection)} />}
      {canDecide && assessment.verdict !== "invalid" && <section className="decision-buttons" aria-label="결정">
        {dealer && <button type="button" className="button button-primary" disabled={disabled}
          onClick={() => inbox.decide(lead, "approve", dealer.id, "추천 딜러 승인")}>승인</button>}
        {dealChoices.length > 0 && <button type="button" className="button button-light" disabled={disabled}
          onClick={() => setChangeDealer((current) => !current)}>딜러 변경</button>}
        <button type="button" className="button button-light" disabled={disabled}
          onClick={() => inbox.decide(lead, "phone", null, "전화로 추가 확인")}>전화 필요</button>
        <button type="button" className="button button-light" disabled={disabled}
          onClick={() => inbox.decide(lead, "disqualify", null, "담당자가 무효로 결정")}>무효 처리</button>
      </section>}
      {canDecide && changeDealer && dealChoices.length > 0 && <form className="reply-form" onSubmit={(event) => {
        event.preventDefault();
        if (!dealerId || !reason.trim()) return;
        inbox.decide(lead, "change-dealer", dealerId, reason.trim());
      }}>
        <label htmlFor="dealer-choice">배정 딜러</label><select id="dealer-choice" required value={dealerId} onChange={(event) => setDealerId(event.target.value)}>
          <option value="">다른 딜러 선택</option>{dealChoices.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
        <label htmlFor="change-reason">변경 이유</label><textarea id="change-reason" required maxLength={500} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        <button type="submit" className="button button-primary" disabled={disabled || !dealerId || !reason.trim()}>딜러 변경 기록</button>
      </form>}
      {(latestDecision || latestReassignment) && <section>
        <h3>결정 기록</h3>
        {latestDecision?.type === "decision" && <p>{latestDecision.reason} · {time(latestDecision.at)}</p>}
        {latestReassignment?.type === "reassigned" && previousScore && <p>
          {time(latestReassignment.at)} · {previousScore.dealer.name} 미응답 기록 · 최근 90일 미응답 {previousScore.noResponse}건 · 갱신 점수 {score(previousScore.score)}
        </p>}
        {active && <p>딜러 응답 기한 {time(nextBusinessDate(active.forwardedAt))} (한국 시간)</p>}
        {active && !proposal && <button type="button" className="button button-light" disabled={disabled}
          onClick={() => inbox.simulateDeadline(lead)}>기한 경과 시뮬레이션</button>}
        {delivery && <><p>현재 결과 · {outcomeLabels[delivery.outcome]}</p><OutcomeForm key={delivery.id} delivery={delivery} saveOutcome={inbox.saveOutcome} disabled={disabled} /></>}
      </section>}
      {runMail.length > 0 && <section aria-live="polite"><h3>테스트 메일</h3>
        {runMail.map(({ id, kind, dealerName, delivery, status: mailStatus, retry }) => <div className="mail-row" key={id}>
          <p><strong>{mailLabels[kind]}{dealerName && " · " + dealerName}</strong> · {mailStatus?.message ?? (delivery ? statusLabels[delivery.status] : "상태 확인 필요")}</p>
          {!mailStatus?.pending && (!delivery || delivery.status === "failed") &&
            <button type="button" className="button button-light" onClick={() => void retry()}>{delivery ? "다시 보내기" : "메일 상태 확인"}</button>}
        </div>)}
      </section>}
    </div>}
  </article>;
}
