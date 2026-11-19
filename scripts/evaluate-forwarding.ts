import { readFile } from "node:fs/promises";
import { createAssessmentService } from "../src/lib/forwarding/assessment-service";
import { recommendDealer } from "../src/lib/forwarding/dealers";
import demoAnswers from "../src/lib/forwarding/evaluation/ground-truth.json";
import { forwardingPolicy } from "../src/lib/forwarding/policy";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { EXTERNAL_STATUSES, SOURCE_KINDS, VERDICTS } from "../src/lib/forwarding/types";
import type { Assessment, LeadInput, Verdict } from "../src/lib/forwarding/types";

const routes = ["dealer", "manager-direct", "manager-confirmation", "operations"] as const;
type Route = (typeof routes)[number];
type Routing = { route: Route | null; dealerId: string | null };
type Answer = Routing & { leadId: string; verdict: Verdict };
type Dataset = { name: string; leads: LeadInput[]; answers: Answer[] };
type Comparison = { id: string; expected: Answer; assessment: Assessment; actualRouting: Routing };

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const member = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === "string" && options.some((option) => option === value);
const id = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/.test(value);

function validLead(row: unknown): row is LeadInput {
  return object(row) && Object.keys(row).length === 9 && id(row.id) &&
    typeof row.name === "string" && typeof row.email === "string" && typeof row.phone === "string" &&
    typeof row.institution === "string" && typeof row.country === "string" && typeof row.memo === "string" &&
    typeof row.receivedAt === "string" && Number.isFinite(Date.parse(row.receivedAt)) &&
    typeof row.product === "string" && Object.hasOwn(forwardingPolicy.customerIndustries, row.product);
}

function validAnswer(row: unknown): row is Answer {
  return object(row) && Object.keys(row).length === 4 && id(row.leadId) && member(VERDICTS, row.verdict) &&
    (row.route === null || member(routes, row.route)) &&
    (row.route === "dealer" ? id(row.dealerId) : row.dealerId === null);
}

function dataset(name: string, size: number, leads: unknown, answers: unknown): Dataset {
  if (!Array.isArray(leads) || leads.length !== size || !leads.every(validLead) ||
    !Array.isArray(answers) || answers.length !== size || !answers.every(validAnswer)) {
    throw new Error(name + " requires " + size + " operational inputs and " + size + " completed evaluation labels.");
  }
  const answerIds = new Set(answers.map((answer) => answer.leadId));
  if (answerIds.size !== size || new Set(leads.map((lead) => lead.id)).size !== size ||
    leads.some((lead) => !answerIds.has(lead.id))) throw new Error(name + " input and answer IDs must match one to one.");
  return { name, leads, answers };
}

async function evaluate({ leads, answers }: Dataset): Promise<Comparison[]> {
  let liveCalls = 0;
  const service = createAssessmentService({
    now: () => Date.parse(forwardingPolicy.referenceDate),
    fetcher: async () => { liveCalls += 1; throw new Error("Evaluation must run offline"); },
  });
  const state = createInitialForwardingState();
  state.leads = leads;
  state.leadStates = Object.fromEntries(leads.map((lead) => [lead.id, {
    leadId: lead.id, assessment: null, workflow: "new", dealerId: null,
  }]));
  const expected = new Map(answers.map((answer) => [answer.leadId, answer]));
  const results: Comparison[] = [];
  for (const lead of leads) {
    const { assessment, workflow } = await service.assess(lead, { mode: "sample" });
    state.leadStates[lead.id] = { leadId: lead.id, assessment, workflow, dealerId: null };
    const recommendation = recommendDealer(state, lead.id);
    const actualRouting: Routing = {
      route: member(routes, recommendation?.route) ? recommendation.route : null,
      dealerId: recommendation?.route === "dealer" ? recommendation.ranked[0].dealer.id : null,
    };
    results.push({ id: lead.id, expected: expected.get(lead.id)!, assessment, actualRouting });
  }
  if (liveCalls !== 0) throw new Error("Evaluation attempted a live call.");
  return results;
}

const matchRate = (correct: number, total: number) => ({ correct, total, percent: total === 0 ? null : 100 * correct / total });

