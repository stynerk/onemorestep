import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:3167");
assert.equal(base.protocol, "http:");
assert.equal(base.hostname, "127.0.0.1", "Run against a loopback public-demo build.");
const out = resolve("test-results/issue-117");
const sizes = [{ width: 1440, height: 900 }, { width: 1280, height: 800 }];
const implemented = { L: 30, I: 10, M: 9 };
const idOf = (prefix, number) => prefix + String(number).padStart(2, "0");
const checks = [];
const cases = [];

function record(condition, label, problems) {
  if (!condition) problems.push(label);
}

function groupResults() {
  return Object.entries(implemented).map(([prefix, count]) => {
    const matches = cases.filter((entry) => entry.id.startsWith(prefix));
    return { prefix, expected: count * sizes.length, tested: matches.length, passed: matches.filter((entry) => !entry.problems.length).length };
  });
}

async function load(page, path = "/") {
  await page.goto(new URL(path, base).href);
  await page.evaluate(() => document.fonts.ready);
}

async function layout(row, detail) {
  return row.evaluate((selected, detailSelector) => {
    const detail = document.querySelector(detailSelector);
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, height: rect.height };
    };
    const panel = selected.closest(".inbox-column, .marketing-queue");
    const header = panel.querySelector(":scope > .triage-columns");
    const selection = box(selected);
    const panelBounds = box(panel);
    const top = Math.max(0, panelBounds.y, header ? box(header).bottom : 0);
    const bottom = Math.min(innerHeight, panelBounds.bottom);
    const detailBox = box(detail);
    return {
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      row: selection,
      detail: detailBox,
      rowVisible: selection.y >= top - 2 && selection.bottom <= bottom + 2,
      panelWidth: panel.clientWidth,
      panelScrollWidth: panel.scrollWidth,
      detailWidth: detail.clientWidth,
      detailScrollWidth: detail.scrollWidth,
      controlOverflow: [...detail.querySelectorAll("button, input:not([type=checkbox]), select, textarea, .source-list a")]
        .filter((node) => node.getClientRects().length && node.closest("details:not([open])") === null)
        .filter((node) => box(node).x < detailBox.x - 1 || box(node).right > detailBox.right + 1)
        .map((node) => node.tagName + " " + (node.textContent?.trim().slice(0, 35) || node.getAttribute("aria-label") || "")),
    };
  }, detail);
}

function generalChecks(result, problems) {
  record(result.pageWidth <= result.viewportWidth + 1, "페이지 가로 넘침", problems);
  record(result.rowVisible, "선택 행이 목록 또는 뷰포트에 잘림", problems);
  record(result.row.right <= result.detail.x + 1, "목록과 상세가 겹침", problems);
  record(result.detail.y >= -1 && result.detail.y < result.row.bottom, "상세 머리가 캡처에 보이지 않음", problems);
  record(result.panelScrollWidth <= result.panelWidth + 1, "목록 가로 넘침", problems);
  record(result.detailScrollWidth <= result.detailWidth + 1, "상세 가로 넘침", problems);
  record(!result.controlOverflow.length, "입력/출처가 상세 영역 밖: " + result.controlOverflow.join(", "), problems);
}

async function showRow(row, detail) {
  await row.evaluate((node, detailSelector) => {
    const pane = node.closest(".inbox-column");
    if (pane && pane.scrollHeight > pane.clientHeight + 1) {
      const paneBounds = pane.getBoundingClientRect();
      const offset = node.getBoundingClientRect().top - paneBounds.top;
      const visibleTop = Math.max(0, paneBounds.top);
      const visibleBottom = Math.min(innerHeight, paneBounds.bottom);
      const center = visibleTop - paneBounds.top + (visibleBottom - visibleTop - node.offsetHeight) / 2;
      pane.scrollTop += offset - center;
    }
    const rowBounds = node.getBoundingClientRect();
    const detailBounds = document.querySelector(detailSelector).getBoundingClientRect();
    const rowBottom = rowBounds.bottom + window.scrollY;
    const detailTop = detailBounds.top + window.scrollY;
    window.scrollTo(0, Math.min(detailTop, Math.max(0, rowBottom - (innerHeight - 8))));
  }, detail);
}

async function openMemo(detail) {
  const summary = detail.locator("summary").filter({ hasText: /^문의 의도/u });
  await summary.click();
  return summary.locator("xpath=..").locator("blockquote");
}

