import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import archived from "../docs/qa/EVAL_70_ROUTER_REPLAY_2026-11-23.json";

test("the archived E01–E70 attribution reproduces the published dual-basis campaign report", () => {
  assert.equal(archived.length, 70);
  assert.equal(new Set(archived.map(({ id }) => id)).size, 70);
  for (const row of archived) assert.deepEqual(Object.keys(row).sort(), ["campaign", "id", "verdict"]);

  const args = ["--import", "tsx", "scripts/evaluate-campaigns.ts"];
  const output = execFileSync(process.execPath, [...args, "--json"], { encoding: "utf8" });
  const result = JSON.parse(output) as {
    verdictMatches: number;
    total: number;
    campaigns: {
      code: string; total: number; engineValid: number; hjValid: number; validToAmbiguous: number;
      validToOther: number; falseValid: number; engineEffect: string | null; hjEffect: string | null;
    }[];
  };

  assert.equal(result.verdictMatches, 52);
  assert.equal(result.total, 70);
  assert.deepEqual(result.campaigns.map(({ code, total, engineValid, hjValid, validToAmbiguous }) =>
    [code, total, engineValid, hjValid, validToAmbiguous]), [
    ["C1", 14, 1, 4, 3], ["C2", 14, 2, 3, 1], ["C3", 14, 1, 1, 0], ["C4", 14, 2, 5, 3], ["direct", 14, 0, 2, 2],
  ]);
  assert.ok(result.campaigns.every(({ validToOther, falseValid }) => validToOther === 0 && falseValid === 0));
  assert.deepEqual(result.campaigns.map(({ engineEffect, hjEffect }) => [engineEffect, hjEffect]), [
    ["효과 낮음", "보통"], ["효과 낮음", "보통"], ["효과 낮음", "효과 낮음"], ["효과 낮음", "보통"], [null, null],
  ]);

  const report = readFileSync("docs/qa/FINAL_EVALUATION_2026-11-20.md", "utf8");
  const table = execFileSync(process.execPath, args, { encoding: "utf8" })
    .split(/\r?\n/u).filter((line) => line.startsWith("|"));
  assert.ok(report.replace(/\r\n/gu, "\n").includes(table.join("\n")));
});
