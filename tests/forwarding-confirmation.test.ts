import assert from "node:assert/strict";
import test from "node:test";
import { POST as assess } from "../src/app/api/forwarding/assess/route";
import { POST as sendMail } from "../src/app/api/forwarding/mail/route";
import { automaticConfirmationFor, confirmationReply } from "../src/lib/forwarding/confirmation";
import { regionalSalesHandoff } from "../src/lib/forwarding/handoff";
import { automaticConfirmationForLead, mailRequestsFor } from "../src/lib/forwarding/inbox";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { applyForwardingEvent, createForwardingStore } from "../src/lib/forwarding/store";
import type { Assessment, AutomaticConfirmation, ForwardingEvent, WorkflowState } from "../src/lib/forwarding/types";

const at = "2026-11-25T00:00:00.000Z";
const state = createInitialForwardingState();
const lead = state.leads.find(({ id }) => id === "L08")!;
const freeEmail: Assessment = {
  verdict: "ambiguous", reason: "무료 이메일로는 기관 소속을 확인하기 어려워요.", sources: [], searchedAt: at, mode: "saved",
  details: { domain: "free-email", countries: [], industry: null, memoIntent: "buying", memoQuote: null,
    externalStatus: "complete", sourceKind: "curated" },
  handoff: { kind: "regional-sales", region: "NA" },
};
const weakIntent: Assessment = {
  ...freeEmail, reason: "문의 의도를 전화로 확인해야 해요.",
  details: { ...freeEmail.details!, domain: "matched", memoIntent: "unknown" },
};

test("the five new routing countries use their configured region", () => {
  for (const [country, region] of Object.entries({ 스위스: "EU", 스페인: "EU", 네덜란드: "EU", 콜롬비아: "LATAM", 이스라엘: "MEA" })) {
    assert.deepEqual(regionalSalesHandoff(country), { kind: "regional-sales", region });
  }
});

test("automatic confirmation uses the engine checks independently of wording or memo quotes", () => {
  const rewordedFreeMail = { ...freeEmail, reason: "기관 메일 확인 요청 문구 갱신" };
  assert.equal(automaticConfirmationFor(freeEmail), "free-email");
  assert.equal(automaticConfirmationFor(rewordedFreeMail), "free-email");

  for (const memoQuote of [null, "담당 부서에서 어떤 내용을 더 보내 드리면 될까요?", "Demande de présentation du matériel"]) {
    const reworded = { ...weakIntent, reason: "새 의도 확인 안내", details: { ...weakIntent.details!, memoQuote } };
    assert.equal(automaticConfirmationFor(reworded), "weak-intent");
  }
  assert.equal(automaticConfirmationFor({
    ...weakIntent, details: { ...weakIntent.details!, memoIntent: "partnership" },
  }), "weak-intent");
});

test("failed external checks, suspicious domains and ambiguous confirmed purchases stay with people", () => {
  assert.equal(automaticConfirmationFor({ ...freeEmail, verdict: "valid" }), null);
  assert.equal(automaticConfirmationFor({ ...freeEmail, details: undefined }), null);
  for (const candidate of [freeEmail, weakIntent]) {
    assert.equal(automaticConfirmationFor({ ...candidate, details: { ...candidate.details!, externalStatus: "failed" } }), null);
    assert.equal(automaticConfirmationFor({ ...candidate, details: { ...candidate.details!, domain: "suspicious" } }), null);
  }
  const purchase = { ...weakIntent, details: { ...weakIntent.details!, memoIntent: "buying" } } satisfies Assessment;
  assert.equal(automaticConfirmationFor(purchase), null);
  assert.equal(automaticConfirmationFor({ ...weakIntent, details: { ...weakIntent.details!, routerMemoIntent: "buying" } }), null);
  assert.equal(automaticConfirmationFor({ ...freeEmail, details: { ...freeEmail.details!, routerMemoIntent: "buying" } }), "free-email");
  assert.equal(automaticConfirmationFor({ ...purchase, details: { ...purchase.details, domain: "unverified" } }), null);
});


