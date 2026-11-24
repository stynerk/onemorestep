import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const specPath = new URL("../docs/qa/LARGE_EVAL_SPEC.md", import.meta.url);
const outputPath = new URL("../docs/qa/large-eval/leads.csv", import.meta.url);
export const seed = 20261125;
export const languageCounts = { ko: 200, en: 350, ja: 100, de: 100, fr: 150, es: 100 };
export const typeCounts = { A: 300, B: 50, C: 150, D: 70, E: 30, F: 100, G: 100, H: 50, I: 30, J: 40, K: 30, L: 50 };

const languages = Object.keys(languageCounts);
const purchaseTypes = new Set(["A", "C", "F", "G"]);
const pairedTypes = new Set(["C", "D", "G"]);
const freeDomains = {
  ko: ["naver.com", "gmail.com"], en: ["gmail.com", "outlook.com"], ja: ["yahoo.co.jp", "gmail.com"],
  de: ["gmx.de", "outlook.com"], fr: ["orange.fr", "gmail.com"], es: ["hotmail.es", "gmail.com"],
};
const fictionalInstitutions = {
  ko: ["하늘숲요양병원", "한강여성의원"], en: ["Northbridge Medical Center", "Bluewater Regional Hospital", "Maple Valley Hospital"],
  ja: ["さくら野中央病院", "青空の丘総合病院"], de: ["Rheinland Diagnostik Zentrum", "Klinikum Nordheide"],
  fr: ["Clinique du Lac Bleu", "Centre Médical Saint-Aubin", "Hôpital des Trois Rivières", "Laboratoire Vernet Santé"],
  es: ["Clínica Sol Andino", "Hospital San Rafael del Valle", "Centro Médico Bahía Clara"],
};
const fictionalCountries = {
  ko: ["대한민국"], en: ["미국", "영국", "캐나다", "싱가포르", "호주"], ja: ["일본"],
  de: ["독일"], fr: ["프랑스", "스위스"], es: ["스페인", "콜롬비아"],
};
const rowForType = {
  A: "구매", B: "의도 약함", C: "구매", D: "사칭", F: "구매", G: "구매",
  H: "제휴·협조", I: "채용", J: "학생", K: "영업 제안", L: "스팸·무의미",
};
const dental = {
  ko: "치과에 구강 스캐너 {n}대 도입을 검토 중입니다. 견적 부탁드립니다",
  en: "Our dental department is considering {n} intraoral scanners. Please send a quote",
  ja: "歯科で口腔内スキャナー{n}台の導入を検討中です。見積もりをお願いします",
  de: "Unsere Zahnklinik benötigt ein Angebot für {n} Intraoralscanner",
  fr: "Notre service dentaire souhaite un devis pour {n} scanners intra-oraux",
  es: "Nuestro servicio dental solicita una cotización para {n} escáneres intraorales",
};
const invoice = {
  ko: "{n}대 송장을 오늘 이 메일로 보내 주세요. 당일 결제하겠습니다",
  en: "Send the invoice for {n} units to this address for same-day payment",
  ja: "{n}台の請求書を今日このメールに送ってください。本日中に支払います",
  de: "Bitte senden Sie die Rechnung für {n} Geräte an diese Adresse. Wir zahlen noch heute",
  fr: "Envoyez la facture pour {n} appareils à cette adresse. Nous réglerons aujourd’hui",
  es: "Envíe la factura por {n} equipos a esta dirección. Pagaremos hoy",
};
const publicSurvey = {
  ko: "기관 공식 통계 조사를 위한 설문 협조를 요청드립니다",
  en: "Please complete our official statistical survey on equipment procurement",
  ja: "機器調達に関する公式統計調査へのご協力をお願いします",
  de: "Bitte nehmen Sie an unserer amtlichen statistischen Erhebung zur Gerätebeschaffung teil",
  fr: "Merci de participer à notre enquête statistique officielle sur l'achat de matériel",
  es: "Solicitamos su colaboración en nuestra encuesta estadística oficial de adquisición de equipos",
};

