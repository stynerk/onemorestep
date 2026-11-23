import { expect, test, type Locator, type Page } from "@playwright/test";

// 데모 영상 자동 녹화(#99). 대본: docs/product/DEMO_SCRIPT.md 7장면. 자막은 화면 아래 오버레이.
// 공개 시연 주소(저장된 결과)만 쓴다. 단계가 실패해도 녹화를 멈추지 않고 로그를 남긴다.

type Tag = "ok" | "warn" | null;

const overlay = () => {
  const w = window as unknown as Record<string, unknown>;
  w.__setSub = (text: string, tag: string | null) => {
    let box = document.getElementById("__sub");
    if (!box) {
      box = document.createElement("div");
      box.id = "__sub";
      Object.assign(box.style, {
        position: "fixed", left: "50%", bottom: "26px", transform: "translateX(-50%)", width: "1180px",
        padding: "14px 24px", background: "rgba(17,24,39,.86)", color: "#fff", borderRadius: "12px",
        font: "600 23px/1.5 'Noto Sans CJK KR','Noto Sans KR',sans-serif", textAlign: "center",
        zIndex: "2147483647", pointerEvents: "none", whiteSpace: "pre-line", boxShadow: "0 6px 24px rgba(0,0,0,.35)",
      });
      document.documentElement.appendChild(box);
    }
    box.textContent = "";
    if (tag) {
      const badge = document.createElement("span");
      badge.textContent = tag === "ok" ? "✔ 성공" : "⚠ 실패·한계";
      Object.assign(badge.style, {
        display: "inline-block", marginRight: "12px", padding: "2px 10px", borderRadius: "6px", fontSize: "19px",
        background: tag === "ok" ? "#16a34a" : "#ea580c", color: "#fff", verticalAlign: "2px",
      });
      box.appendChild(badge);
    }
    box.appendChild(document.createTextNode(text));
    box.style.display = text ? "block" : "none";
  };
};

async function say(page: Page, text: string, ms: number, tag: Tag = null) {
  await page.evaluate(([t, g]) => (window as unknown as { __setSub: (a: string, b: string | null) => void }).__setSub(t, g), [text, tag] as const)
    .catch(() => {});
  await page.waitForTimeout(ms);
}

async function step(name: string, run: () => Promise<unknown>) {
  try { await run(); } catch (error) { console.log("[녹화 단계 실패] " + name + ": " + String(error).split("\n")[0]); }
}

async function focus(target: Locator, highlight = true) {
  await target.evaluate((el, mark) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (mark) {
      const node = el as HTMLElement;
      node.style.outline = "4px solid #f59e0b";
      node.style.outlineOffset = "3px";
      setTimeout(() => { node.style.outline = ""; }, 6000);
    }
  }, highlight);
  await target.page().waitForTimeout(700);
}

const leadButton = (page: Page, id: string) => page.getByRole("button", { name: new RegExp("^" + id + " ") }).first();
const card = (page: Page) => page.getByRole("article").first();
const directionRow = (page: Page, id: string) => page.locator(".direction-lead").filter({
  has: page.getByRole("heading", { name: new RegExp("^" + id + " ") }),
});

async function open(page: Page, id: string) {
  await leadButton(page, id).click();
  await page.waitForTimeout(500);
  const judge = card(page).getByRole("button", { name: "이 문의 판정", exact: true });
  if (await judge.isVisible().catch(() => false)) {
    await judge.click();
    await page.waitForTimeout(1500);
  }
}

async function openDirection(page: Page) {
  const toggle = page.getByRole("button", { name: /^방향이 필요한 리드 \d+건$/ });
  await toggle.click();
  await page.waitForTimeout(800);
}

