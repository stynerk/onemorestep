import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const seedPath = "docs/qa/EVAL2_ANSWERS_HJ.csv";
const outputDir = ".cache/eval2";
const source = readFileSync(seedPath);
const rows = (source.toString("utf8").replace(/^\uFEFF/u, "").trimEnd().match(/(?:[^"\r\n]|"(?:[^"]|"")*")+/gu) ?? [])
  .map((line) => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^",\r\n]*))/gu)]
    .map((match) => (match[1]?.replaceAll('""', '"') ?? match[2]).trim()));
const [header, ...entries] = rows;
assert.ok(header);
assert.equal(header.length, 10);
assert.deepEqual(header.slice(0, 6), ["ID", "소속", "이메일", "리드 국가", "상품", "메모"]);
assert.deepEqual(entries.map(([id]) => id), Array.from({ length: 30 }, (_, index) => "N" + String(index + 1).padStart(2, "0")));
const inputs = entries.map((row) => {
  assert.equal(row.length, header.length, row[0]);
  const [id, rawInstitution, email, country, product, memo] = row;
  assert.ok(email && country && product, id);
  const institution = rawInstitution === "(빈칸)" ? "" : rawInstitution;
  return { id, institution, email, country, product, memo, name: "", phone: "", receivedAt: "2026-11-18T00:00:00.000Z" };
});
const digest = (value) => createHash("sha256").update(value).digest("hex");
const mode = process.argv[2];
if (mode === "prepare") {
  const serialized = JSON.stringify(inputs, null, 2) + "\n";
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputDir + "/inputs.json", serialized);
  console.log(JSON.stringify({ leads: inputs.length, sourceSha256: digest(source), inputSha256: digest(JSON.stringify(inputs)) }));
} else if (mode === "score") {
  const manifest = JSON.parse(readFileSync(outputDir + "/manifest.json", "utf8"));
  const replay = JSON.parse(readFileSync(outputDir + "/replay.json", "utf8"));
  assert.equal(digest(JSON.stringify(replay.predictions)), manifest.predictionsSha256);
  assert.equal(replay.inputSha256, digest(JSON.stringify(inputs)));
  assert.deepEqual(replay.predictions.map(({ id }) => id), inputs.map(({ id }) => id));
  const verdicts = { valid: "유효", ambiguous: "애매", "country-check": "국가 확인", "partnership-check": "제휴 확인", invalid: "무효" };
  const order = Object.values(verdicts);
  const matrix = Object.fromEntries(order.map((label) => [label, Object.fromEntries(order.map((actual) => [actual, 0]))]));
  const results = entries.map(([id, , , country, , , expected, rawHandoff], index) => {
    const prediction = replay.predictions[index];
    const actual = verdicts[prediction.verdict];
    assert.ok(order.includes(expected) && actual, id);
    assert.ok(!rawHandoff || rawHandoff === "인사팀" || rawHandoff === country + " 딜러"
      || /^(NA|APAC|EU|LATAM|MEA) 세일즈팀$/u.test(rawHandoff), id);
    const handoff = prediction.handoff;
    let actualHandoff = "없음";
    if (handoff.kind === "dealer") {
      assert.equal(prediction.details.countries.length, 1, id);
      actualHandoff = prediction.details.countries[0] + " 딜러";
    } else if (handoff.kind === "regional-sales") actualHandoff = (handoff.region ?? "미지정") + " 세일즈팀";
    else if (handoff.kind === "hr") actualHandoff = "인사팀";
    else assert.equal(handoff.kind, "none", id);
    matrix[expected][actual] += 1;
    return { id, expected, actual, expectedHandoff: rawHandoff || "없음", actualHandoff, reason: prediction.reason };
  });
  assert.deepEqual(Object.values(matrix).map((row) => Object.values(row).reduce((total, count) => total + count, 0)), [11, 5, 2, 3, 9]);
  const corrections = entries.filter((row) => row[9]).map((row) => row[0]);
  assert.deepEqual(corrections, ["N24", "N25", "N26", "N30"]);
  const summary = {
    total: results.length,
    verdictCorrect: results.filter((row) => row.expected === row.actual).length,
    handoffCorrect: results.filter((row) => row.expectedHandoff === row.actualHandoff).length,
    validToInvalid: matrix["유효"]["무효"],
    falseValid: order.slice(1).reduce((total, expected) => total + matrix[expected]["유효"], 0),
    matrix, corrections, results,
  };
  writeFileSync(outputDir + "/score.json", JSON.stringify(summary, null, 2) + "\n");
  const { total, verdictCorrect, handoffCorrect, validToInvalid, falseValid } = summary;
  console.log(JSON.stringify({ total, verdictCorrect, handoffCorrect, validToInvalid, falseValid }));
} else {
  throw new Error("Usage: node scripts/blind-forwarding-data.mjs prepare|score");
}
