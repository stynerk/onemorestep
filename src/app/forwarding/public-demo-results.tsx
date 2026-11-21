import styles from "./public-demo-results.module.css";

const evaluationSource = "https://github.com/stynerk/onemorestep/blob/main/docs/qa/FINAL_EVALUATION_2026-11-20.md";

const scores = [
  { mode: "시연 30건 · 저장 근거", matched: "30/30", rate: "100%", detail: "유효 → 무효 0건 · 애매 6건" },
  { mode: "시연 30건 · 실시간 응답 재생", matched: "28/30", rate: "93.3%", detail: "개선 전 27/30 · 개선 후 유효 → 무효 0건" },
  { mode: "평가 70건 · 개선 전·블라인드", matched: "33/70", rate: "47.1%", detail: "원본 정답 기준 23/70 (32.9%) · 넘길 곳 38/67" },
  { mode: "평가 70건 · 2차 개선·평가 결과를 본 뒤", matched: "47/70", rate: "67.1%", detail: "1차 개선 45/70 (64.3%) · 넘길 곳 46/67 → 48/67 · 유효 오탐 0건 · 유효 → 무효 0건" },
];

const examples = [
  {
    id: "E02",
    institution: "분당서울대학교병원",
    actual: "애매",
    reason: "구매 의도는 인식했지만 공식 페이지를 확인하지 못해 권역 세일즈팀으로 넘겼습니다.",
    after: "개선 후 애매. 도메인은 확인했지만 소재지를 한 나라로 특정하지 못했습니다.",
  },
  {
    id: "E58",
    institution: "KAIST",
    actual: "무효",
    reason: "구매 의도는 인식했지만 검색 결과에서 기관 일치 근거를 찾지 못해 넘기지 않았습니다.",
    after: "개선 후 유효. 기관명과 도메인을 확인해 딜러 이관을 추천했습니다.",
  },
];

export function PublicDemoResults() {
  return (
    <details className={styles.results}>
      <summary>판정 정답 대조</summary>
      <div className={styles.content}>
        <p className={styles.context}>
          공개 문의함은 저장된 근거로 판정합니다. 시연은 유효 8 · 애매 6 · 국가 확인 3 · 제휴 확인 2 · 무효 11건입니다.
        </p>
        <dl className={styles.scores}>
          {scores.map(({ mode, matched, rate, detail }) => (
            <div className={styles.score} key={mode}>
              <dt>{mode}</dt>
              <dd><strong>{matched}</strong><span>{rate} 일치</span></dd>
              <dd className={styles.scoreDetail}>{detail}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.context}>
          실시간 검색 측정은 2026년 11월 20일 23:43:06~23:47:32 KST에 진행했습니다.
          {" "}평가 70건은 11월 21일에 정답을 정정했습니다. 1·2차 개선 수치는 평가 결과를 본 뒤 같은 Liner 응답 170건을 재생해 비교했습니다.
          {" "}<a href={evaluationSource}>최종 평가 기록</a>
        </p>
        <div>
          <h2 className={styles.heading}>개선 전 평가에서 틀린 판정</h2>
          <ul className={styles.examples}>
            {examples.map(({ id, institution, actual, reason, after }) => (
              <li className={styles.example} key={id}>
                <h3><span>{id}</span> {institution}</h3>
                <p className={styles.comparison}>정답 유효 → 판정 {actual}</p>
                <p>{reason}</p>
                <p>{after}</p>
              </li>
            ))}
          </ul>
        </div>
        <button className={styles.future} type="button" disabled>
          마케팅 협조 요청 · 다음 버전
        </button>
      </div>
    </details>
  );
}