async function auditCase({ page, id, size, click, inspect, row, selector }) {
  const problems = [];
  const viewport = size.width + "x" + size.height;
  const capture = viewport + "/" + id + ".png";
  let metrics;
  let captured = false;
  try {
    await click();
    await showRow(row, selector);
    metrics = await layout(row, selector);
    generalChecks(metrics, problems);
    await page.screenshot({ path: resolve(out, capture), animations: "disabled" });
    captured = true;
    await inspect?.(problems);
  } catch (error) {
    problems.push(String(error).split("\n")[0]);
    if (!captured) {
      try {
        await page.screenshot({ path: resolve(out, capture), animations: "disabled" });
        captured = true;
      } catch {
        // The browser may already be closed after a navigation or process error.
      }
    }
  }
  cases.push({ id, viewport, capture: captured ? capture : null, problems, metrics });
}

async function special(page, size, name, run, { capture = true } = {}) {
  const problems = [];
  const viewport = size.width + "x" + size.height;
  const file = viewport + "/" + name + ".png";
  let saved = false;
  let metrics;
  try {
    metrics = await run(problems);
  } catch (error) {
    problems.push(String(error).split("\n")[0]);
  }
  if (capture) {
    try {
      await page.screenshot({ path: resolve(out, file), animations: "disabled" });
      saved = true;
    } catch (error) {
      problems.push(String(error).split("\n")[0]);
    }
  }
  checks.push({ viewport, name, problems, capture: saved ? file : null, metrics });
}

async function runBatch(page, count) {
  await page.getByRole("button", { name: "판정 시작", exact: true }).click();
  await page.waitForFunction((count) => document.querySelector("progress")?.value === count
    && document.querySelector(".run-button")?.textContent === "다시 판정", count, { timeout: 45000 });
}

const rowById = (page, id) => page.locator(".lead-button").filter({
  has: page.locator(".lead-meta > span:first-child").filter({ hasText: new RegExp("^" + id + "$", "u") }),
});
const openEvidence = (detail) => detail.locator(".source-list a:visible");

async function inspectLead(detail, id, problems) {
  const domains = await openEvidence(detail).allTextContents();
  record(new Set(domains).size === domains.length, "같은 기관 출처 도메인이 중복됨", problems);
  const expectedTitles = {
    L09: "Guy's and St Thomas' NHS Foundation Trust",
    L12: "Charité – Universitätsmedizin Berlin",
  };
  if (id in expectedTitles) {
    const title = detail.locator("#card-heading");
    record(await title.getAttribute("title") === expectedTitles[id], "긴 기관명 원문 title이 보존되지 않음", problems);
  }
  const oldCount = detail.getByText(/^과거 거래 관계 \d+건$/u);
  if (await oldCount.count()) {
    const grouping = await oldCount.evaluate((element) => {
      const withinEvidence = element.closest(".evidence");
      const section = element.closest("section");
      const related = section?.querySelector("h2, h3, summary");
      return Boolean(withinEvidence && element.closest("[class*=evidenceRow]"))
        || Boolean(related && /추천|관계|이력|기록/.test(related.textContent));
    });
    record(grouping, "과거 거래 관계 문구가 관련 기록과 묶이지 않음", problems);
  }
  if (id === "L01") {
    const access = detail.getByRole("button", { name: "딜러 변경", exact: true });
    if (await access.isVisible()) {
      await access.click();
      const field = detail.locator("#change-reason");
      const styles = await field.evaluate((input) => ({
        border: getComputedStyle(input).borderTopColor,
        inner: getComputedStyle(input).backgroundColor,
      }));
      record(styles.border === "rgb(109, 123, 131)" && styles.inner === "rgb(255, 255, 255)", "전표 입력칸 대비 색 회귀", problems);
      await access.click();
    }
  }
}

async function inspectDetailScroll(detail, problems) {
  const scroll = await detail.evaluate((node) => {
    const list = document.querySelector(".inbox-column");
    const pane = node.closest(".detail-column");
    const mode = getComputedStyle(pane).overflowY;
    const documentEl = document.scrollingElement;
    const paneScroll = /(auto|scroll)/.test(mode) && pane.scrollHeight - pane.clientHeight > 2;
    const target = paneScroll ? pane : documentEl;
    const before = target.scrollTop;
    target.scrollTop = target.scrollHeight;
    return {
      paneScroll,
      moved: target.scrollTop > before,
      listTop: list.getBoundingClientRect().top,
      listBottom: list.getBoundingClientRect().bottom,
      height: innerHeight,
      detailBottom: node.getBoundingClientRect().bottom,
      detailPaneBottom: pane.getBoundingClientRect().bottom,
    };
  });
  if (scroll.moved) {
    record(scroll.listBottom >= scroll.height - 70, "상세 하단으로 스크롤하면 목록 패널이 화면 중간에서 끝남", problems);
    if (scroll.paneScroll) {
      record(scroll.detailBottom <= scroll.detailPaneBottom + 4, "독립 상세 스크롤에서 전표 하단에 닿지 않음", problems);
    }
  }
  return scroll;
}

