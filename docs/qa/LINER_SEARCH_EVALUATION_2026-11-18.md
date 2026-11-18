# Liner Search 실호출 평가 — Issue #26

실행: 2026-11-18 05:16 UTC / 14:16 KST. 정오 기한 이후 수행한 결과이며 소급하지 않는다. 대상은 시연 리드의 공개 기관 5곳이다. 기존 승인된 키로 Search만 10회 호출했고, Model·메일·잔액 조회는 이번 평가에서 호출하지 않았다. 키·인증 헤더·인증 응답·실제 개인 정보는 기록하지 않는다.

## 결론과 기준

**보수적 기준 3/5 충족 → 실시간 시연.** 이는 이번 다섯 기관에서 검색 근거를 수동 추출할 수 있었는지에 대한 판정이며, #29 자동 판정 엔진의 정확도나 30건 전체 성공률은 아니다.

기관별 두 질의가 정상 응답하고, 반환된 공식 기관·공식 의료그룹의 제목·설명·URL에서 실재·업종·소재지·공식 도메인의 네 항목을 모두 확인해야 성공으로 센다. 검색 조건의 국가, country_code, 국가 도메인, 기관명 속 지명만으로 실제 소재지를 채우지 않았다. 제3자 출처에만 직접 위치가 있는 경우는 부분 충족으로 남겼다. 추가 페이지 방문이나 기존 정답셋으로 부족한 근거를 채우지 않았다.

## 기관별 결과

| 기관 | 실재 | 업종 | 소재지 | 공식 도메인 | 판정 |
|---|---|---|---|---|---|
| 서울대학교병원 | 공식 홈페이지·예약 안내 확인 | 병원·외래 진료 | 반환 공식 스니펫의 직접 위치 근거 부족. 주소는 나무위키 보조 결과에만 있음 | snuh.org | 부분 충족 |
| The University of Tokyo Hospital | 공식 홈페이지 확인 | 병원·의료 서비스 | 직접적인 Bunkyo/Tokyo/Japan 위치 설명은 Wikipedia 결과에만 있음 | h.u-tokyo.ac.jp | 부분 충족 |
| Cleveland Clinic | 공식 홈페이지·위치 페이지 확인 | 의료·병원 | 공식 위치 결과에 Cleveland, Ohio 주소 | clevelandclinic.org | 성공 |
| Charité | 공식 홈페이지 확인 | 의료·대학병원 | 공식 결과에 Berlin 주소 | charite.de | 성공 |
| Singapore General Hospital | 공식 홈페이지·SingHealth 자료 확인 | 종합병원 | 공식 의료그룹 SingHealth 결과에 Singapore 소재 병원으로 명시 | sgh.com.sg | 성공 |

두 부분 충족 기관은 API 실패나 기관 부재가 아니다. 네 항목 중 소재지의 엄격한 출처 기준을 충족하지 못한 것이다. 자동 판정에서 이 누락을 곧바로 무효로 바꿔서는 안 된다.

반환 근거 링크:

- 서울대학교병원: [공식 홈페이지](https://www.snuh.org/), [외래 예약 안내](https://www.snuh.org/content/M001004005.do).
- Tokyo: [공식 영문 홈페이지](https://www.h.u-tokyo.ac.jp/english/).
- Cleveland: [공식 위치](https://my.clevelandclinic.org/locations), [공식 홈페이지](https://my.clevelandclinic.org/).
- Charité: [공식 홈페이지](https://www.charite.de/).
- Singapore: [공식 홈페이지](https://www.sgh.com.sg/), [공식 의료그룹 SingHealth](https://www.singhealth.com.sg/).

## 질의와 실행 결과

요청은 POST https://platform.liner.com/api/v1/tools/search/web, max_results=3, include_knowledge=false, 동시 요청 2개, 요청별 제한 8초, 자동 재시도 0회다. country_code/lang은 검색 지역화 옵션이며 추출한 소재지의 증거로 세지 않는다. 일반 기관명 질의이며 site: 제한이나 공식 도메인을 질의에 미리 넣지 않았다.

| 기관 | 질의 | lang / country_code | HTTP | 결과 수 | 지연(ms) |
|---|---|---|---:|---:|---:|
| 서울대학교병원 | 서울대학교병원 대한민국 | ko / kr | 200 | 3 | 2521 |
| 서울대학교병원 | 서울대학교병원 병원 | ko / kr | 200 | 3 | 2499 |
| Tokyo | The University of Tokyo Hospital Japan | en / jp | 200 | 3 | 3940 |
| Tokyo | The University of Tokyo Hospital hospital | en / jp | 200 | 3 | 3419 |
| Cleveland | Cleveland Clinic United States | en / us | 200 | 3 | 1963 |
| Cleveland | Cleveland Clinic hospital | en / us | 200 | 3 | 2202 |
| Charité | Charité Germany | en / de | 200 | 3 | 2677 |
| Charité | Charité university hospital | en / de | 200 | 3 | 2774 |
| Singapore | Singapore General Hospital Singapore | en / sg | 200 | 3 | 1849 |
| Singapore | Singapore General Hospital hospital | en / sg | 200 | 3 | 2117 |

집계: 10회 실행, HTTP 200 10건, 오류 0건, 각 3결과, 지연 1849~3940ms. HTTP 성공 10/10과 기관 네 항목 충족 3/5는 별도 수치다. [공식 비프리미엄 요금](https://liner.com/developers/docs/search-api#premium-data) 기준 계산상 10회는 USD 0.01이며, 실제 계정 정산·차감액을 조회한 값은 아니다.

실제 관찰한 응답 최상위 필드: requestId, results, totalCount. 결과 항목 필드: title, url, hostname, faviconUrl, description, date. description은 검색 스니펫이며 생성형 종합 요약이 아니다. 이번 응답에는 별도 생성 답변·인용 번호 필드가 없었고, URL을 근거 링크로 보관한다. 전체 원문 스니펫·요청 ID·응답 본문은 이 문서에 복제하지 않았다.

## #29 인계

실시간 조사 경로를 기본 시연 방식으로 진행할 수 있다. 단, 기관별 실패·근거 부족을 그대로 보이고, 저장 결과는 별도 모드·시각·출처로 표시한다. 이 다섯 기관의 검사로 시연 리드 30건이나 모든 도메인 별칭이 자동 해결된다고 주장하지 않는다. 서울대학교병원·Tokyo의 위치 근거 부족과 다국적 기관의 지점 구분을 후속 추출 테스트에 포함한다.

국가 질의는 기관 소재국 기준으로 구성했으며 Charité에는 Germany를 사용했다. DEMO_DATA의 L12 리드 국가인 대한민국을 질의에 넣는 국가 불일치 경로 검증은 별도다.

Model API의 문서상 존재·엔드포인트와 기본 모드·일괄 처리 제안은 [LINER_API.md](../tech/LINER_API.md)에 적는다. 이번 평가에서 모델 생성 권한·지연·품질은 확인하지 않았다.
