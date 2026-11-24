import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { generateLeads, getInstitutions, toCsv } from "../scripts/generate-large-eval.mjs";

const spec = readFileSync(new URL("../docs/qa/LARGE_EVAL_SPEC.md", import.meta.url), "utf8");
const leads = generateLeads(spec);
const institutions = new Map(getInstitutions(spec).map((entry) => [entry.name, entry]));

function tally(field) {
  const counts = {};
  for (const row of leads) counts[row[field]] = (counts[row[field]] ?? 0) + 1;
  return counts;
}

test("the fixed seed recreates the checked-in CSV and exact quotas", () => {
  const generated = toCsv(leads);
  const committed = readFileSync(new URL("../docs/qa/large-eval/leads.csv", import.meta.url), "utf8");
  assert.equal(generated, toCsv(generateLeads(spec)));
  assert.equal(generated, committed.replaceAll("\r\n", "\n"));
  assert.equal(leads.length, 1000);
  assert.deepEqual(tally("type"), { A: 300, B: 50, C: 150, D: 70, E: 30, F: 100, G: 100, H: 50, I: 30, J: 40, K: 30, L: 50 });
  assert.deepEqual(tally("language"), { ko: 200, en: 350, ja: 100, de: 100, fr: 150, es: 100 });
  assert.equal(new Set(leads.map(({ id }) => id)).size, 1000);
  assert.ok(leads.every(({ id, email }, index) => {
    const sequence = String(index + 1).padStart(4, "0");
    return id === `G${sequence}` && email.startsWith(`mrn-lg-${sequence}@`);
  }));
});

test("the institution pool, domains and paired cases follow the specification", () => {
  const officialDomains = new Set([...institutions.values()].map(({ domain }) => domain));
  const free = new Set(["gmail.com", "naver.com", "yahoo.co.jp", "outlook.com", "gmx.de", "orange.fr", "hotmail.es"]);
  const represented = new Set();
  const typesByInstitution = new Map();
  for (const { organization, email, country, type, id } of leads) {
    const domain = email.split("@")[1];
    const actual = institutions.get(organization);
    if (type === "F" || type === "L") {
      assert.equal(actual, undefined, id);
      assert.match(domain, /(?:\.test|(?:^|\.)example\.com)$/);
      continue;
    }
    assert.ok(actual, id);
    represented.add(organization);
    const types = typesByInstitution.get(organization) ?? new Set();
    types.add(type);
    typesByInstitution.set(organization, types);

    if (type === "C") assert.ok(free.has(domain), id);
    else if (type === "D") assert.match(domain, /-(?:procurement|hospital|mail)\.test$/);
    else if (type === "E") assert.ok(officialDomains.has(domain) && domain !== actual.domain, id);
    else assert.equal(domain, actual.domain, id);

    if (type === "G") assert.notEqual(country, actual.country, id);
    else assert.equal(country, actual.country, id);
    if (type === "H") assert.match(actual.category, /기업|연구|공공기관|정부기관/);
    if (type === "J") assert.match(actual.category, /대학|병원/);
    if (type === "K") assert.match(actual.category, /^기업/);
  }
  assert.deepEqual(represented, new Set(institutions.keys()));
  assert.ok([...typesByInstitution.values()].some((types) => ["A", "C", "D", "G"].every((type) => types.has(type))));
});

test("French memo localization and the IS-3 dental constraint are represented", () => {
  const french = leads.filter(({ language }) => language === "fr");
  const locales = french.filter(({ country, organization }) => country === "프랑스" || country === "스위스"
    || institutions.get(organization)?.category.includes("프랑스어권"));
  assert.ok(locales.length > french.length / 2, "Most French memos should be associated with French-speaking locales.");
  const dental = leads.filter(({ product }) => product === "IS-3");
  assert.ok(dental.length > 0);
  assert.ok(dental.every(({ memo }) => /치과|dental|歯科|Zahnklinik|dentaire/u.test(memo)));
  assert.ok(leads.every(({ memo }) => memo.length > 0 && !memo.includes("{n}")));
});