async function inspectListEnd(page, position, problems) {
  const scroll = await page.locator(".inbox-column").evaluate((list, position) => {
    const scroller = document.scrollingElement;
    const before = scroller.scrollTop;
    list.scrollTop = position === "end" ? list.scrollHeight : 0;
    const rows = list.querySelectorAll(".lead");
    const row = (position === "end" ? rows[rows.length - 1] : rows[0]).getBoundingClientRect();
    const panel = list.getBoundingClientRect();
    const header = list.querySelector(".triage-columns").getBoundingClientRect();
    return {
      visible: row.top >= Math.max(0, panel.top, header.bottom) - 2
        && row.bottom <= Math.min(panel.bottom, innerHeight) + 2,
      end: list.scrollHeight - list.clientHeight - list.scrollTop,
      top: list.scrollTop,
      rowTop: row.top,
      rowBottom: row.bottom,
      panelBottom: panel.bottom,
      documentUnchanged: scroller.scrollTop === before,
    };
  }, position);
  record(scroll.visible, position === "end" ? "목록 최종 행이 잘림" : "목록 첫 행으로 복귀하지 못함", problems);
  record((position === "end" ? scroll.end : scroll.top) <= 2, "목록 내부 스크롤 끝에 도달하지 못함", problems);
  record(scroll.documentUnchanged, "목록 스크롤과 상세 문서 스크롤이 함께 움직임", problems);
  return scroll;
}

async function inspectClock(page, problems) {
  const line = page.locator(".triage-clock p");
  await line.waitFor();
  const metric = await line.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const bounds = [...range.getClientRects()];
    return {
      lines: new Set(bounds.map((box) => Math.round(box.top))).size,
      fits: bounds.every((box) => box.x >= 0 && box.right <= innerWidth + 1),
      pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    };
  });
  record(metric.lines <= 2 && metric.fits && metric.pageFits, "시연 시각 문구가 세 줄 이상이거나 화면 밖으로 넘침", problems);
}

