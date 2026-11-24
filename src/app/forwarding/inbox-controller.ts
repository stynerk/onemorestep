"use client";

import { useEffect, useRef, useState } from "react";
import { recommendDealer, recordDealerOutcome } from "../../lib/forwarding/dealers";
import { getDirectionQuestion, type DirectionKind } from "../../lib/forwarding/direction-questions";
import { applyDirectionConfirmation, DIRECTION_ACTOR, directionConfirmationFor, isDirectionAnswerFor } from "../../lib/forwarding/direction-resolution";
import { regionalSalesHandoff } from "../../lib/forwarding/handoff";
import { createIndustryState, regionalHandoffForPolicy, type DemoIndustry } from "../../lib/forwarding/industry-demo";
import { confirmedCountry, confirmedManagerDealer, inboxBucket, lastReply, mailKindForLead, mailRequestsFor, responseDeadline } from "../../lib/forwarding/inbox";
import { openAssignment, reassignmentTarget, responseClock, type ReassignmentProposal } from "../../lib/forwarding/reassignment";
import { createBrowserForwardingStore, type StoreResult } from "../../lib/forwarding/store";
import type { Assessment, DecisionAction, DealerDelivery, DealerOutcome, DirectionAnswer, ForwardingEvent, ForwardingState, LeadInput, ReplyKind, WorkflowState } from "../../lib/forwarding/types";
import type { ForwardingMailResult } from "../../lib/forwarding/forwarding-mail.server";

type Assessed = { assessment: Assessment; workflow: WorkflowState };
const eventBase = (leadId: string, at = Date.now()) => ({ id: crypto.randomUUID(), at: new Date(at).toISOString(), leadId });

type MailState = { message: string; pending: boolean };

