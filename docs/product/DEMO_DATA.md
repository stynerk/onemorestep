# 시연 데이터 초안 (v0.1)

작성: 서비스PM Tony, 2026-11-18. 상태: HJ 정답 표시 전. 기준: `MVP.md` "시연 데이터", DECISIONS 2026-11-17.

- 회사: Medicom(가상), 딜러망으로 파는 의료기기 제조사.
- 소속 기관은 **실제 공개 기관**이고 도메인은 공식 출처로 확인했다(2026-11-18, 아래 "출처"). 리드의 **이름과 이메일 앞부분은 페이크**다. 이메일 앞부분은 모두 `mrn-demo-번호`로 시작해 가짜임이 드러나게 한다.
- 실재하지 않는 기관과 경쟁사는 가상 이름에 예약 도메인(`example.com`, `.test`)을 쓴다.
- **어떤 리드 주소로도 메일을 보내지 않는다.** 발신은 테스트 수신함 한 곳뿐(Issue #25).
- 전화번호는 모두 `010-0000-00번호` 형식의 가짜다.

## 상품 (가상)

| 코드 | 상품 | 맞는 업종 |
|---|---|---|
| PM-50 | 환자 모니터 | 병원 |
| US-200 | 초음파 진단기 | 병원 |
| IS-3 | 구강 스캐너 | 치과병원, 치과 |

## 딜러 6곳과 최근 90일 전달 내역 요약 (가상)

| 딜러 | 지역 | 넘긴 리드 | deal | no deal | 진행 중 | 미응답 | 비고 |
|---|---|---|---|---|---|---|---|
| A메디칼 | 서울 북부 | 8 | 3 | 4 | 1 | 0 | 서울대학교병원과 이전 거래(2025-05, deal) |
| B헬스케어 | 서울 북부 | 5 | 1 | 2 | 0 | 2 | |
| C메디텍 | 서울 남부 | 7 | 3 | 3 | 1 | 0 | |
| D의료기 | 서울 남부 | 6 | 1 | 2 | 0 | 3 | 강남세브란스병원과 이전 거래(2025-03, deal). 최근 응답이 느림 |
| E메디컬 | 경기 | 6 | 2 | 3 | 1 | 0 | |
| F바이오 | 경기 | 2 | 1 | 1 | 0 | 0 | 이력 적음(3건 미만) |

전달 내역 개별 행(날짜, 기관, 결과)은 위 요약과 맞게 Cap이 생성한다. 날짜는 2026-08-20 ~ 2026-11-17 안, 기관은 아래 리드 목록과 겹치지 않게.

## 리드 30건

지역: 서울 북부(종로·중구·서대문), 서울 남부(강남·송파·동작), 경기. 순서는 접수 순이고, L06은 맨 마지막에 들어와 무효 물량 뒤에 묻힌 "놓칠 뻔한 리드"다.

| ID | 소속 | 이메일 | 국가 | 상품 | 메모 | 유형(설계) | Tony 제안 정답 | HJ 정답 |
|---|---|---|---|---|---|---|---|---|
| L01 | 서울대학교병원 | mrn-demo-01@snuh.org | 대한민국 | PM-50 | 중환자실 모니터 12대 교체 예정, 견적 요청 | 유효 | 유효 → A메디칼 | |
| L02 | 서울아산병원 | mrn-demo-02@amc.seoul.kr | 대한민국 | US-200 | 올해 예산 확보, 데모 일정 문의 | 유효 | 유효 → C메디텍 | |
| L03 | 분당서울대학교병원 | mrn-demo-03@snubh.org | 대한민국 | PM-50 | 신관 개원 대비 도입 검토, 다음 달 결정 | 유효 | 유효 → E메디컬 | |
| L04 | 서울대학교치과병원 | mrn-demo-04@snudh.org | 대한민국 | IS-3 | 보철과 3대 추가 구매 검토 | 유효 | 유효 → A메디칼 | |
| L05 | 강남세브란스병원 | mrn-demo-05@yuhs.ac | 대한민국 | US-200 | 기존 장비 노후, 교체 견적 | 유효 | 유효 → C메디텍 (이전 거래 D의료기는 미응답 3) | |
| L07 | 삼성서울병원 | mrn-demo-07@gmail.com | 대한민국 | US-200 | 가격 알려주세요 | 애매: 무료 메일 | 애매 → 전화 필요 | |
| L08 | 국립중앙의료원 | mrn-demo-08@naver.com | 대한민국 | PM-50 | 카탈로그 요청 | 애매: 무료 메일 | 애매 → 전화 필요 | |
| L09 | 서울특별시보라매병원 | mrn-demo-09@brmh.org | 대한민국 | PM-50 | 자료 참고용입니다 | 애매: 의향 없음 | 애매 → 전화 필요 | |
| L10 | 세브란스병원 | mrn-demo-10@yuhs.ac | 대한민국 | US-200 | (없음) | 애매: 의향 불명 | 애매 → 전화 필요 | |
| L11 | (빈칸) | mrn-demo-11@example.com | 대한민국 | PM-50 | test | 무효: 소속 없음 | 무효 | |
| L12 | 개인 | mrn-demo-12@example.com | 대한민국 | IS-3 | 그냥 궁금해서요 | 무효: 소속 없음 | 무효 | |
| L13 | asdf | mrn-demo-13@example.com | 대한민국 | US-200 | asdf | 무효: 스팸 | 무효 | |
| L14 | 테스트 | mrn-demo-14@example.com | 대한민국 | PM-50 | 테스트 문의 | 무효: 스팸 | 무효 | |
| L15 | Zxq Medical Group | mrn-demo-15@zxq-medical.test | 대한민국 | US-200 | 대량 구매 가능, 연락 바람 | 무효: 실재하지 않음 | 무효(소속 확인 못 함) | |
| L16 | ㅇㅇ병원 | mrn-demo-16@example.com | 대한민국 | PM-50 | 견적 | 무효: 실재하지 않음 | 무효 | |
| L17 | Mirinae Demo Clinic | mrn-demo-17@mirinae-demo.test | 대한민국 | IS-3 | 도입 검토 중 | 무효: 실재하지 않음 | 무효 (메모는 그럴듯함) | 같음 (기관이 실재하지 않으면 무효) |
| L18 | 현대자동차 | mrn-demo-18@hyundai.com | 대한민국 | PM-50 | 협업 제안드립니다 | 무효: 업종 무관 | 무효 | |
| L19 | 신한은행 | mrn-demo-19@shinhan.com | 대한민국 | US-200 | 기업 대출 상품 안내 | 무효: 업종 무관 | 무효 | |
| L20 | 이마트 | mrn-demo-20@emart.com | 대한민국 | PM-50 | 입점 제안 | 무효: 업종 무관 | 무효 | |
| L21 | 삼성전자 | mrn-demo-21@samsung.com | 대한민국 | US-200 | 부품 공급 제안 | 무효: 업종 무관 | 무효 | |
| L22 | Mayo Clinic | mrn-demo-22@mayo.edu | 대한민국 | US-200 | Please send price list | 국가 확인: 소재지 불일치 | 국가 확인 메일 발송 → 회신 대기 | 같음 (HJ 결정) |
| L23 | Charité – Universitätsmedizin Berlin | mrn-demo-23@charite.de | 대한민국 | PM-50 | Interested in demo | 국가 확인: 소재지 불일치 | 국가 확인 메일 발송 → 회신 대기 | 같음 (HJ 결정) |
| L24 | Singapore General Hospital | mrn-demo-24@sgh.com.sg | 대한민국 | US-200 | Quotation please | 국가 확인: 소재지 불일치 | 국가 확인 메일 발송 → 회신 대기 | 같음 (HJ 결정) |
| L25 | 연세대학교 | mrn-demo-25@yonsei.ac.kr | 대한민국 | US-200 | 졸업 논문 자료 요청 | 무효: 학생 | 무효 | |
| L26 | 고려대학교 | mrn-demo-26@korea.ac.kr | 대한민국 | IS-3 | 수업 과제로 사양 문의 | 무효: 학생 | 무효 | |
| L27 | 서울대학교 | mrn-demo-27@snu.ac.kr | 대한민국 | PM-50 | 영업직 채용 문의 | 무효: 구직 | 무효 | |
| L28 | Dentra Imaging (가상 경쟁사) | mrn-demo-28@dentra.example.com | 대한민국 | IS-3 | 제품 비교 자료 요청 | 무효: 경쟁사 | 무효 | |
| L29 | 서울아산병원 | mrn-demo-29@asan-medical.test | 대한민국 | US-200 | 급히 견적 필요, 선입금 가능 | 무효: 사칭 의심 | 무효(도메인 불일치) | |
| L30 | 서울대학교병원 | mrn-demo-30@snuh-hospital.test | 대한민국 | PM-50 | 대량 구매 예정, 개인 메일로 회신 | 무효: 사칭 의심 | 무효(도메인 불일치) | |
| L06 | 국민건강보험 일산병원 | mrn-demo-06@nhimc.or.kr | 대한민국 | US-200 | 입찰 전 사양 확인 요청, 이번 주 회신 필요 | 유효(놓칠 뻔한 리드) | 유효 → E메디컬 | |

구성: 유효 6, 애매 4, 국가 확인 3, 무효 17.

국가 확인(HJ 결정 2026-11-18): 소속 기관의 소재지와 리드 국가가 다르면 무효로 버리지 않는다. 지금 업무는 리드 국가에 따라 담당자에게 넘기므로, 미리내가 리드에게 **국가 확인 메일**을 자동으로 보내고 회신이 올 때까지 "국가 확인 대기"로 둔다. 회신으로 국가가 바뀌면 그 국가 기준으로 다시 판정한다. 테스트 환경에서는 이 메일도 테스트 수신함으로만 간다.

## HJ에게 부탁

"HJ 정답" 칸에 유효 / 애매 / 무효와 넘길 딜러를 적어 주세요. Tony 제안과 같으면 "같음"만 적어도 된다. 특히 실무 감각으로 볼 것:

- ~~L17~~ → 무효(HJ). ~~L22 ~ L24~~ → 국가 확인 메일(HJ)
- L18 ~ L21(비의료 회사): 비의료 업종이라도 메모에 구매 의도가 있으면(예: "사내 부속의원용 모니터 2대") 애매로 전화 확인, 영업·제휴·입점 제안이면 무효. 이 규칙이 맞는지
- 빠진 유형이 있으면 추가

## 출처 (도메인 확인, 2026-11-18)

- 서울대학교병원 snuh.org: https://www.snuh.org/global/en/main.do
- 세브란스·강남세브란스 이메일 yuhs.ac: https://sev.severance.healthcare/sev/story/donate/info.do
- 삼성서울병원 samsunghospital.com: https://www.samsunghospital.com
- 서울아산병원 amc.seoul.kr: http://www.amc.seoul.kr/asan/main.do
- 국립중앙의료원 nmc.or.kr: https://www.nmc.or.kr
- 서울대학교치과병원 snudh.org: https://www.snudh.org
- 국민건강보험 일산병원 nhimc.or.kr: https://www.nhimc.or.kr
- 서울특별시보라매병원 brmh.org: https://www.brmh.org
- 분당서울대학교병원 snubh.org: https://www.snubh.org
- Mayo Clinic 이메일 mayo.edu: https://jobs.mayoclinic.org/recruitmentfraud
- Charité charite.de: https://www.charite.de/en/
- Singapore General Hospital sgh.com.sg: https://www.sgh.com.sg
- 현대자동차 hyundai.com, 신한은행 shinhan.com, 이마트 emart.com, 삼성전자 samsung.com: 각 공식 사이트
- 연세대 yonsei.ac.kr, 고려대 korea.ac.kr, 서울대 snu.ac.kr: 각 공식 사이트

이메일 도메인이 사이트 도메인과 같다는 것은 세브란스 계열(yuhs.ac), 서울아산병원, Mayo(mayo.edu) 외에는 추정이다. 실제 판정은 Liner 검색으로 다시 확인한다(Issue #26). 경희대학교치과병원은 도메인을 확인하지 못해 뺐다.
