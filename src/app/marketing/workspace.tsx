"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { marketingDraftTemplate, type MarketingDraft } from "../../lib/marketing/draft";
import { marketingChannels, rankedMarketingRequests, type ChannelId } from "../../lib/marketing/policy";
import { deadlineWarning, initialWorkflow, rankWorkflowRequests, type MarketingIntake, type WorkflowStatus } from "../../lib/marketing/workflow";
import {
  hasApprovedDraft, isMarketingDraft, readMarketingSnapshot, readMarketingState, resetMarketingDemo, submitMarketingRequest,
  subscribeToMarketingState, updateMarketingState, updateMarketingWorkflow,
  type DraftRecord,
} from "./storage";
import { DraftPreview } from "./draft-preview";
import { CampaignTracking, useCampaignTracking } from "./campaign-tracking";
import { RequestIntake } from "./request-intake";
import { RequesterView, RequestWorkflow } from "./request-workflow";

const emptySnapshot = () => null;

export function MarketingWorkspace({ publicDemo }: { publicDemo: boolean }) {
  const snapshot = useSyncExternalStore(subscribeToMarketingState, readMarketingSnapshot, emptySnapshot);
  const state = readMarketingState(snapshot);
  const tracking = useCampaignTracking();
  const ranked = rankWorkflowRequests(state.submitted);
  const requests = new Map(ranked.map(row => [row.id, row]));
  const summaries = ranked.map(request => {
    const history = state.workflows[request.id] ?? initialWorkflow(request);
    const latest = history.at(-1);
    return { ...request, history, status: latest?.status ?? "접수", code: latest?.code,
      warning: deadlineWarning(request.deadlineDays, latest?.status ?? "접수") };
  });
  const warnings = new Map(summaries.map(summary => [summary.id, summary.warning]));
  const imminent = summaries.filter(summary => summary.warning === "마감 임박").length;
  const overdue = summaries.filter(summary => summary.warning === "마감 초과").length;
  const issuedCodes = summaries.flatMap(({ code, title }) => code ? [{ code, title }] : []);
  const [selectedId, setSelectedId] = useState(rankedMarketingRequests[0].id);
  const [openPanel, setOpenPanel] = useState<"intake" | "requester" | null>(null);
  const [rankTarget, setRankTarget] = useState("");
  const [reason, setReason] = useState("");
  const [activeChannel, setActiveChannel] = useState<ChannelId | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const selected = summaries.find(item => item.id === selectedId) ?? summaries[0];
  const submitted = state.submitted.find(item => item.id === selected.id);
  const terminal = selected.status === "완료" || selected.status === "반려";
  const approved = hasApprovedDraft(state.drafts, selected.id);
  const rank = state.order.indexOf(selected.id) + 1;
  const draftKey = selected.id + ":" + activeChannel;
  const activeEnabled = activeChannel !== null && (state.channels[selected.id]?.[activeChannel]
    ?? selected.recommendedChannels.some(channel => channel === activeChannel));
  const record = activeEnabled ? state.drafts[draftKey] : undefined;

  useEffect(() => () => activeRequest.current?.abort(), []);

  function chooseRequest(id: string) {
    if (selectedId === id) return;
    setSelectedId(id);
    setRankTarget("");
    setReason("");
    setActiveChannel(null);
    setEditing(false);
    setNotice("");
    setError("");
    if (window.matchMedia("(max-width: 850px)").matches) {
      requestAnimationFrame(() => detailHeading.current?.focus());
    }
  }

  function receive(intake: MarketingIntake) {
    const id = submitMarketingRequest(intake);
    if (!id) return setError("마케팅 요청을 브라우저에 저장하지 못했습니다.");
    setOpenPanel(null);
    chooseRequest(id);
    setNotice(id + " 요청을 접수했습니다.");
  }

  function changeWorkflow(status: Exclude<WorkflowStatus, "접수">, assignee: string, reason?: string) {
    if (!updateMarketingWorkflow(selected.id, status, assignee, reason)) {
      return setError("처리 상태를 변경하지 못했습니다. 담당자, 초안 승인 또는 반려 사유를 확인해 주세요.");
    }
    setEditing(false);
    setError("");
    setNotice(selected.id + " 요청을 " + status + " 상태로 저장했습니다.");
  }

  function saveRank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const destination = Number(rankTarget);
    const note = reason.trim();
    if (!note || !Number.isInteger(destination) || destination < 1 || destination > state.order.length || destination === rank) return;
    const saved = updateMarketingState(previous => {
      const order = previous.order.filter(id => id !== selected.id);
      order.splice(destination - 1, 0, selected.id);
      const rankings = order.flatMap((id, index) => {
        const before = previous.order.indexOf(id) + 1;
        return before === index + 1 ? [] : [{ id, score: requests.get(id)?.score ?? 0, before, after: index + 1 }];
      });
      return { ...previous, order, rankChanges: [{ requestId: selected.id, reason: note, rankings }, ...previous.rankChanges] };
    });
    if (!saved) return setError("브라우저에 순위 조정을 저장하지 못했습니다.");
    setRankTarget("");
    setReason("");
    setError("");
    setNotice(selected.id + " 순위를 " + destination + "위로 변경했습니다.");
  }

  function toggleChannel(channel: ChannelId, enabled: boolean) {
    if (terminal) return;
    const saved = updateMarketingState(previous => ({
      ...previous,
      channels: { ...previous.channels, [selected.id]: { ...previous.channels[selected.id], [channel]: enabled } },
    }));
    if (!saved) return setError("채널 설정을 저장하지 못했습니다.");
    if (!enabled && activeChannel === channel) {
      setActiveChannel(null);
      setEditing(false);
    }
  }

  async function showDraft(channel: ChannelId) {
    const key = selected.id + ":" + channel;
    setActiveChannel(channel);
    setEditing(false);
    setError("");
    if (state.drafts[key] || pending) return;
    if (terminal) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(key);
    let draft: MarketingDraft;
    try {
      if (submitted) {
        draft = marketingDraftTemplate(channel);
      } else {
        const response = await fetch("/api/marketing/draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId: selected.id, channel }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        });
        if (!response.ok) throw new Error("Marketing draft request failed");
        const payload: unknown = await response.json();
        if (!isMarketingDraft(payload)) throw new Error("Invalid marketing draft");
        draft = payload;
      }
    } catch {
      draft = marketingDraftTemplate(channel);
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPending(null);
      }
    }
    if (controller.signal.aborted) return;
    const saved = updateMarketingState(previous => ({
      ...previous, drafts: { ...previous.drafts, [key]: { draft, status: "검토 대기" } },
    }));
    if (!saved) setError("초안을 브라우저에 저장하지 못했습니다.");
  }

  function saveDraft(update: Partial<DraftRecord>) {
    if (!record || terminal) return;
    const saved = updateMarketingState(previous => ({
      ...previous,
      drafts: { ...previous.drafts, [draftKey]: { ...record, ...update } },
    }));
    if (!saved) return setError("초안 검토 결과를 저장하지 못했습니다.");
    setError("");
    setEditing(false);
  }

  function reset() {
    activeRequest.current?.abort();
    if (!resetMarketingDemo()) {
      setError("브라우저의 마케팅 시연 기록을 초기화하지 못했습니다.");
      return;
    }
    setSelectedId(rankedMarketingRequests[0].id);
    setOpenPanel(null);
    setRankTarget("");
    setReason("");
    setActiveChannel(null);
    setEditing(false);
    setConfirmReset(false);
    setNotice("마케팅 시연 기록을 초기화했습니다.");
    setError("");
  }

  return <main className="workspace marketing-workspace">
    <header className="masthead">
      <div className="brand">
        <span className="brand-icon" aria-hidden="true">✦</span>
        <div><p className="brand-name">미리내</p><p className="brand-company">MEDICOM</p></div>
      </div>
      <nav className="masthead-actions" aria-label="업무 메뉴">
        <Link className="button button-reset masthead-link" href="/">문의함</Link>
        <button className="button button-reset" type="button" onClick={() => setConfirmReset(true)}>시연 초기화</button>
      </nav>
    </header>

    <div className="workspace-inner">
      <div className="page-heading">
        <div><h1>마케팅 협조 요청</h1><p>본사 세일즈 요청을 처리하고 유입 리드의 품질을 확인하세요.</p></div>
        {publicDemo && <span className="marketing-pill">공개 시연 · 기록 재생</span>}
      </div>
      <div className="marketing-actions marketing-workspace-actions">
        <button type="button" className="button button-primary" aria-expanded={openPanel === "intake"}
          onClick={() => setOpenPanel(openPanel === "intake" ? null : "intake")}>요청 접수</button>
        <button type="button" className="button button-light" aria-expanded={openPanel === "requester"}
          onClick={() => setOpenPanel(openPanel === "requester" ? null : "requester")}>요청자 보기</button>
        {openPanel !== "requester" && <a className="button button-light marketing-anchor" href="#campaign-tracking-title">캠페인 효과 보기</a>}
      </div>
      {confirmReset && <div className="feedback confirm" role="status">
        <p>이 브라우저의 마케팅 접수, 처리, 순위 조정, 채널 설정과 초안 기록을 지울까요?</p>
        <button className="button button-light" type="button" onClick={() => setConfirmReset(false)}>취소</button>
        <button className="button button-primary" type="button" onClick={reset}>초기화 확인</button>
      </div>}
      {error && <p className="feedback" role="alert">{error}</p>}
      {notice && <p className="feedback" role="status">{notice}</p>}
      {openPanel === "intake" && <RequestIntake leads={tracking.leadOptions} submit={receive} cancel={() => setOpenPanel(null)} />}
      {openPanel === "requester" ? <RequesterView requests={summaries} /> : <>
      <div className="marketing-board">
        <div className="marketing-left">
          <section className="marketing-card marketing-queue" aria-labelledby="marketing-priority">
            <div className="marketing-section-head">
              <h2 id="marketing-priority">요청 우선순위</h2>
              <span>{state.order.length}건</span>
            </div>
            <div className="marketing-deadline-summary" aria-label="마감 상태">
              <span>마감 임박 {imminent}건</span><span>마감 초과 {overdue}건</span>
            </div>
            <div className="marketing-list-heading" aria-hidden="true">
              <span>순위</span><span>요청</span><span>지역</span><span>마감</span><span>점수</span>
            </div>
            <ol className="marketing-list" aria-labelledby="marketing-priority" role="list">
              {state.order.map((id, index) => {
                const request = requests.get(id);
                if (!request) return null;
                const warning = warnings.get(id);
                return <li key={id}>
                  <button type="button" className="marketing-request" aria-pressed={id === selected.id}
                    aria-label={(index + 1) + "위 " + id + " · " + request.region + (request.repeats.length ? " · 반복 요청" : "")
                      + (warning ? " · " + warning : "") + " " + request.title + " AI " + request.score + "점"}
                    onClick={() => chooseRequest(id)}>
                    <span className="marketing-rank">{index + 1}위</span>
                    <span className="marketing-request-text">
                      <span className="muted">{id}{request.repeats.length > 0 ? " · 반복 요청" : ""}</span>
                      <strong>{request.title}</strong>
                    </span>
                    <span className="marketing-request-region">{request.region}</span>
                    <span className="marketing-request-deadline">
                      <span aria-hidden="true">{request.deadlineDays === null ? "—" : request.deadlineDays === 0 ? "오늘"
                        : "D" + (request.deadlineDays < 0 ? "+" : "−") + Math.abs(request.deadlineDays)}</span>
                      {warning && <span className="marketing-deadline-warning">{warning}</span>}
                    </span>
                    <span className="marketing-score">
                      AI {request.score}점
                      <span className="marketing-score-track" aria-hidden="true">
                        <span style={{ inlineSize: request.score + "%" }} />
                      </span>
                    </span>
                  </button>
                </li>;
              })}
            </ol>
          </section>
          <section className="marketing-card marketing-repeat" aria-labelledby="marketing-repeat">
            <h2 id="marketing-repeat">반복 요청 묶기 제안</h2>
            {ranked.flatMap(row => row.repeats.filter(id => row.id < id).map(id => <p key={row.id + "-" + id}>
              <strong>{row.id} · {id}</strong> — 같은 상품과 요청 유형입니다. 공동 초안으로 준비할 수 있습니다.
            </p>))}
          </section>
          {state.rankChanges.length > 0 && <section className="marketing-card marketing-change-log" aria-labelledby="marketing-rank-log">
            <h2 id="marketing-rank-log">순위 조정 기록</h2>
            <ol>
              {state.rankChanges.map((change, index) => <li key={state.rankChanges.length - index}>
                <strong>{change.requestId} · {change.reason}</strong>
                <ul>
                  {change.rankings.map(item => <li key={item.id}>{item.id} · AI {item.score}점 · 사람 순위 {item.before}위 → {item.after}위</li>)}
                </ul>
              </li>)}
            </ol>
          </section>}
        </div>

        <article className="marketing-card marketing-detail" aria-labelledby="marketing-selected">
          <header className="marketing-detail-head">
            <p className="muted">{selected.id} · {selected.requester} · {selected.region}</p>
            <h2 id="marketing-selected" ref={detailHeading} tabIndex={-1}>{selected.title}</h2>
            <div className="marketing-pills">
              <span className="marketing-pill">AI {selected.score}점 · {ranked.findIndex(row => row.id === selected.id) + 1}위</span>
              <span className="marketing-pill marketing-human">사람 순위 {rank}위</span>
              {selected.warning && <span className="marketing-pill marketing-deadline-warning">{selected.warning}</span>}
            </div>
            {submitted && <p className="marketing-submission-memo">{submitted.memo}</p>}
            {submitted?.leadId && <p className="muted">연결 리드 {submitted.leadId} · 딜 단계 {submitted.stage} <span className="marketing-field-source">문의함 기록</span></p>}
          </header>
          <section className="marketing-detail-section" aria-labelledby="marketing-score-reasons">
            <h3 id="marketing-score-reasons">우선순위 점수 근거</h3>
            <dl className="marketing-reasons">
              {selected.reasons.map(item => <div key={item.label}>
                <dt>{item.label} <strong>{item.points}점</strong></dt><dd>{item.reason}</dd>
              </div>)}
            </dl>
          </section>
          <section className="marketing-detail-section" aria-labelledby="marketing-adjust">
            <h3 id="marketing-adjust">실무자 순위 조정</h3>
            <form className="marketing-rank-form" onSubmit={saveRank}>
              <label>새 순위<select value={rankTarget} required onChange={event => setRankTarget(event.target.value)}>
                <option value="">선택</option>
                {state.order.map((id, index) => id !== selected.id && <option key={id} value={index + 1}>{index + 1}위</option>)}
              </select></label>
              <label>조정 사유<input value={reason} required maxLength={180} onChange={event => setReason(event.target.value)} /></label>
              <button className="button button-primary" type="submit" disabled={!rankTarget || !reason.trim()}>순위 저장</button>
            </form>
          </section>
          <RequestWorkflow key={selected.id} history={selected.history} approved={approved} change={changeWorkflow} />
          <section className="marketing-detail-section" aria-labelledby="marketing-drafts">
            <div className="marketing-section-head">
              <h3 id="marketing-drafts">채널별 초안</h3><span>발송·게시 없음</span>
            </div>
            <ul className="marketing-channels">
              {marketingChannels.map(channel => {
                const recommended = selected.recommendedChannels.some(id => id === channel.id);
                const enabled = state.channels[selected.id]?.[channel.id] ?? recommended;
                const key = selected.id + ":" + channel.id;
                const effect = tracking.channelEffects[channel.id];
                return <li key={channel.id}>
                  <label className="marketing-channel-switch">
                    <input type="checkbox" aria-label={channel.label + " 사용"} checked={enabled} disabled={terminal}
                      onChange={event => toggleChannel(channel.id, event.target.checked)} />
                    {channel.label}
                  </label>
                  {recommended && <span className="marketing-pill">추천</span>}
                  <button className="button button-light marketing-channel-button" type="button"
                    disabled={!enabled || pending !== null || (terminal && !state.drafts[key])} aria-pressed={activeChannel === channel.id && enabled}
                    aria-label={channel.label + " 초안 보기"} onClick={() => void showDraft(channel.id)}>
                    {pending === key ? "준비 중…" : "초안 보기"}
                  </button>
                  {effect && <span className={effect.effect === "효과 낮음" ? "marketing-channel-effect marketing-deadline-warning" : "marketing-channel-effect"}>
                    {effect.effect}{effect.validRatio !== null && " · 유효 " + effect.valid + "/" + effect.total}
                  </span>}
                </li>;
              })}
            </ul>
            {activeEnabled && pending === draftKey && <p role="status">채널 초안을 준비하고 있습니다.</p>}
            {activeChannel && record && <DraftPreview key={draftKey} channel={activeChannel} record={record}
              editing={editing} setEditing={setEditing} saveDraft={saveDraft} readOnly={terminal} />}
          </section>
        </article>
      </div>
      <CampaignTracking campaigns={tracking.campaigns} issuedCodes={issuedCodes} />
      </>}
    </div>
  </main>;
}