test("automatic mail is tied to the first eligible assessment and the reply survives hydration", () => {
  let saved: string | null = null;
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; }, removeItem: () => { saved = null; } };
  const store = createForwardingStore(storage);
  const assessment = { id: "r3-1", leadId: lead.id, at, type: "assessed", assessment: freeEmail, workflow: "reply-pending" } as const;
  assert.ok(store.append(assessment).ok);
  const checked = { ...freeEmail, details: { ...freeEmail.details!, routerMemoIntent: "buying" } } satisfies Assessment;
  assert.equal(store.append({ ...assessment, id: "bad-router-intent", assessment: { ...checked, details: { ...checked.details, routerMemoIntent: "arbitrary" } } }).ok, false);
  assert.ok(store.append({ ...assessment, id: "r3-2", assessment: checked }).ok);
  assert.equal(automaticConfirmationForLead(store.snapshot(), lead), "free-email");
  assert.deepEqual(mailRequestsFor(store.snapshot().events, lead).map(({ event, kind }) => [event.id, kind]), [["r3-1", "free-email-confirmation"]]);

  const reply = {
    id: "r3-reply", leadId: lead.id, at, type: "reply", kind: "free-email", text: "reply-demo@mayoclinic.org",
  } as const;
  assert.equal(applyForwardingEvent(state, reply).ok, false);
  assert.equal(store.append({ ...reply, text: "reply-demo@sub.gmail.com" }).ok, false);
  assert.equal(confirmationReply({ kind: "free-email", text: "reply-demo@example.test" }), null);
  const accepted = store.append(reply);
  assert.ok(accepted.ok);
  assert.equal(automaticConfirmationForLead(accepted.state, lead), null);
  assert.equal(store.append({ ...reply, id: "r3-reply-again" }).ok, false);
  const restored = createForwardingStore(storage).hydrate();
  assert.ok(restored.ok);
  assert.equal(restored.state.leadStates[lead.id].workflow, "decision-pending");
  assert.equal(restored.state.leadStates[lead.id].assessment?.details?.routerMemoIntent, "buying");
  assert.deepEqual(restored.state.events.at(-1), reply);
  const legacy: ForwardingEvent = { ...assessment, workflow: "decision-pending" };
  assert.deepEqual(mailRequestsFor([legacy], lead), []);
});

function jsonRequest(path: string, body: unknown) {
  return new Request("http://localhost" + path, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify(body),
  });
}

test("public confirmation replies reclassify saved inputs and mail still returns 403", async (t) => {
  const previousTarget = process.env.MIRINAE_DEMO_TARGET;
  process.env.MIRINAE_DEMO_TARGET = "public";
  t.after(() => {
    if (previousTarget === undefined) delete process.env.MIRINAE_DEMO_TARGET;
    else process.env.MIRINAE_DEMO_TARGET = previousTarget;
  });

  async function assessment(leadId: string, confirmation?: { kind: AutomaticConfirmation; text: string }) {
    const response = await assess(jsonRequest("/api/forwarding/assess", { leadId, confirmation }));
    assert.equal(response.status, 200);
    return await response.json() as { assessment: Assessment; workflow: WorkflowState };
  }

  for (const [leadId, kind] of [["L08", "free-email"], ["L09", "weak-intent"]] as const) {
    const initial = await assessment(leadId);
    assert.equal(initial.assessment.verdict, "ambiguous");
    assert.equal(initial.workflow, "reply-pending");
    assert.equal(automaticConfirmationFor(initial.assessment), kind);
  }
  assert.equal((await assessment("L28")).workflow, "decision-pending");
  const confirmedMail = await assessment("L08", { kind: "free-email", text: "reply-demo@mayoclinic.org" });
  assert.equal(confirmedMail.assessment.details?.domain, "matched");
  assert.equal(confirmedMail.assessment.verdict, "ambiguous");
  assert.equal(confirmedMail.workflow, "decision-pending");
  assert.match(confirmedMail.assessment.reason, /기관 소재지를 한 나라로 확인하지 못했어요/);
  const mismatchedMail = await assessment("L08", { kind: "free-email", text: "reply-demo@clevelandclinic.org" });
  assert.equal(mismatchedMail.assessment.verdict, "ambiguous");
  assert.equal(mismatchedMail.workflow, "decision-pending");
  const weakReply = await assessment("L09", { kind: "weak-intent", text: "For reference only" });
  assert.equal(weakReply.assessment.verdict, "ambiguous");
  assert.equal(weakReply.workflow, "decision-pending");
  const purchasePlan = await assessment("L09", { kind: "weak-intent", text: "We plan to purchase 12 devices next quarter." });
  assert.equal(purchasePlan.assessment.verdict, "valid");
  const blocked = await sendMail(jsonRequest("/api/forwarding/mail", {
    event: { id: "r3-blocked", at, leadId: lead.id, type: "assessed", assessment: freeEmail, workflow: "reply-pending" },
  }));
  assert.equal(blocked.status, 403);
});
