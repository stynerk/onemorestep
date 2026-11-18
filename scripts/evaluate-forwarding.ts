import { createAssessmentService } from "../src/lib/forwarding/assessment-service";
import answers from "../src/lib/forwarding/evaluation/ground-truth.json";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { VERDICTS } from "../src/lib/forwarding/types";
import type { Verdict } from "../src/lib/forwarding/types";

async function main() {
  const leads = createInitialForwardingState().leads;
  const service = createAssessmentService({ fetcher: async () => { throw new Error("Evaluation must run offline"); } });
  const expected = new Map(answers.map((answer) => [answer.leadId, answer.verdict as Verdict]));
  const matrix = Object.fromEntries(VERDICTS.map((verdict) => [verdict, Object.fromEntries(VERDICTS.map((key) => [key, 0]))]));
  const mismatches = [];
  let correct = 0;
  for (const lead of leads) {
    const target = expected.get(lead.id);
    if (!target) throw new Error("Missing answer for " + lead.id);
    const { assessment } = await service.assess(lead, { mode: "sample" });
    matrix[target][assessment.verdict] += 1;
    if (target === assessment.verdict) correct += 1;
    else mismatches.push({ id: lead.id, expected: target, actual: assessment.verdict, reason: assessment.reason });
  }
  console.log("Mode: saved public pages and local rules (zero live calls). Rows: expected. Columns: actual.");
  console.table(matrix);
  console.log(JSON.stringify({ total: leads.length, correct, validToInvalid: matrix.valid.invalid, mismatches }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluation failed.");
  process.exitCode = 1;
});
