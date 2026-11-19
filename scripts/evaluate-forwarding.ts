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
type EvaluationConfig = { mode: "sample" } | { mode: "live"; apiKey: string };
type Upstream = { attempts: number; withoutResponse: number; httpStatuses: Record<number, number> };
type Evaluation = { rows: Comparison[]; upstream: Upstream };

function combine(demo: Evaluation, heldOut: Evaluation): Evaluation {
  const httpStatuses = { ...demo.upstream.httpStatuses };
  for (const [status, count] of Object.entries(heldOut.upstream.httpStatuses)) {
    const code = Number(status);
    httpStatuses[code] = (httpStatuses[code] ?? 0) + count;
  }
  return {
    rows: [...demo.rows, ...heldOut.rows],
    upstream: {
      attempts: demo.upstream.attempts + heldOut.upstream.attempts,
      withoutResponse: demo.upstream.withoutResponse + heldOut.upstream.withoutResponse,
      httpStatuses,
    },
  };
}

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

async function evaluate({ leads, answers }: Dataset, config: EvaluationConfig): Promise<Evaluation> {
  const upstream: Upstream = { attempts: 0, withoutResponse: 0, httpStatuses: {} };
  const service = createAssessmentService({
    now: config.mode === "sample" ? () => Date.parse(forwardingPolicy.referenceDate) : undefined,
    fetcher: async (input, init) => {
      upstream.attempts += 1;
      if (config.mode !== "live") throw new Error("Evaluation must run offline");
      try {
        const response = await fetch(input, init);
        const status = response.status;
        upstream.httpStatuses[status] = (upstream.httpStatuses[status] ?? 0) + 1;
        return response;
      } catch (error) {
        upstream.withoutResponse += 1;
        throw error;
      }
    },
  });
  const state = createInitialForwardingState();
  state.leads = leads;
  state.leadStates = Object.fromEntries(leads.map((lead) => [lead.id, {
    leadId: lead.id, assessment: null, workflow: "new", dealerId: null,
  }]));
  const expected = new Map(answers.map((answer) => [answer.leadId, answer]));
  const results: Comparison[] = [];
  for (const lead of leads) {
    const { assessment, workflow } = await service.assess(lead, config);
    state.leadStates[lead.id] = { leadId: lead.id, assessment, workflow, dealerId: null };
    const recommendation = recommendDealer(state, lead.id);
    const actualRouting: Routing = {
      route: member(routes, recommendation?.route) ? recommendation.route : null,
      dealerId: recommendation?.route === "dealer" ? recommendation.ranked[0].dealer.id : null,
    };
    results.push({ id: lead.id, expected: expected.get(lead.id)!, assessment, actualRouting });
  }
  if (config.mode === "sample" && upstream.attempts !== 0) throw new Error("Evaluation attempted a live call.");
  return { rows: results, upstream };
}

const matchRate = (correct: number, total: number) => ({ correct, total, percent: total === 0 ? null : 100 * correct / total });

function report(name: string, configuredMode: EvaluationConfig["mode"], { rows, upstream }: Evaluation) {
  const mode = configuredMode === "sample" ? "saved" : "live";
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

  console.log(name + " · Mode: " + mode + ". Rows: expected. Columns: actual.");
  console.table(matrix);
  console.log(JSON.stringify({
    dataset: name,
    mode,
    upstream,
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
  const live = args[0] === "--live";
  if (live) args.shift();
  if (args.length !== 0 && (args.length !== 3 || args[0] !== "--held-out")) {
    throw new Error("Usage: evaluate-forwarding.ts [--live] [--held-out <lead-inputs.json> <completed-labels.json>]");
  }
  const apiKey = live ? process.env.LINER_API_KEY?.trim() : undefined;
  if (live && !apiKey) throw new Error("--live requires LINER_API_KEY in the process environment.");
  const config: EvaluationConfig = apiKey ? { mode: "live", apiKey } : { mode: "sample" };
  const seed = createInitialForwardingState();
  const demo = dataset("Demo 30", 30, seed.leads, demoAnswers);
  if (args.length === 0) {
    report(demo.name, config.mode, await evaluate(demo, config));
    return;
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
  const demoEvaluation = await evaluate(demo, config);
  const heldOutEvaluation = await evaluate(heldOut, config);
  report(demo.name, config.mode, demoEvaluation);
  report(heldOut.name, config.mode, heldOutEvaluation);
  report("Combined 100", config.mode, combine(demoEvaluation, heldOutEvaluation));
}

main().catch((error: unknown) => {
  // Report missing or malformed files without printing their local paths or raw input.
  const message = error instanceof SyntaxError ? "Evaluation JSON is invalid."
    : object(error) && "code" in error ? "An evaluation input file could not be read."
      : error instanceof Error ? error.message : "Evaluation failed.";
  console.error(message);
  process.exitCode = 1;
});