function report(name: string, rows: Comparison[]) {
  const matrix = Object.fromEntries(VERDICTS.map((verdict) => [verdict, Object.fromEntries(VERDICTS.map((key) => [key, 0]))]));
  const sourceKinds = Object.fromEntries(SOURCE_KINDS.map((kind) => [kind, 0]));
  const externalStatuses = Object.fromEntries(EXTERNAL_STATUSES.map((status) => [status, 0]));
  const verdictMismatches = [];
  const routingMismatches = [];
  let labeledRoutes = 0;
  let labeledDealers = 0;
  let correctDealers = 0;

  for (const { id, expected, assessment, actualRouting } of rows) {
    matrix[expected.verdict][assessment.verdict] += 1;
    if (assessment.details) {
      sourceKinds[assessment.details.sourceKind] += 1;
      externalStatuses[assessment.details.externalStatus] += 1;
    }
    if (expected.verdict !== assessment.verdict) {
      verdictMismatches.push({ id, expected: expected.verdict, actual: assessment.verdict, reason: assessment.reason });
    }
    if (expected.route === null) continue;
    labeledRoutes += 1;
    if (expected.route === "dealer") labeledDealers += 1;
    if (expected.route === actualRouting.route && expected.dealerId === actualRouting.dealerId) {
      if (expected.route === "dealer") correctDealers += 1;
    } else {
      routingMismatches.push({ id, expected: { route: expected.route, dealerId: expected.dealerId }, actual: actualRouting });
    }
  }

  console.log(name + " · Mode: saved (public evidence / local rules, zero live calls). Rows: expected. Columns: actual.");
  console.table(matrix);
  console.log(JSON.stringify({
    dataset: name,
    mode: "saved",
    verdict: matchRate(rows.length - verdictMismatches.length, rows.length),
    dealerRecommendation: matchRate(correctDealers, labeledDealers),
    routing: matchRate(labeledRoutes - routingMismatches.length, labeledRoutes),
    validToInvalid: matrix.valid.invalid,
    validToAmbiguous: matrix.valid.ambiguous,
    ambiguousTotal: VERDICTS.reduce((count, verdict) => count + matrix[verdict].ambiguous, 0),
    sourceKinds,
    externalStatuses,
    verdictMismatches,
    routingMismatches,
  }, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const seed = createInitialForwardingState();
  const demo = dataset("Demo 30", 30, seed.leads, demoAnswers);
  if (args.length === 0) {
    report(demo.name, await evaluate(demo));
    return;
  }
  if (args.length !== 3 || args[0] !== "--held-out") {
    throw new Error("Usage: evaluate-forwarding.ts [--held-out <lead-inputs.json> <completed-labels.json>]");
  }

  // Read and validate the completed blind labels before loading inputs or running predictions.
  const labels = JSON.parse(await readFile(args[2], "utf8")) as unknown;
  if (!Array.isArray(labels) || labels.length !== 70 || !labels.every(validAnswer)) {
    throw new Error("Held-out evaluation requires 70 completed labels.");
  }
  const inputs = JSON.parse(await readFile(args[1], "utf8")) as unknown;
  const heldOut = dataset("Held-out 70", 70, inputs, labels);
  const seedIds = new Set([...seed.leads.map((lead) => lead.id), ...seed.deliveries.map((delivery) => delivery.leadId)]);
  if (heldOut.leads.some((lead) => seedIds.has(lead.id))) throw new Error("Held-out lead IDs must be separate from demo and historical delivery IDs.");
  const demoRows = await evaluate(demo);
  const heldOutRows = await evaluate(heldOut);
  report(demo.name, demoRows);
  report(heldOut.name, heldOutRows);
  report("Combined 100", [...demoRows, ...heldOutRows]);
}

main().catch((error: unknown) => {
  // Report missing or malformed files without printing their local paths or raw input.
  const message = error instanceof SyntaxError ? "Evaluation JSON is invalid."
    : object(error) && "code" in error ? "An evaluation input file could not be read."
      : error instanceof Error ? error.message : "Evaluation failed.";
  console.error(message);
  process.exitCode = 1;
});