async function auditForwards(page, size, prefix) {
  if (prefix === "I") {
    await page.getByRole("button", { name: "B2B SaaS", exact: true }).click();
  }
  await runBatch(page, implemented[prefix]);
  const detail = page.locator(".decision-card");
  for (let number = 1; number <= implemented[prefix]; number++) {
    const id = idOf(prefix, number);
    const row = rowById(page, id);
    await auditCase({
      page, id, size, row, selector: ".decision-card",
      click: async () => {
        await row.scrollIntoViewIfNeeded();
        await row.click();
        await detail.locator(".card-meta").getByText(id, { exact: true }).waitFor();
        await detail.evaluate((node) => {
          const pane = node.closest(".detail-column");
          if (pane.scrollTop) pane.scrollTop = 0;
          window.scrollTo(0, 0);
        });
      },
      inspect: (problems) => inspectLead(detail, id, problems),
    });
  }
  await special(page, size, prefix + "-equal-row-heights", async (problems) => {
    const heights = await page.locator(".lead-button").evaluateAll((rows) =>
      rows.map((button) => ({ id: button.querySelector(".lead-meta span").textContent, group: button.closest("li").dataset.group,
        height: button.getBoundingClientRect().height })));
    const regular = heights.filter((entry) => entry.group === "valid");
    const riskIds = prefix === "L" ? ["L29", "L30"] : ["I09"];
    for (const id of riskIds) {
      const entry = heights.find((row) => row.id === id);
      record(Boolean(entry && regular.some((row) => Math.abs(row.height - entry.height) < 2)),
        id + " 사칭·애매 행이 일반 행보다 높음", problems);
    }
  }, { capture: false });
  const example = prefix === "L" ? "L03" : "I02";
  const chosen = rowById(page, example);
  await chosen.click();
  await special(page, size, example + "-detail-scroll", (problems) => inspectDetailScroll(detail, problems));
  await special(page, size, example + "-list-end", (problems) => inspectListEnd(page, "end", problems));
  await special(page, size, example + "-list-return", (problems) => inspectListEnd(page, "start", problems));

  if (prefix !== "L") return;
  for (const [id, subtitle, fixture] of [
    ["L11", "japanese-memo", null],
    ["L04", "german-memo-fixture", "Guten Tag, für unser Forschungsprojekt benötigen wir ein ausführliches Angebot für Ultraschallgeräte. Könnten Sie uns bitte die technischen Spezifikationen, die Lieferfristen und die verfügbaren Wartungsoptionen zusenden?"],
  ]) {
    await rowById(page, id).click();
    await special(page, size, id + "-" + subtitle, async (problems) => {
      const memo = await openMemo(detail);
      if (fixture) await memo.evaluate((node, text) => { node.textContent = text; }, fixture);
      const text = await memo.textContent();
      record(fixture ? text === fixture : /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text),
        id + " 다국어 메모의 내용이 예상과 다름", problems);
      await memo.scrollIntoViewIfNeeded();
      record(await memo.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), "다국어 메모 가로 넘침", problems);
    });
    await detail.locator("summary").filter({ hasText: /^문의 의도/u }).click();
  }

  await chosen.click();
  await special(page, size, "L03-long-source", async (problems) => {
    const source = detail.locator(".source-list").first();
    const capture = await source.evaluate((element) => {
      const link = element.querySelector("a");
      const original = link.textContent;
      const url = link.href;
      const probe = "a".repeat(55) + ".long-institution-source-domain.example.test";
      link.textContent = probe;
      const bounds = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(link);
      const rects = [...range.getClientRects()];
      return { original, url, fits: rects.every((rect) => rect.right <= bounds.right + 1) };
    });
    record(capture.original === "my.clevelandclinic.org" && capture.url.includes("my.clevelandclinic.org"), "L03 공식 출처 확인 실패", problems);
    record(capture.fits, "격리 브라우저의 긴 출처 표시가 폭을 넘음", problems);
    await source.scrollIntoViewIfNeeded();
  });
  await load(page);
  await chosen.click();
  await special(page, size, "L03-200-character-institution", async (problems) => {
    const title = "긴이름".repeat(66) + "기관";
    const top = detail.locator("#card-heading");
    const rowTitle = chosen.locator("strong");
    for (const locator of [top, rowTitle]) {
      record(await locator.evaluate((element, title) => {
        element.textContent = title;
        const style = getComputedStyle(element);
        return style.textOverflow === "ellipsis" && (style.overflowX === "hidden" || style.overflowX === "clip")
          && element.scrollWidth > element.clientWidth;
      }, title), "격리 브라우저의 200자 기관명에 말줄임 없음", problems);
    }
    await top.scrollIntoViewIfNeeded();
  });
  await load(page);
  await chosen.click();
  const approve = detail.getByRole("button", { name: "승인", exact: true });
  await approve.click();
  const simulate = detail.getByRole("button", { name: "기한 경과 시뮬레이션", exact: true });
  await simulate.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await special(page, size, "L03-simulated-clock", (problems) => inspectClock(page, problems));
  await detail.getByRole("button", { name: "재배정 승인", exact: true }).click();
  await load(page);
  await special(page, size, "L03-saved-clock", async (problems) => {
    const clock = page.locator(".triage-clock p");
    await clock.waitFor();
    record(/^저장된 시연 기록 기준/u.test(await clock.textContent()),
      "재배정 후 저장 시각 문구가 없음", problems);
    await inspectClock(page, problems);
  });
  const results = page.locator("details").filter({ has: page.locator("summary", { hasText: /^판정 정답 대조$/u }) });
  await results.locator("summary").click();
  await special(page, size, "medicom-results-drawer", async (problems) => {
    const heading = results.getByRole("heading", { name: "새 블라인드 평가 30건" });
    const measurements = await heading.evaluate((node) => {
      let sheet = node;
      while (sheet.parentElement && sheet.tagName !== "DETAILS"
        && !getComputedStyle(sheet).display.includes("grid")) sheet = sheet.parentElement;
      const rect = sheet.getBoundingClientRect();
      const board = document.querySelector(".board").getBoundingClientRect();
      const list = document.querySelector(".inbox-column").getBoundingClientRect();
      const intersects = rect.left < list.right && rect.right > list.left && rect.bottom > list.top && rect.top < list.bottom;
      const details = [...sheet.querySelectorAll("[class*=scoreDetail]")];
      const detailMaxLines = Math.max(1, ...details.map((detail) => {
        const range = document.createRange();
        range.selectNodeContents(detail);
        return new Set([...range.getClientRects()].map((line) => Math.round(line.top))).size;
      }));
      return {
        width: rect.width, boardWidth: board.width, intersects,
        fits: rect.left >= -1 && rect.right <= innerWidth + 1, detailMaxLines,
      };
    });
    record(measurements.fits && measurements.width >= Math.min(770, measurements.boardWidth * 0.9), "정답 대조 서랍이 좁거나 화면 밖으로 밀림", problems);
    record(!measurements.intersects, "정답 대조 서랍이 목록 위에 겹침", problems);
    record(measurements.detailMaxLines <= 1, "정답 대조의 수치 설명이 여러 줄로 접힘", problems);
  });
  await results.locator("summary").click();
}