function markdownRows(spec, section) {
  const content = spec.split(/^## \d+\. /m)[section];
  assert.ok(content, `Missing specification section ${section}.`);
  return content.split(/\r?\n/).filter((line) => line.startsWith("|"))
    .slice(2).map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

function generator(initialSeed) {
  // Mulberry32 with explicit 32-bit arithmetic is independent of Node's Math.random.
  let state = initialSeed;
  function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  }
  function choose(list) {
    assert.ok(list.length, "Cannot choose from an empty list.");
    return list[Math.floor(random() * list.length)];
  }
  function shuffle(list) {
    const result = [...list];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }
  return { random, choose, shuffle };
}

export function getInstitutions(spec) {
  const institutions = markdownRows(spec, 2).map(([name, country, domain, category]) => ({ name, country, domain, category }));
  assert.equal(institutions.length, 78);
  assert.equal(new Set(institutions.map(({ name }) => name)).size, 78);
  assert.ok(institutions.every(({ name, country, domain, category }) => name && country && category && /^[a-z0-9.-]+\.[a-z]+$/.test(domain)));
  return institutions;
}

function nativeLanguage({ country, category }) {
  if (category.includes("프랑스어권")) return "fr";
  return Object.entries(fictionalCountries).find(([, places]) => places.includes(country))?.[0] ?? "en";
}

function distributeLanguages() {
  const remaining = { ...languageCounts };
  return Object.entries(typeCounts).flatMap(([type, count]) => {
    const portion = Object.fromEntries(languages.map((language) => [
      language, Math.min(remaining[language], Math.floor(count * languageCounts[language] / 1000)),
    ]));
    let unassigned = count - Object.values(portion).reduce((sum, amount) => sum + amount, 0);
    while (unassigned > 0) {
      const eligible = languages.filter((language) => portion[language] < remaining[language]);
      const [language] = eligible.sort((left, right) =>
        (count * languageCounts[right] / 1000 - portion[right])
        - (count * languageCounts[left] / 1000 - portion[left]));
      portion[language]++;
      unassigned--;
    }
    return languages.flatMap((language) => {
      remaining[language] -= portion[language];
      return Array.from({ length: portion[language] }, (_, index) => ({ type, language, index }));
    });
  });
}

export function generateLeads(spec) {
  const { random, choose, shuffle } = generator(seed);
  const institutions = getInstitutions(spec);
  const typeRows = markdownRows(spec, 3).map(([label, count]) => [label[0], Number(count)]);
  assert.deepEqual(Object.fromEntries(typeRows), typeCounts);
  const phrases = Object.fromEntries(markdownRows(spec, 5).map(([label, ...translations]) => {
    assert.equal(translations.length, languages.length, `Missing language in memo row ${label}.`);
    return [label, Object.fromEntries(languages.map((language, index) => [language, translations[index].split(" / ")]))];
  }));
  const countries = [...new Set(institutions.map(({ country }) => country))];
  const institutionsNear = Object.fromEntries(languages.map((language) => {
    // English is also a natural default for countries with no dedicated language quota.
    const preferred = language === "en" ? institutions : institutions.filter((entry) => nativeLanguage(entry) === language);
    return [language, shuffle(preferred)];
  }));
  const mandatoryA = Object.fromEntries(languages.map((language) => [
    language, shuffle(institutions.filter((entry) => nativeLanguage(entry) === language)),
  ]));
  const pairedInstitutions = Object.fromEntries(languages.map((language) => [language, choose(institutionsNear[language])]));
  const eligible = {
    H: institutions.filter(({ category }) => /기업|연구|공공기관|정부기관/.test(category)),
    J: institutions.filter(({ category }) => /대학|병원/.test(category)),
    K: institutions.filter(({ category }) => category.startsWith("기업")),
  };
  const slots = distributeLanguages();
  for (const language of languages) {
    assert.ok(slots.filter((slot) => slot.type === "A" && slot.language === language).length >= mandatoryA[language].length);
  }
  return shuffle(slots).map(({ type, language, index }, position) => {
    const number = String(position + 1).padStart(4, "0");
    const pool = eligible[type] ?? institutions;
    const localized = institutionsNear[language].filter((entry) => pool.includes(entry));
    const institution = (type === "A" ? mandatoryA[language][index] : undefined)
      ?? (pairedTypes.has(type) && index === 0 ? pairedInstitutions[language] : undefined)
      ?? choose(localized.length && random() < 0.85 ? localized : pool);
    let { name: organization, domain, country } = institution;
    if (type === "C") domain = choose(freeDomains[language]);
    if (type === "D") {
      const stem = domain.split(".").find((label) => !["www", "mail", "de", "h", "med", "hk", "ac", "jimu"].includes(label));
      domain = `${stem}-${choose(["procurement", "hospital", "mail"])}.test`;
    }
    if (type === "E") domain = choose(institutions.filter((entry) => entry.domain !== domain)).domain;
    if (type === "F") {
      const names = fictionalInstitutions[language];
      const nameIndex = Math.floor(random() * names.length);
      organization = names[nameIndex];
      country = choose(fictionalCountries[language]);
      domain = choose([`clinic-${language}-${nameIndex + 1}.test`, `clinic-${language}-${nameIndex + 1}.example.com`]);
    }
    if (type === "G") country = choose(countries.filter((value) => value !== institution.country));
    if (type === "L") {
      organization = choose(["", "N/A", "Individual", "asdf"]);
      domain = "example.com";
    }

    const quotation = purchaseTypes.has(type) && random() < 0.2;
    const product = quotation ? "IS-3" : choose(["PM-50", "US-200"]);
    const units = 2 + Math.floor(random() * 29);
    let template;
    if (quotation) {
      template = dental[language];
    } else if (type === "E") {
      template = invoice[language];
    } else if (type === "H" && /정부기관|공공기관/.test(institution.category)) {
      template = publicSurvey[language];
    } else {
      const variants = phrases[rowForType[type]][language];
      const suitable = type === "H" ? variants.filter((phrase) => !phrase.includes("official statistics survey")) : variants;
      template = choose(suitable);
    }
    return {
      id: `G${number}`, organization, email: `mrn-lg-${number}@${domain}`, country, product,
      memo: template.replaceAll("{n}", String(units)), language, type,
    };
  });
}

function csvCell(value) {
  return /[",\r\n]/u.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
}

export function toCsv(leads) {
  const columns = ["id", "organization", "email", "country", "product", "memo", "language", "type"];
  return columns.join(",") + "\n"
    + leads.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [option, ...extra] = process.argv.slice(2);
  assert.ok(!extra.length && (!option || option === "--check"), "Usage: node scripts/generate-large-eval.mjs [--check]");
  const leads = generateLeads(readFileSync(specPath, "utf8"));
  const csv = toCsv(leads);
  if (option === "--check") {
    assert.equal(readFileSync(outputPath, "utf8").replaceAll("\r\n", "\n"), csv, "Regenerate leads.csv.");
  } else {
    mkdirSync(dirname(fileURLToPath(outputPath)), { recursive: true });
    writeFileSync(outputPath, csv, "utf8");
  }
  console.log(JSON.stringify({ seed, count: leads.length, sha256: createHash("sha256").update(csv).digest("hex") }));
}