test("미리내 데모 영상", async ({ page }) => {
  await page.addInitScript(overlay);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("button", { name: "판정 시작", exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.waitForTimeout(1000);

  // 장면 1 — 지금 방식의 실패
  await say(page, "딜러망으로 파는 제조사의 세일즈 담당자는\n들어오는 문의마다 전화를 걸어 진짜 고객인지 확인합니다.", 6500);
  await say(page, "그런데 문의의 대부분은 스팸, 영업 제안, 학생 과제입니다.", 5000);
  await say(page, "웹 문의에 1시간 안에 답하는 기업은 37%뿐이라는 조사도 있습니다.\n(출처: Harvard Business Review, 2011)", 6500);
  await step("장면 1 L06", async () => focus(page.locator(".lead").filter({ hasText: /\bL06\b/ }).first()));
  await say(page, "소음을 처리하는 동안, 진짜 고객은 이렇게 목록 아래에서 기다립니다.", 6500, "warn");

  // 장면 2 — 판정, 무효 일괄, 애매 질문
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await step("판정 시작", async () => page.getByRole("button", { name: "판정 시작", exact: true }).click());
  await say(page, "미리내는 먼저 판정합니다.", 3000);
  await step("판정 완료", async () => expect(page.getByRole("button", { name: "다시 판정", exact: true })).toBeEnabled({ timeout: 30_000 }));
  await step("유효 L06", async () => focus(page.locator(".lead").filter({ hasText: /\bL06\b/ }).first()));
  await say(page, "유효 8 · 애매 6 · 국가 확인 3 · 제휴 확인 2 · 무효 11.\n묻혀 있던 싱가포르 병원의 입찰 문의가 유효 맨 위로 올라왔습니다.", 7000, "ok");
  await step("무효 필터", async () => page.getByRole("navigation", { name: "문의함 필터" }).getByRole("button", { name: /^무효\s+11$/ }).click());
  await say(page, "무효 리드는 이유(소속 없음, 기관을 찾지 못함, 영업·학생·구직)와 함께 한 번에 처리합니다.\n채용 문의는 인사팀으로 넘깁니다.", 6000, "warn");
  await step("일괄 무효", async () => page.getByRole("button", { name: "일괄 무효 처리" }).click());
  await page.waitForTimeout(1500);
  await step("전체 필터", async () => page.getByRole("navigation", { name: "문의함 필터" }).getByRole("button", { name: /^전체 문의/ }).click());
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await step("방향 패널 열기", async () => openDirection(page));
  await say(page, "근거가 부족하거나 사칭이 의심되는 여섯 건은 억지로 판정하지 않고,\n확인하지 못한 한 가지를 담당자에게 묻습니다. 질문 문구는 Liner 모델이 씁니다.", 7500, "warn");
  await step("L28 사칭으로 무효", async () => {
    const row = directionRow(page, "L28");
    await focus(row, false);
    await row.getByRole("radio", { name: "사칭으로 무효" }).check();
    await page.waitForTimeout(800);
    await row.getByRole("button", { name: "답변 반영" }).click();
  });
  await say(page, "사칭이 의심되는 L28에 담당자가 '사칭으로 무효'라고 답하면 바로 다시 판정합니다.", 6000, "warn");
  await step("L08 전화로 확인", async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await openDirection(page);
    const row = directionRow(page, "L08");
    await focus(row, false);
    await row.getByRole("radio", { name: "모르겠다(전화로 확인)" }).check();
    await page.waitForTimeout(800);
    await row.getByRole("button", { name: "답변 반영" }).click();
  });
  await say(page, "메일 도메인 소유처럼 사실을 확인한 답은 같은 기관의 다음 리드에도 쓰입니다.\n전화는 모르는 것에만 걸면 됩니다.", 7000);

  // 장면 3 — Liner 근거, 사칭 의심
  await step("L01", async () => open(page, "L01"));
  await step("L01 기관 확인", async () => focus(card(page).getByRole("heading", { name: "소속 기관 확인" })));
  await say(page, "판정의 근거는 Liner 검색입니다. 소속 기관이 실제로 있는지, 어느 나라에 있는지,\n공식 도메인이 무엇인지 확인하고 링크와 검색 시각을 붙입니다.", 8000, "ok");
  await step("L01 도메인", async () => focus(card(page).getByRole("heading", { name: "이메일 도메인" })));
  await say(page, "리드의 이메일 도메인을 공식 도메인과 대조합니다.\n문의 의도와 도메인 소유는 Liner 모델(Router)이 읽고 원문 인용으로 근거를 붙입니다.", 8000, "ok");
  await step("L29", async () => { await open(page, "L29"); await focus(card(page).getByText(/사칭 의심/).first()); });
  await say(page, "같은 병원 이름을 썼지만 도메인이 다른 이 리드는 사칭 의심으로 표시해\n권역 세일즈팀이 결정하게 넘깁니다.", 7500, "warn");
  await say(page, "검색이 실패하면 미리내는 유효를 주지 않고 사람에게 넘깁니다.\n(이 영상은 저장된 검색 결과로 재생합니다. 실시간 검색은 README 절차로 재현할 수 있습니다)", 7000);

  // 장면 4 — 딜러 추천
  await step("L05", async () => { await open(page, "L05"); await focus(card(page).getByRole("heading", { name: "추천 딜러" })); });
  await say(page, "어느 딜러에게 넘길지도 기록으로 정합니다.", 4500, "ok");
  await step("L05 이력", async () => {
    const history = card(page).getByText(/최근 \d+일 이력 보기/).first();
    await focus(history, false);
    await history.click();
  });
  await say(page, "이 병원은 예전에 D 딜러와 거래했지만, 최근 90일 동안 세 번 응답하지 않았습니다.\n그래서 A 딜러를 추천합니다.", 8500, "ok");
  await step("L06", async () => { await open(page, "L06"); await focus(card(page).getByRole("heading", { name: "추천 딜러" }), false); });
  await say(page, "반대로 믿을 만한 기록이 없는 신규 딜러뿐이면,\n미리내는 바로 넘기지 않고 지역 담당자에게 먼저 묻습니다.", 7500, "warn");

  // 장면 5 — 승인
  await step("L05 미리보기", async () => {
    await open(page, "L05");
    const preview = card(page).getByText("딜러 요약 미리보기", { exact: true });
    await focus(preview, false);
    await preview.click();
  });
  await say(page, "담당자는 근거를 보고 추천을 승인합니다. 딜러용 리드 요약 메일이 나갑니다.", 6000, "ok");
  await step("L05 승인", async () => card(page).getByRole("button", { name: "승인", exact: true }).click());
  await say(page, "테스트 환경에서는 실제 딜러가 아닌 테스트 수신함으로 발송합니다.\n(공개 시연 주소는 메일을 보내지 않습니다)", 6000);
  await step("L12", async () => open(page, "L12"));
  await say(page, "국가가 맞지 않거나 제휴 제안인 리드는 판정을 미루고, 확인 메일을 먼저 보냅니다.", 6000, "warn");

  // 장면 6 — 재배정
  await step("L23 회신", async () => {
    await open(page, "L23");
    const choice = page.locator("#L23-partnership-choice");
    if (await choice.isVisible().catch(() => false)) {
      await choice.selectOption("purchase");
      await page.locator("#L23-partnership-note").fill("구매 문의로 확인");
      await card(page).getByRole("button", { name: "회신 기록" }).click();
      await page.waitForTimeout(1200);
    }
    await focus(card(page).getByRole("heading", { name: "추천 딜러" }));
  });
  await say(page, "비교용 미국 리드 L23: 회신으로 구매 문의가 확인돼 딜러 추천이 나옵니다.\n지금은 V MedSource가 1위입니다.", 7000);
  await step("L03 승인", async () => { await open(page, "L03"); await card(page).getByRole("button", { name: "승인", exact: true }).click(); });
  await say(page, "L03을 V MedSource에 넘겼습니다.", 3500);
  await step("기한 경과", async () => {
    await page.getByRole("button", { name: "기한 경과 시뮬레이션" }).click();
    await focus(page.getByRole("region", { name: "재배정 제안" }));
  });
  await say(page, "딜러가 기한 안에 응답하지 않는 실패도 생깁니다.\n미리내가 먼저 알아채고 다음 딜러를 제안합니다.", 7500, "warn");
  await step("재배정 승인", async () => page.getByRole("button", { name: "재배정 승인", exact: true }).click());
  await say(page, "승인하면 바로 U Health Supply로 넘어가고, 응답하지 않은 기록은 다음 추천에 반영됩니다.", 6500, "ok");
  await step("L23 다시", async () => { await open(page, "L23"); await focus(card(page).getByRole("heading", { name: "추천 딜러" })); });
  await say(page, "같은 미국 리드에서 V MedSource가 1위에서 2위로 내려갔습니다.", 6000, "ok");

  // 장면 7 — 정답 대조, 업종 전환
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await step("시연 시각 해제", async () => {
    const release = page.getByRole("button", { name: "시연 시각 해제" });
    if (await release.isVisible().catch(() => false)) await release.click();
  });
  await step("패널 열기", async () => {
    const summary = page.getByText("판정 정답 대조", { exact: true });
    await summary.click();
    await focus(page.getByRole("heading", { name: "새 블라인드 평가 30건" }));
  });
  await say(page, "엔진을 먼저 고정하고, 처음 보는 30건을 실무자가 매긴 정답과 비교했습니다.\n17건이 맞았습니다(넘길 곳 21/30).", 7500);
  await say(page, "틀린 13건은 모두 미리내가 확신하지 못해 사람에게 넘긴 건이고,\n진짜 고객을 버리거나 가짜를 진짜로 올린 건은 한 건도 없습니다.", 8000, "warn");
  await step("사례", async () => focus(page.getByRole("heading", { name: "개선 전 평가에서 틀린 판정" }), false));
  await say(page, "이전 개발용 70건 평가 사례: 이 병원은 소재지를 한 나라로 특정하지 못해 사람에게 넘겼고,\n이 연구실 문의는 원인을 고친 뒤 딜러 이관을 추천하게 됐습니다.", 9000, "warn");
  await step("SaaS 전환", async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.getByRole("button", { name: "B2B SaaS" }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "판정 시작", exact: true }).click();
    await expect(page.getByRole("button", { name: "다시 판정", exact: true })).toBeEnabled({ timeout: 30_000 });
    await open(page, "I02");
    await focus(card(page).getByRole("heading", { name: "추천 파트너" }));
  });
  await say(page, "같은 엔진에 데이터와 정책만 바꾸면 SaaS 리셀러망에서도 그대로 돕니다.", 8000, "ok");
  await step("의료기기 복귀", async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.getByRole("button", { name: "의료기기(Medicom)" }).click();
    await page.waitForTimeout(800);
    const panel = page.locator("details").filter({ hasText: "판정 정답 대조" }).first();
    if (!(await panel.evaluate((el) => (el as HTMLDetailsElement).open).catch(() => false))) {
      await page.getByText("판정 정답 대조", { exact: true }).click();
    }
    await focus(page.getByRole("button", { name: /마케팅 협조 요청/ }));
  });
  await say(page, "같은 원칙, AI가 준비하고 사람은 승인하는 방식은\n다른 판매망과 다른 업무로 넓힐 수 있습니다.", 6500);
  await say(page, "미리내였습니다.", 3500);
  await say(page, "", 500);
});