async function createMarketingRequest(page) {
  await page.getByRole("button", { name: "요청 접수", exact: true }).click();
  const form = page.getByRole("region", { name: "마케팅 요청 접수" });
  await form.getByLabel("요청자", { exact: true }).selectOption({ label: "본사 세일즈 · 유럽 담당" });
  await form.getByLabel("요청 유형", { exact: true }).selectOption({ label: "사례 자료" });
  await form.getByLabel("상품", { exact: true }).selectOption({ label: "PM-50" });
  await form.getByLabel("연결 리드", { exact: true }).selectOption("L03");
  await form.getByLabel("마감일", { exact: true }).fill("2026-11-26");
  await form.getByLabel("딜 규모", { exact: true }).selectOption({ label: "대" });
  await form.getByLabel("메모", { exact: true }).fill("사례 자료를 준비해 주세요.");
  await form.getByRole("button", { name: "접수하기", exact: true }).click();
}

async function auditMarketing(page, size) {
  await load(page, "/marketing");
  await createMarketingRequest(page);
  const detail = page.locator(".marketing-detail");
  const list = page.getByRole("list", { name: "요청 우선순위" });
  for (let number = 1; number <= 9; number++) {
    const id = idOf("M", number);
    const row = list.getByRole("button", { name: new RegExp("\\b" + id + "\\b", "u") });
    await auditCase({
      page, id, size, row, selector: ".marketing-detail",
      click: async () => {
        await row.scrollIntoViewIfNeeded();
        await row.click();
        await detail.locator("header p").filter({ hasText: new RegExp("^" + id + " ·", "u") }).waitFor();
      },
      inspect: async (problems) => {
        const choice = detail.getByRole("combobox", { name: "담당자", exact: true });
        if (await choice.isVisible()) {
          const flow = detail.getByRole("region", { name: "처리 흐름" });
          const advance = flow.getByRole("button", { name: "진행", exact: true });
          const [field, button] = await Promise.all([choice.boundingBox(), advance.boundingBox()]);
          record(field.width <= 261 && field.width < (await detail.boundingBox()).width * 0.75,
            "담당자 선택칸이 요청자 보기 선택칸 기준 260px를 넘음", problems);
          record(button && field.x + field.width <= button.x && Math.abs(field.y + field.height - button.y - button.height) <= 3,
            "담당자 선택칸과 진행 버튼이 나란히 놓이지 않음", problems);
        }
      },
    });
  }
  const row = list.getByRole("button", { name: /\bM07\b/u });
  await row.click();
  await special(page, size, "M07-workflow", async (problems) => {
    const assignee = detail.getByRole("combobox", { name: "담당자", exact: true });
    await assignee.scrollIntoViewIfNeeded();
    record(await assignee.isVisible(), "M07 담당자 선택칸을 열지 못함", problems);
    const width = (await assignee.boundingBox()).width;
    const showRequester = page.getByRole("button", { name: "요청자 보기", exact: true });
    await showRequester.click();
    const requester = page.getByRole("combobox", { name: "내 요청 보기", exact: true });
    const requesterWidth = (await requester.boundingBox()).width;
    record(Math.abs(width - requesterWidth) <= 1 && width <= 261,
      "담당자 선택칸과 요청자 보기 선택칸의 폭이 다름", problems);
    await showRequester.click();
    await assignee.scrollIntoViewIfNeeded();
  });
}

