import styles from "./public-demo-results.module.css";

const scores = [
  { mode: "저장된 결과", matched: "30/30", rate: "100%", validToInvalid: 0, ambiguous: 3 },
  { mode: "실시간 검색 실측", matched: "19/30", rate: "63.3%", validToInvalid: 0, ambiguous: 13 },
];

const examples = [
  {
    id: "L13",
    label: "위험한 오류 · 실시간",
    expected: "국가 확인",
    actual: "유효",
    reason: "국가 확인 없이 유효로 판정해 딜러에게 잘못 넘길 수 있었습니다.",
  },
  {
    id: "L05",
    label: "안전한 오류 · 실시간",
    expected: "유효",
    actual: "애매",
    reason: "기관 소재지를 한 나라로 확인하기 어려워 담당자 확인으로 넘겼습니다.",
  },
  {
    id: "L08",
    label: "한계 사례 · 저장",
    expected: "애매",
    actual: "애매",
    reason: "무료 메일 주소로 소속을 확인하기 어려워 담당자 확인으로 넘겼습니다.",
  },
];

export function PublicDemoResults() {
  return (
    <details className={styles.results}>
      <summary>시연 30건 정답 대조</summary>
      <div className={styles.content}>
        <p className={styles.context}>
          2026년 11월 19일 통합 QA 기록. 실시간 수치는 로컬에서 별도로 측정했습니다.
        </p>
        <dl className={styles.scores}>
          {scores.map(({ mode, matched, rate, validToInvalid, ambiguous }) => (
            <div className={styles.score} key={mode}>
              <dt>{mode}</dt>
              <dd><strong>{matched}</strong><span>{rate} 일치</span></dd>
              <dd className={styles.scoreDetail}>유효 → 무효 {validToInvalid}건 · 애매 {ambiguous}건</dd>
            </div>
          ))}
        </dl>
        <div>
          <h2 className={styles.heading}>판정 사례</h2>
          <ul className={styles.examples}>
            {examples.map(({ id, label, expected, actual, reason }) => (
              <li className={styles.example} key={id}>
                <h3><span>{id}</span> {label}</h3>
                <p className={styles.comparison}>정답 {expected} → 판정 {actual}</p>
                <p>{reason}</p>
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
