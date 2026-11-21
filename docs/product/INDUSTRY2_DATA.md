# 두 번째 업종 시연 데이터 — B2B SaaS (#74)

작성: 서비스PM Tony, 2026-11-22. 상태: HJ 확인 전. 기준: DECISIONS 2026-11-21 "다른 업종 설정 시연(B2B SaaS)", Issue #74.

목적: 기획서 4절의 "판정·추천 흐름은 그대로 두고 딜러 초기 데이터와 정책값만 바꾸면 다른 판매망에서 돈다"를 화면으로 보인다. **판정 엔진 코드(동결 `c1f7c46`)는 바꾸지 않는다.** 이 문서의 표만 설정으로 넣는다.

## 회사와 상품 (가상)

- 회사: **Flowline**(가상), 업무 흐름 관리 SaaS를 나라별 리셀러·구축 파트너망으로 판다.
- 화면 문구: "딜러" → "파트너"(설정으로 바뀌면 바꾸고, 안 되면 그대로).

| 코드 | 상품 |
|---|---|
| FL-Team | 팀 단위 업무 흐름 관리(좌석 구독) |
| FL-Enterprise | 전사 도입형(SSO·감사 로그 포함) |
| FL-API | 외부 시스템 연동 API |

## 정책값 (의료기기와 같은 형식)

| 항목 | 값 |
|---|---|
| 집계 기간 | 90일 |
| 이력 적음 기준 | 전달 3건 미만 |
| 응답 기한 | 업무일 1일, Asia/Seoul, 주말 제외 |
| 가중치 | 미응답 1건당 −0.1, 이 기관과 이전 거래 +0.1 |
| 주요 고객 업종(참고 표시만) | 제조, 금융, IT 서비스, 연구기관, 공공 |
| 나라 → 권역 | 의료기기 시연과 같은 매핑(대한민국·일본·싱가포르 APAC, 미국·캐나다 NA, 독일 EU) |
| 기관 도메인 별칭 | 없음(이 업종은 별칭 없이 시작) |

## 파트너 7곳과 최근 90일 전달 요약 (가상)

전달 내역 개별 행은 이 요약과 맞게 Cap이 생성한다(날짜 2026-08-20~11-17, 리드 기관과 겹치지 않게).

| 파트너 | 국가 | 전달 | deal | no deal | 진행 중 | 미응답 | 비고 |
|---|---|---:|---:|---:|---:|---:|---|
| Seoul Cloud Partners | 대한민국 | 8 | 3 | 4 | 1 | 0 | LG Electronics와 이전 거래 |
| K-Integrate | 대한민국 | 6 | 1 | 2 | 0 | 3 | 최근 응답 느림 |
| Tokyo SI Works | 일본 | 7 | 3 | 3 | 1 | 0 | |
| Pacific Cloud Resellers | 미국 | 6 | 2 | 3 | 0 | 1 | |
| Bay Systems Group | 미국 | 7 | 3 | 3 | 1 | 0 | |
| Rhein Digital GmbH | 독일 | 5 | 2 | 2 | 1 | 0 | |
| Merlion Cloud Pte | 싱가포르 | 2 | 1 | 1 | 0 | 0 | 신규 파트너, 이력 적음 |

## 리드 10건 (접수 순)

이름·이메일 앞부분·전화는 가상(`mrn-saas-번호`). 실제 기관 이름과 도메인은 아래 "출처"로 확인한 공개 정보다. 가상 기관과 사칭 도메인은 예약 도메인(`.test`)을 쓴다.