export function useInbox(publicDemo: boolean, liveAssessment: boolean, industry: DemoIndustry) {
  const [state, setState] = useState(() => createIndustryState(industry));
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [simulatedNow, setSimulatedNow] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [mail, setMail] = useState<Record<string, MailState>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const store = useRef<ReturnType<typeof createBrowserForwardingStore> | null>(null);
  const assessing = useRef(new Set<string>());
  const mailing = useRef(new Set<string>());
  const batchRunning = useRef(false);
  const pageExit = useRef<AbortController | null>(null);

  useEffect(() => {
    const browserStore = createBrowserForwardingStore(industry);
    const loaded = browserStore.hydrate();
    store.current = browserStore;
    const navigation = new AbortController();
    pageExit.current = navigation;
    // Apply the external storage snapshot after the browser completes hydration.
    queueMicrotask(() => {
      if (store.current !== browserStore) return;
      setState(loaded.state);
      setReady(loaded.ok);
      setNow(Date.now());
      if (!loaded.ok) setError("저장된 시연 기록을 열 수 없습니다. 시연 초기화로 다시 시작해 주세요.");
    });
    const suspend = () => pageExit.current?.abort();
    const resume = () => { if (pageExit.current?.signal.aborted) pageExit.current = new AbortController(); };
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", resume);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      suspend();
      store.current = null;
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", resume);
      window.clearInterval(timer);
    };
  }, [industry]);

  const responseNow = responseClock(state, now, simulatedNow);

  function apply(result: StoreResult) {
    if (!result.ok) {
      setError("변경을 저장하지 못했습니다. 브라우저 저장소와 입력을 확인해 주세요.");
      return false;
    }
    setState(result.state);
    setNow(Date.now());
    return !result.duplicate;
  }

  function append(event: ForwardingEvent) {
    const result = store.current?.append(event);
    return result ? apply(result) : false;
  }

  async function sendMail(event: ForwardingEvent, retryOf?: string) {
    if (publicDemo) return;
    const key = event.id;
    if (mailing.current.has(key)) return;
    mailing.current.add(key);
    setMail((previous) => ({ ...previous, [key]: { pending: true, message: "테스트 메일 처리 중…" } }));
    let message = "메일 상태를 확인하지 못했습니다. 같은 기록에서 상태를 다시 확인할 수 있습니다.";
    try {
      const response = await fetch("/api/forwarding/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, retryOf }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json() as ForwardingMailResult;
      const delivery = result.event;
      if (delivery && !store.current?.snapshot().events.some((item) => item.id === delivery.id)) append(delivery);
      if (typeof result.message === "string") message = result.message;
    } catch {
      // Mail delivery can be uncertain after a client-side timeout. The same event is queried on manual retry.
    } finally {
      mailing.current.delete(key);
      setMail((previous) => ({ ...previous, [key]: { pending: false, message } }));
    }
  }

  function offerMail(event: ForwardingEvent, lead: LeadInput, previous: ForwardingEvent[]) {
    const kind = mailKindForLead(event, lead, state.policy);
    if (!kind || (event.type === "assessed" && previous.some((item) => item.leadId === lead.id && mailKindForLead(item, lead, state.policy) === kind))) return;
    void sendMail(event);
  }

  function mailFor(lead: LeadInput) {
    return mailRequestsFor(state.events, lead, state.policy).map(({ kind, event, delivery }) => ({
      id: event.id, kind, delivery, status: mail[event.id],
      dealerName: event.type === "decision" || event.type === "reassigned" ? state.dealers.find((dealer) => dealer.id === event.dealerId)?.name : undefined,
      retry: () => sendMail(event, delivery?.status === "failed" ? delivery.id : undefined),
    }));
  }

  function needsDirection(snapshot: ForwardingState, lead: LeadInput) {
    const status = snapshot.leadStates[lead.id];
    const assessment = status?.assessment;
    if (status?.workflow !== "decision-pending" || assessment?.verdict !== "ambiguous"
      || snapshot.events.findLast((event) => event.leadId === lead.id && (event.type === "assessed" || event.type === "decision"))?.type === "decision") return false;
    const question = getDirectionQuestion(lead, assessment);
    return assessment.directionConfirmation?.kind !== question.kind && assessment.directionConfirmation?.choice !== "unknown";
  }

  function applyRememberedDirections(snapshot: ForwardingState, lead: LeadInput, initial: Assessment) {
    let assessment = initial;
    const applied = new Set<DirectionKind>();
    if (initial.directionConfirmation) applied.add(initial.directionConfirmation.kind);
    while (assessment.verdict === "ambiguous" && assessment.directionConfirmation?.choice !== "unknown") {
      const confirmation = directionConfirmationFor(snapshot, lead, assessment);
      if (!confirmation || applied.has(confirmation.kind)) break;
      applied.add(confirmation.kind);
      assessment = applyDirectionConfirmation(lead, assessment, confirmation, snapshot);
    }
    return assessment;
  }

  function saveAssessment(lead: LeadInput, assessment: Assessment, workflow: WorkflowState, previous: ForwardingState, country?: string) {
    if (assessment.verdict === "valid") {
      previous.leadStates[lead.id].assessment = assessment;
      const recommendation = recommendDealer(previous, lead.id, { country: confirmedCountry(previous, lead.id) ?? country });
      if (recommendation?.route === "manager-confirmation" && !lastReply(previous.events, lead.id, "manager-confirmation")?.selection) {
        workflow = "manager-confirmation-pending";
      }
    }
    const event: ForwardingEvent = { ...eventBase(lead.id), type: "assessed", assessment, workflow };
    if (!append(event)) return false;
    offerMail(event, lead, previous.events);
    if (industry.id === "medicom" && lead.id === "L06" && assessment.verdict === "valid") setSelected((current) => current ?? lead.id);
    return true;
  }

  function directionWorkflow(assessment: Assessment): WorkflowState {
    return assessment.verdict === "country-check" || assessment.verdict === "partnership-check" ? "reply-pending" : "decision-pending";
  }

  function answerDirection(lead: LeadInput, answer: DirectionAnswer & { note: string }) {
    const snapshot = store.current?.snapshot();
    if (!snapshot || !ready || batchRunning.current || assessing.current.has(lead.id) || !needsDirection(snapshot, lead)) return;
    const assessment = snapshot.leadStates[lead.id].assessment;
    if (!assessment || !isDirectionAnswerFor(lead, assessment, answer)) return;
    const confirmation = { ...answer, note: answer.note.trim().slice(0, 400), at: new Date().toISOString(),
      actor: DIRECTION_ACTOR, previous: false };
    const updated = applyDirectionConfirmation(lead, assessment, confirmation, snapshot);
    if (updated === assessment || !saveAssessment(lead, updated, directionWorkflow(updated), snapshot)) return;
    setSelected(lead.id);
    return answer.choice === "unknown" || updated.verdict !== "ambiguous" || getDirectionQuestion(lead, updated).kind === answer.kind;
  }

  async function assess(lead: LeadInput) {
    const navigation = pageExit.current;
    if (!navigation || navigation.signal.aborted || assessing.current.has(lead.id)) return;
    const exit = navigation.signal;
    // Reload can reject fetch before pagehide runs. Cancel without persisting a failure.
    const cancelOnReload = () => navigation.abort();
    window.addEventListener("beforeunload", cancelOnReload);
    assessing.current.add(lead.id);
    setPending((current) => [...current, lead.id]);
    try {
      const snapshot = store.current?.snapshot();
      if (!snapshot) return;
      const country = lastReply(snapshot.events, lead.id, "country")?.selection;
      const partnershipPurchase = lastReply(snapshot.events, lead.id, "partnership")?.selection === "purchase";
      let result: Assessed;
      try {
        const response = await fetch("/api/forwarding/assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, industry: industry.id === "medicom" ? undefined : industry.id,
            country, partnershipPurchase: partnershipPurchase || undefined }),
          // Live requests may queue behind the shared Liner concurrency limit.
          signal: AbortSignal.any([exit, AbortSignal.timeout(liveAssessment ? 60_000 : 8_000)]),
        });
        if (!response.ok) throw new Error("Assessment request failed");
        result = await response.json() as Assessed;
        if (!result?.assessment) throw new Error("Missing assessment");
      } catch {
        result = {
          assessment: {
            verdict: "ambiguous", reason: "외부 확인 실패, 다시 시도", sources: [], searchedAt: new Date().toISOString(),
            handoff: regionalHandoffForPolicy(regionalSalesHandoff(lead.country), lead.country, snapshot.policy),
            mode: "saved", details: { domain: "unverified", countries: [], industry: null, memoIntent: "unknown", memoQuote: null, externalStatus: "failed", sourceKind: "local" },
          },
          workflow: "decision-pending",
        };
      }
      if (exit.aborted) return;
      const previous = store.current?.snapshot();
      if (!previous) return;
      const assessment = applyRememberedDirections(previous, country ? { ...lead, country } : lead, result.assessment);
      saveAssessment(lead, assessment, assessment === result.assessment ? result.workflow : directionWorkflow(assessment), previous, country);
    } finally {
      window.removeEventListener("beforeunload", cancelOnReload);
      assessing.current.delete(lead.id);
      if (store.current) setPending((current) => current.filter((id) => id !== lead.id));
    }
  }

  async function assessAll() {
    const exit = pageExit.current?.signal;
    if (!ready || !exit || exit.aborted || batchRunning.current) return;
    batchRunning.current = true;
    setRunning(true);
    setError("");
    try {
      // A failed lead becomes ambiguous while the other workers keep moving.
      const queue = [...(store.current?.snapshot().leads ?? [])];
      const worker = async () => {
        for (let lead = queue.shift(); lead && !exit.aborted; lead = queue.shift()) await assess(lead);
      };
      await Promise.all([worker(), worker(), worker()]);
    } finally {
      batchRunning.current = false;
      if (store.current) setRunning(false);
    }
  }

  function decide(lead: LeadInput, action: DecisionAction, dealerId: string | null, reason: string) {
    const snapshot = store.current?.snapshot();
    if (!snapshot || !ready) return;
    const status = snapshot.leadStates[lead.id];
    if (status.dealerId || status.workflow === "disqualified") return;
    if (action === "approve" || action === "change-dealer") {
      const recommendation = recommendDealer(snapshot, lead.id, { country: confirmedCountry(snapshot, lead.id) });
      const eligible = recommendation?.route === "dealer" && recommendation.ranked.some((row) => row.dealer.id === dealerId);
      const confirmed = recommendation?.route === "manager-confirmation" && confirmedManagerDealer(snapshot, lead.id) === dealerId
        && recommendation.candidates.some((row) => row.dealer.id === dealerId);
      if (!eligible && !confirmed) return;
    }
    const event: ForwardingEvent = { ...eventBase(lead.id, responseClock(snapshot, Date.now(), simulatedNow)), type: "decision", action, dealerId, reason };
    if (append(event)) offerMail(event, lead, snapshot.events);
  }

  function simulateDeadline(lead: LeadInput) {
    const snapshot = store.current?.snapshot();
    const delivery = snapshot && openAssignment(snapshot, lead.id);
    if (!snapshot || !delivery) return;
    setSimulatedNow((current) => Math.max(current ?? 0, Date.parse(responseDeadline(snapshot, delivery.forwardedAt))));
  }

  function approveReassignment(lead: LeadInput, proposal: ReassignmentProposal) {
    const snapshot = store.current?.snapshot();
    if (!snapshot || !ready || openAssignment(snapshot, lead.id)?.id !== proposal.delivery.id) return;
    const at = responseClock(snapshot, Date.now(), simulatedNow);
    const event: ForwardingEvent = {
      ...eventBase(lead.id, at), type: "reassigned", previousDeliveryId: proposal.delivery.id, ...reassignmentTarget(proposal),
    };
    if (append(event)) offerMail(event, lead, snapshot.events);
  }

  function bulkInvalid() {
    const snapshot = store.current?.snapshot();
    if (!snapshot) return;
    for (const lead of snapshot.leads) {
      if (inboxBucket(snapshot, lead) === "invalid" && snapshot.leadStates[lead.id].workflow !== "disqualified" && !snapshot.leadStates[lead.id].dealerId) {
        decide(lead, "disqualify", null, "무효 묶음 일괄 처리");
      }
    }
  }

  function reopen(lead: LeadInput) {
    append({ ...eventBase(lead.id), type: "review-reopened" });
  }

  async function saveReply(lead: LeadInput, kind: ReplyKind, text: string, selection: string) {
    if (!text.trim() || !selection || assessing.current.has(lead.id)) return;
    if (!append({ ...eventBase(lead.id), type: "reply", kind, text: text.trim(), selection })) return;
    if (kind !== "manager-confirmation") await assess(lead);
  }

  function saveOutcome(delivery: DealerDelivery, outcome: Exclude<DealerOutcome, "in-progress">) {
    const snapshot = store.current?.snapshot();
    if (store.current && snapshot) {
      apply(recordDealerOutcome(store.current, {
        ...eventBase(delivery.leadId, responseClock(snapshot, Date.now(), simulatedNow)), delivery, outcome,
      }));
    }
  }

  function reset() {
    if (!store.current || batchRunning.current || assessing.current.size || mailing.current.size) return false;
    const result = store.current.reset();
    if (!apply(result)) return false;
    setError("");
    setSelected(null);
    setMail({});
    setSimulatedNow(null);
    setReady(true);
    return true;
  }

  return { state, ready, publicDemo, dealerLabel: industry.dealer, now, responseNow, simulatedNow, clearSimulation: () => setSimulatedNow(null),
    error, running, pending, mail, selected, setSelected, assess, assessAll, decide,
    directionLeads: state.leads.filter((lead) => needsDirection(state, lead)), answerDirection,
    bulkInvalid, reopen, saveReply, saveOutcome, simulateDeadline, approveReassignment, reset, mailFor };
}

export type InboxController = ReturnType<typeof useInbox>;