function asMarkdown(commit) {
  const summary = groupResults();
  const lines = [
    "# Issue #117 레이아웃 전수 점검",
    "",
    "검증 대상 커밋 `" + commit + "`.",
    "공개 프로덕션 빌드를 Chrome으로 열어 1440×900과 1280×800에서 실제 목록 버튼으로 상세를 열고 캡처했다.",
    "M09는 두 해상도마다 브라우저에서 L03을 연결해 접수했다. 독일어 메모, 200자 기관명, 긴 출처는 격리된 브라우저의 표시 문자열을 임시 교체해 확인했다. 일본어 메모는 시연 원문을 열었다.",
    "",
    "| 화면 | 확인 | 통과 |",
    "| --- | ---: | ---: |",
    ...summary.map(({ prefix, expected, tested, passed }) => "| " + ({ L: "의료기기", I: "SaaS", M: "마케팅" })[prefix] + " | " + tested + "/" + expected + " | " + passed + " |"),
    "",
    "| ID | 1440×900 | 1280×800 |",
    "| --- | --- | --- |",
  ];
  const results = (entry) => entry ? (entry.problems.length ? "실패 · " + entry.problems.join(" / ") : "통과")
    + (entry.capture ? " · `" + entry.capture + "`" : "") : "미실행";
  for (const [prefix, count] of Object.entries(implemented)) {
    for (let number = 1; number <= count; number++) {
      const id = idOf(prefix, number);
      lines.push("| " + id + " | " + sizes.map((size) => results(cases.find((entry) => entry.id === id && entry.viewport === size.width + "x" + size.height))).join(" | ") + " |");
    }
  }
  lines.push("", "| 추가 점검 | 해상도 | 결과 |", "| --- | --- | --- |");
  for (const check of checks) lines.push("| " + check.name + " | " + check.viewport + " | " + results(check) + " |");
  lines.push("", "| 상세 스크롤 후 목록 | 해상도 | 목록 하단 (px) | 마지막 행 하단 (px) | 마지막 행 전체 표시 |",
    "| --- | --- | ---: | ---: | --- |");
  for (const scroll of checks.filter((check) => check.name.endsWith("-detail-scroll"))) {
    const last = checks.find((check) => check.name === scroll.name.replace("-detail-scroll", "-list-end")
      && check.viewport === scroll.viewport);
    if (scroll.metrics && last?.metrics) {
      lines.push("| " + scroll.name.split("-")[0] + " | " + scroll.viewport + " | " + Math.round(scroll.metrics.listBottom)
        + " | " + Math.round(last.metrics.rowBottom) + " | " + (last.metrics.visible ? "예" : "아니요") + " |");
    }
  }
  lines.push("", "캡처와 원시 측정 결과는 로컬 `test-results/issue-117/`에 있다.", "");
  return lines.join("\n");
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.MIRINAE_E2E_CHROMIUM_EXECUTABLE ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  for (const size of sizes) {
    const context = await browser.newContext({ viewport: size, locale: "ko-KR", timezoneId: "Asia/Seoul", reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-24T03:00:00Z"));
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base.origin
      ? route.continue() : route.abort());
    await mkdir(resolve(out, size.width + "x" + size.height), { recursive: true });
    for (const [name, run] of [
      ["의료기기", async () => { await load(page); await auditForwards(page, size, "L"); }],
      ["SaaS", async () => { await load(page); await auditForwards(page, size, "I"); }],
      ["마케팅", () => auditMarketing(page, size)],
    ]) {
      try {
        await run();
      } catch (error) {
        checks.push({ viewport: size.width + "x" + size.height, name: "검증 흐름 " + name, problems: [String(error).split("\n")[0]] });
      }
    }
    await context.close();
    console.log(size.width + "x" + size.height, JSON.stringify(groupResults()));
  }
} finally {
  await browser.close();
}
await writeFile(resolve(out, "results.json"), JSON.stringify({ sizes, cases, checks, summary: groupResults() }, null, 2), "utf8");
const markdown = asMarkdown(process.argv[3] ?? "local");
await writeFile(resolve(out, "ISSUE_117_LAYOUT.md"), markdown, "utf8");
if (process.env.MIRINAE_WRITE_QA_REPORT === "1") {
  await writeFile(resolve("docs/qa/ISSUE_117_LAYOUT.md"), markdown, "utf8");
}
const failCount = cases.filter((entry) => entry.problems.length).length + checks.filter((entry) => entry.problems.length).length;
console.log(cases.length + " entries, " + checks.length + " additional checks, " + failCount + " failures");
if (failCount || cases.length !== 98) process.exitCode = 1;