| ID | 소속 | 이메일 | 리드 국가 | 상품 | 메모 | 정답 판정 | 넘길 곳 |
|---|---|---|---|---|---|---|---|
| I01 | Siemens AG | mrn-saas-01@siemens.com | 독일 | FL-Enterprise | We are evaluating a workflow platform for 2,000 users and need a quote | 유효 | 파트너: Rhein Digital GmbH |
| I02 | LG Electronics (LG전자) | mrn-saas-02@lge.com | 대한민국 | FL-Team | 사내 300명 규모 도입을 검토 중입니다. 견적과 데모 요청드립니다 | 유효 | 파트너: Seoul Cloud Partners |
| I03 | Hitachi, Ltd. | mrn-saas-03@hitachi.com | 일본 | FL-Enterprise | 全社導入を検討しています。見積もりをお願いします | 유효 | 파트너: Tokyo SI Works |
| I04 | BASF SE | mrn-saas-04@gmail.com | 독일 | FL-Team | price? | 애매(무료 메일) | 권역 세일즈팀(EU) |
| I05 | Max Planck Society | mrn-saas-05@gv.mpg.de | 미국 | FL-API | Need API access licenses for our lab, please send pricing | 국가 확인 | 권역 세일즈팀(NA) |
| I06 | Robert Bosch GmbH | mrn-saas-06@de.bosch.com | 독일 | FL-Enterprise | We'd like to discuss a reseller partnership for Germany | 제휴 확인 | 권역 세일즈팀(EU) |
| I07 | University of Toronto | mrn-saas-07@utoronto.ca | 캐나다 | FL-Team | Course project: I'm comparing workflow SaaS pricing for my report | 무효(학생) | 없음 |
| I08 | Brightwave Analytics | mrn-saas-08@brightwave.test | 미국 | FL-Team | We plan to buy 500 seats this quarter | 무효(가상 기관) | 없음 |
| I09 | Siemens AG | mrn-saas-09@siemens-procurement.test | 독일 | FL-Enterprise | Urgent license order, payment in advance, reply to this address only | 애매(사칭 의심) | 권역 세일즈팀(EU) |
| I10 | Roche | mrn-saas-10@roche.com | 미국 | FL-Team | I'd like to apply for your solutions engineer opening | 무효(채용) | 인사팀 |

구성: 유효 3, 애매 2, 국가 확인 1, 제휴 확인 1, 무효 3. I02는 의료기기 시연 L05처럼 "이전 거래 파트너가 아니라 최근 성과가 좋은 파트너"를 보이는 장면이다(Seoul Cloud Partners 0.53 > K-Integrate 0.03, 점수식은 의료기기와 같다).

정답은 HJ 결정 기준(11-18·11-20·11-21)을 그대로 적용했다: 가상 기관은 무효, 사칭 의심은 애매·권역 세일즈팀, 채용은 무효·인사팀, 학생 개인 과제는 무효·넘기지 않음, 제휴는 제휴 확인·권역 세일즈팀.

## 이 업종에서 의료기기와 다르게 볼 수 있는 점 (11-21 Tony 추천, HJ 확인)

1. 무료 메일: SaaS는 작은 회사가 무료 메일을 흔히 쓴다. 그래도 이번 시연은 의료기기와 같은 규칙(애매, 권역팀 연락)을 유지한다.
2. 리셀러가 되겠다는 문의: 제휴 확인(I06).
3. 기존 고객의 지원 문의: 무효로 보고 고객지원팀에 넘기는 것이 맞지만, 넘길 곳 "고객지원팀"은 동결 엔진에 없어서 이번 10건에는 넣지 않았다. 다음 버전 후보로 둔다.

## 측정 방식

- 저장된 결과로 시연한다. 실시간 Liner 측정은 하지 않는다(#74 제외 범위). 실제 기관 6곳의 저장 근거는 아래 공식 출처로 만든다.
- 10건의 저장 결과가 정답과 몇 건 맞는지 그대로 보고한다. 엔진은 고치지 않는다.

## 출처 (도메인, 2026-11-19 researcher 확인, `EVAL_DATA.md`와 같은 출처)

| 기관 | 이메일 도메인 | 출처 |
|---|---|---|
| Siemens AG | siemens.com | https://www.siemens.com/en-us/contact/press-contacts |
| LG Electronics | lge.com | https://www.lg.com/us/press-release/lg-electronics-ai-and-iot-innovations-transforming-accessibility-opportunities |
| Hitachi, Ltd. | hitachi.com | https://www.hitachi.com/en-us/contact/ |
| Max Planck Society | gv.mpg.de | https://www.mpg.de/en/contact/communication |
| Robert Bosch GmbH | de.bosch.com | https://bosch-presse.de/pressportal/de/en/contact.html |
| University of Toronto | utoronto.ca | https://president.utoronto.ca/contact-us/ |
| Roche | roche.com | https://www.roche.com/contact/media-contacts |
| BASF SE | (무료 메일 리드라 도메인 대조 없음) | https://www.basf.com/global/en/media/contact.html |
