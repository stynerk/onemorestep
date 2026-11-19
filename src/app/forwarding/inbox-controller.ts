"use client";

import { useEffect, useRef, useState } from "react";
import { recommendDealer, recordDealerOutcome } from "../../lib/forwarding/dealers";
import { confirmedCountry, inboxBucket, lastReply, mailKindFor } from "../../lib/forwarding/inbox";
import { forwardingPolicy } from "../../lib/forwarding/policy";
import { createInitialForwardingState } from "../../lib/forwarding/seed";
import { createBrowserForwardingStore, type StoreResult } from "../../lib/forwarding/store";
import type { Assessment, DecisionAction, DealerDelivery, DealerOutcome, ForwardingEvent, LeadInput, MailKind, ReplyKind, WorkflowState } from "../../lib/forwarding/types";
import type { ForwardingMailResult } from "../../lib/forwarding/forwarding-mail.server";

type Assessed = { assessment: Assessment; workflow: WorkflowState };
const eventBase = (leadId: string) => ({ id: crypto.randomUUID(), at: new Date().toISOString(), leadId });
const operationKind = (event: ForwardingEvent, lead: LeadInput): MailKind | null =>
  event.type === "assessed" && !Object.hasOwn(forwardingPolicy.countryRegions, lead.country) ? "operations" : mailKindFor(event);

type MailState = { message: string; pending: boolean };

export function useInbox() {
  const [state, setState] = useState(createInitialForwardingState);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [mail, setMail] = useState<Record<string, MailState>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const store = useRef<ReturnType<typeof createBrowserForwardingStore> | null>(null);
  const assessing = useRef(new Set<string>());
  const mailing = useRef(new Set<string>());
  const batchRunning = useRef(false);

  useEffect(() => {
    const browserStore = createBrowserForwardingStore();
    const loaded = browserStore.hydrate();
    store.current = browserStore;
    // Apply the external storage snapshot after the browser completes hydration.
    queueMicrotask(() => {
      setState(loaded.state);
      setReady(loaded.ok);
      setNow(Date.now());
      if (!loaded.ok) setError("저장된 시연 기록을 열 수 없습니다. 시연 초기화로 다시 시작해 주세요.");
    });
  }, []);

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

  async function sendMail(event: ForwardingEvent, kind: MailKind, retryOf?: string) {
    const key = event.leadId + ":" + kind;
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
      if (result.event) append(result.event);
      if (typeof result.message === "string") message = result.message;
    } catch {
      // Mail delivery can be uncertain after a client-side timeout. The same event is queried on manual retry.
    } finally {
      mailing.current.delete(key);
      setMail((previous) => ({ ...previous, [key]: { pending: false, message } }));
    }
  }

  function offerMail(event: ForwardingEvent, lead: LeadInput, previous: ForwardingEvent[]) {
    const kind = operationKind(event, lead);
    if (!kind || previous.some((item) => item.leadId === lead.id && operationKind(item, lead) === kind)) return;
    void sendMail(event, kind);
  }

  function mailFor(lead: LeadInput) {
    const requests = new Map<MailKind, ForwardingEvent>();
    for (const event of state.events) {
      if (event.leadId !== lead.id) continue;
      const kind = operationKind(event, lead);
      if (kind && !requests.has(kind)) requests.set(kind, event);
    }
    return [...requests].map(([kind, event]) => {
      const latest = state.events.findLast((item) => item.type === "mail-delivery" && item.leadId === lead.id && item.kind === kind);
      const delivery = latest?.type === "mail-delivery" ? latest : undefined;
      return {
        kind, delivery, status: mail[lead.id + ":" + kind],
        retry: () => sendMail(event, kind, delivery?.status === "failed" ? delivery.id : undefined),
      };
    });
  }

  async function assess(lead: LeadInput) {
    if (assessing.current.has(lead.id)) return;
    assessing.current.add(lead.id);
    setPending((current) => [...current, lead.id]);
    try {
      const snapshot = store.current?.snapshot();
      if (!snapshot) return;
      const country = confirmedCountry(snapshot, lead.id);
      const partnershipPurchase = lastReply(snapshot.events, lead.id, "partnership")?.selection === "purchase";
      let result: Assessed;
      try {
        const response = await fetch("/api/forwarding/assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, country, partnershipPurchase: partnershipPurchase || undefined }),
          signal: AbortSignal.timeout(60000),
        });
        if (!response.ok) throw new Error("Assessment request failed");
        result = await response.json() as Assessed;
        if (!result?.assessment) throw new Error("Missing assessment");
      } catch {
        result = {
          assessment: {
            verdict: "ambiguous", reason: "외부 확인 실패, 다시 시도", sources: [], searchedAt: new Date().toISOString(),
            mode: "saved", details: { domain: "unverified", countries: [], industry: null, memoIntent: "unknown", memoQuote: null, externalStatus: "failed", sourceKind: "local" },
          },
          workflow: "decision-pending",
        };
      }
      const previous = store.current?.snapshot();
      if (!previous) return;
      const assessment = result.assessment;
      let workflow = result.workflow;
      if (assessment.verdict === "valid") {
        previous.leadStates[lead.id].assessment = assessment;
        const recommendation = recommendDealer(previous, lead.id, { country });
        if (recommendation?.route === "manager-confirmation" && !lastReply(previous.events, lead.id, "manager-confirmation")?.selection) {
          workflow = "manager-confirmation-pending";
        }
      }
      const event: ForwardingEvent = { ...eventBase(lead.id), type: "assessed", assessment, workflow };
      if (append(event)) {
        offerMail(event, lead, previous.events);
        if (lead.id === "L06" && assessment.verdict === "valid") setSelected((current) => current ?? lead.id);
      }
    } finally {
      assessing.current.delete(lead.id);
      setPending((current) => current.filter((id) => id !== lead.id));
    }
  }

  async function assessAll() {
    if (!ready || batchRunning.current) return;
    batchRunning.current = true;
    setRunning(true);
    setError("");
    try {
      // A failed lead becomes ambiguous while the other workers keep moving.
      const queue = [...(store.current?.snapshot().leads ?? [])];
      const worker = async () => {
        for (let lead = queue.shift(); lead; lead = queue.shift()) await assess(lead);
      };
      await Promise.all([worker(), worker(), worker()]);
    } finally {
      batchRunning.current = false;
      setRunning(false);
    }
  }

  function decide(lead: LeadInput, action: DecisionAction, dealerId: string | null, reason: string) {
    const snapshot = store.current?.snapshot();
    if (!snapshot || !ready) return;
    const status = snapshot.leadStates[lead.id];
    if (status.dealerId || status.workflow === "disqualified") return;
    if ((action === "approve" || action === "change-dealer") && (!dealerId || status.assessment?.verdict !== "valid")) return;
    const event: ForwardingEvent = { ...eventBase(lead.id), type: "decision", action, dealerId, reason };
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
    if (store.current) apply(recordDealerOutcome(store.current, { ...eventBase(delivery.leadId), delivery, outcome }));
  }

  function reset() {
    if (!store.current || batchRunning.current || assessing.current.size || mailing.current.size) return;
    const result = store.current.reset();
    if (!apply(result)) return;
    setError("");
    setSelected(null);
    setMail({});
    setReady(true);
  }

  return { state, ready, now, error, running, pending, mail, selected, setSelected, assess, assessAll, decide,
    bulkInvalid, reopen, saveReply, saveOutcome, reset, mailFor };
}

export type InboxController = ReturnType<typeof useInbox>;
