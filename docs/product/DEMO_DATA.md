# 시연 데이터 초안 (v0.2, 글로벌)

작성: 서비스PM Tony, 2026-11-18. 상태: HJ 정답 표시 전. 기준: `MVP.md` "시연 데이터", DECISIONS 2026-11-17·18.

v0.2 변경: 국가를 여러 나라로 섞었다(HJ 요청). 업종을 의료로 제한하지 않는다(HJ 결정 2026-11-18). 딜러는 국가 단위로 바꿨다(지금 업무는 리드 국가로 넘긴다).

- 회사: Medicom(가상), 딜러망으로 파는 의료기기 제조사.
- 소속 기관은 **실제 공개 기관과 가상 기관을 섞었다.** 실제 기관의 도메인은 공식 출처로 확인했다(2026-11-18, 아래 "출처"). 리드의 **이름과 이메일 앞부분은 페이크**이고 모두 `mrn-demo-번호`로 시작한다.
- 가상 기관과 경쟁사는 예약 도메인(`example.com`, `.test`)을 쓴다.
- 전화번호는 모두 가짜다.
- 테스트 환경에서는 어떤 리드·딜러 주소로도 실제 발송하지 않는다. 모든 메일은 테스트 수신함 한 곳으로 간다(Issue #25).

## 상품 (가상)

| 코드 | 상품 |
|---|---|
| PM-50 | 환자 모니터 |
| US-200 | 초음파 진단기(연구용 모드 포함) |
| IS-3 | 구강 스캐너 |

## 업종 기준 (HJ 결정 2026-11-18: 의료로 제한하지 않는다)

업종은 **무효의 근거가 아니라 참고 신호**다. 판정은 실재, 도메인, 메모 의도로 한다.

| 소속 업종 | 메모가 구매·검토 의도 | 메모가 영업·제휴·입점 제안 | 메모가 과제·논문·채용 |
|---|---|---|---|
| 주요 고객 업종(병원·의원, 치과, 연구소, 대학 연구실, 제약·바이오, 의료기기 유통) | 유효 후보 | 무효 | 무효 |
| 그 밖의 업종(자동차, 금융, 유통 등) | 애매(전화 확인. 예: 사내 부속의원) | 무효 | 무효 |

- "주요 고객 업종" 목록은 서비스 정책이라 **설정에서 상품별로 바꿀 수 있다.**
- 메모가 비어 있거나 의도를 알 수 없으면 업종과 관계없이 애매.

## 딜러 7곳과 최근 90일 전달 내역 요약 (가상)

딜러는 국가 단위로 맡는다. 딜러가 없는 나라의 리드는 "딜러 없음 → 담당자 직접 처리"로 간다.

| 딜러 | 국가 | 넘긴 리드 | deal | no deal | 진행 중 | 미응답 | 비고 |
|---|---|---|---|---|---|---|---|
| A Medical | 대한민국 | 8 | 3 | 4 | 1 | 0 | 서울대학교병원과 이전 거래 |
| D Medi | 대한민국 | 6 | 1 | 2 | 0 | 3 | 강남세브란스병원과 이전 거래. 최근 응답 느림 |
| J Medica | 일본 | 7 | 3 | 3 | 1 | 0 | |
| U Health Supply | 미국 | 6 | 2 | 3 | 0 | 1 | |
| V MedSource | 미국 | 7 | 3 | 3 | 1 | 0 | |
| E Medtech GmbH | 독일 | 5 | 2 | 2 | 1 | 0 | |
| S Medical Pte | 싱가포르 | 2 | 1 | 1 | 0 | 0 | 신규 딜러, 이력 적음(3건 미만) |

딜러 없음: 호주, 영국, 스웨덴, 베트남, 인도, 프랑스.

전달 내역 개별 행(날짜, 기관, 결과)은 위 요약과 맞게 Cap이 생성한다. 날짜는 2026-08-20 ~ 2026-11-17 안, 기관은 아래 리드와 겹치지 않게.

## 리드 30건

순서는 접수 순이다. L06은 맨 마지막에 들어와 무효 물량 뒤에 묻힌 "놓칠 뻔한 리드"다.

"도메인 주의"는 기관 사이트 도메인과 이메일 도메인이 다른 곳이다. 검색 결과의 사이트 도메인만 보면 틀리게 판정할 수 있어, 판정 규칙이 별칭을 처리해야 한다(아래 "판정 규칙에 주는 영향").

| ID | 소속 | 실제/가상 | 이메일 | 리드 국가 | 상품 | 메모 | 유형(설계) | Tony 제안 정답 | HJ 정답 |
|---|---|---|---|---|---|---|---|---|---|
| L01 | 서울대학교병원 | 실제 | mrn-demo-01@snuh.org | 대한민국 | PM-50 | 중환자실 모니터 12대 교체 예정, 견적 요청 | 유효 | 유효 → A Medical | |
| L02 | The University of Tokyo Hospital | 실제 | mrn-demo-02@h.u-tokyo.ac.jp | 일본 | US-200 | Budget approved this year, requesting a demo | 유효 | 유효 → J Medica | |
| L03 | Cleveland Clinic | 실제, 도메인 주의 | mrn-demo-03@ccf.org | 미국 | PM-50 | Replacing monitors in the new wing, decision next month | 유효 | 유효 → V MedSource (U는 미응답 1) | |
| L04 | Fraunhofer-Gesellschaft | 실제 | mrn-demo-04@fraunhofer.de | 독일 | US-200 | Our lab is evaluating ultrasound for a research project, please send a quote | 유효(병원 아님) | 유효 → E Medtech GmbH | |
| L05 | 강남세브란스병원 | 실제, 도메인 주의 | mrn-demo-05@yuhs.ac | 대한민국 | US-200 | 기존 장비 노후, 교체 견적 | 유효 | 유효 → A Medical (이전 거래 D Medi는 미응답 3) | |
| L07 | The Royal Melbourne Hospital | 실제, 도메인 주의 | mrn-demo-07@mh.org.au | 호주 | PM-50 | Planning to purchase 6 units next quarter | 유효(딜러 없음) | 유효 → 딜러 없음, 담당자 직접 처리 | |
| L08 | Mayo Clinic | 실제 | mrn-demo-08@gmail.com | 미국 | US-200 | price? | 애매: 무료 메일 | 애매 → 전화 필요 | |
| L09 | Guy's and St Thomas' NHS Foundation Trust | 실제, 도메인 주의 | mrn-demo-09@gstt.nhs.uk | 영국 | PM-50 | For reference only | 애매: 의향 없음 | 애매 → 전화 필요 | |
| L10 | 삼성서울병원 | 실제 | mrn-demo-10@naver.com | 대한민국 | PM-50 | 카탈로그 요청 | 애매: 무료 메일 | 애매 → 전화 필요 | |
| L11 | Toyota Motor Corporation | 실제, 도메인 주의 | mrn-demo-11@mail.toyota.co.jp | 일본 | PM-50 | 社内診療所用に2台検討しています | 애매: 그 밖의 업종 + 구매 의도 | 애매 → 전화 필요 | |
| L12 | Charité – Universitätsmedizin Berlin | 실제 | mrn-demo-12@charite.de | 대한민국 | PM-50 | Interested in a demo | 국가 확인 | 국가 확인 메일 → 회신 대기 | |
| L13 | Vinmec International Hospital | 실제 | mrn-demo-13@vinmec.com | 미국 | US-200 | Quotation please | 국가 확인 | 국가 확인 메일 → 회신 대기 | |
| L14 | Apollo Hospitals | 실제 | mrn-demo-14@apollohospitals.com | 일본 | PM-50 | Need pricing for 10 units | 국가 확인 | 국가 확인 메일 → 회신 대기 | |
| L15 | (빈칸) | - | mrn-demo-15@example.com | 대한민국 | PM-50 | test | 무효: 소속 없음 | 무효 | |
| L16 | Individual | - | mrn-demo-16@example.com | 미국 | IS-3 | just curious | 무효: 소속 없음 | 무효 | |
| L17 | asdf | - | mrn-demo-17@example.com | 독일 | US-200 | asdf | 무효: 스팸 | 무효 | |
| L18 | Zxq Medical Group | 가상 | mrn-demo-18@zxq-medical.test | 미국 | US-200 | Bulk purchase possible, contact me | 무효: 실재하지 않음 | 무효 | |
| L19 | Mirinae Demo Clinic | 가상 | mrn-demo-19@mirinae-demo.test | 베트남 | IS-3 | Considering adoption this year | 무효: 실재하지 않음(메모는 그럴듯함) | 무효 | |
| L20 | Sakura Test Hospital | 가상 | mrn-demo-20@sakura-test.test | 일본 | PM-50 | 見積もりをお願いします | 무효: 실재하지 않음 | 무효 | |
| L21 | HSBC | 실제 | mrn-demo-21@hsbc.com | 영국 | PM-50 | We'd like to offer corporate banking services | 무효: 영업 제안 | 무효 | |
| L22 | 현대자동차 | 실제 | mrn-demo-22@hyundai.com | 대한민국 | PM-50 | 협업 제안드립니다 | 무효: 제휴 제안 | 무효 | |
| L23 | Pfizer | 실제 | mrn-demo-23@pfizer.com | 미국 | US-200 | Proposal for a co-marketing partnership | 무효: 제휴 제안(주요 고객 업종이지만) | 무효 | |
| L24 | Massachusetts Institute of Technology | 실제 | mrn-demo-24@mit.edu | 미국 | US-200 | Need specs for a class project | 무효: 학생 | 무효 | |
| L25 | 연세대학교 | 실제 | mrn-demo-25@yonsei.ac.kr | 대한민국 | US-200 | 졸업 논문 자료 요청 | 무효: 학생 | 무효 | |
| L26 | The University of Tokyo | 실제 | mrn-demo-26@u-tokyo.ac.jp | 일본 | PM-50 | Applying for a sales position | 무효: 구직 | 무효 | |
| L27 | Dentra Imaging | 가상 경쟁사 | mrn-demo-27@dentra.example.com | 독일 | IS-3 | Requesting product comparison materials | 무효: 경쟁사 | 무효 | |
| L28 | 서울아산병원 | 실제 이름, 가짜 도메인 | mrn-demo-28@asan-medical.test | 대한민국 | US-200 | 급히 견적 필요, 선입금 가능 | 무효: 사칭 의심 | 무효(도메인 불일치) | |
| L29 | Cleveland Clinic | 실제 이름, 가짜 도메인 | mrn-demo-29@clevelandclinic-mail.test | 미국 | PM-50 | Urgent order, reply to this address only | 무효: 사칭 의심 | 무효(도메인 불일치) | |
| L30 | Karolinska University Hospital | 실제 이름, 가짜 도메인 | mrn-demo-30@karolinska-hospital.test | 스웨덴 | US-200 | Large order, payment in advance | 무효: 사칭 의심 | 무효(도메인 불일치) | |
| L06 | Singapore General Hospital | 실제 | mrn-demo-06@sgh.com.sg | 싱가포르 | PM-50 | Tender closes next week, need specs by Friday | 유효(놓칠 뻔한 리드) | 유효 → S Medical Pte (이력 적음 표시) | |

구성: 유효 7, 애매 4, 국가 확인 3, 무효 16. 국가 11곳, 실제 기관 23건, 가상 기관·소속 없음 7건.

## 판정 규칙에 주는 영향 (Cap 참고)

- 도메인 대조는 사이트 도메인만으로는 안 된다. Cleveland Clinic(사이트 clevelandclinic.org, 메일 ccf.org), Royal Melbourne(thermh.org.au / mh.org.au), Guy's and St Thomas'(guysandstthomas.nhs.uk / gstt.nhs.uk), Toyota(global.toyota / mail.toyota.co.jp), 세브란스 계열(severance.healthcare / yuhs.ac).
  - 제안: 검색 결과 본문·URL에 나온 모든 도메인을 후보로 두고 이메일 도메인이 그중 하나와 같거나 그 하위 도메인이면 일치. 그래도 못 찾으면 "도메인 확인 못 함"으로 애매.
  - 설정에 **기관 도메인 별칭**(기관명 → 알려진 도메인)을 두어 담당자가 한 번 고치면 다음부터 맞게 한다.
- 이메일 도메인이 기관 도메인의 하위 도메인이면 일치로 본다(예: mail.toyota.co.jp, h.u-tokyo.ac.jp).
- 리드 국가에 딜러가 없으면 "딜러 없음 → 담당자 직접 처리"(L07).
- 이력 적은 딜러만 있는 나라는 그 딜러를 추천하되 "이력 적음"을 표시한다(L06).

## HJ에게 부탁

"HJ 정답" 칸에 유효 / 애매 / 국가 확인 / 무효와 넘길 딜러를 적어 주세요. Tony 제안과 같으면 "같음"만 적어도 된다. 특히 볼 것:

- L04(연구소, 병원 아님): 유효로 봐도 되나
- L11(자동차 회사 + 사내 진료소 구매 의도): 애매가 맞나
- L23(제약사지만 제휴 제안): 무효가 맞나
- L06(신규 딜러만 있는 나라): 이력 적은 딜러에게 넘기는 게 맞나, 담당자 직접 처리가 맞나

## 출처 (도메인 확인, 2026-11-18)

국내
- 서울대학교병원 snuh.org: https://www.snuh.org/global/en/main.do
- 세브란스 계열 이메일 yuhs.ac: https://sev.severance.healthcare/sev/story/donate/info.do
- 삼성서울병원: https://www.samsunghospital.com
- 서울아산병원 amc.seoul.kr: http://www.amc.seoul.kr/asan/main.do
- 현대자동차 hyundai.com: https://www.hyundai.com/kr/ko/e
- 연세대학교 yonsei.ac.kr: https://www.yonsei.ac.kr

해외
- The University of Tokyo Hospital h.u-tokyo.ac.jp(이메일 부분 확인): https://www.h.u-tokyo.ac.jp/english/
- Cleveland Clinic ccf.org: https://my.clevelandclinic.org/about-cleveland-clinic/about-this-website/privacy-security
- Guy's and St Thomas' gstt.nhs.uk: https://www.guysandstthomas.nhs.uk/contact-us
- The Royal Melbourne Hospital mh.org.au: https://www.thermh.org.au/contact
- Vinmec vinmec.com: https://www.vinmec.com/eng/contact-us
- Fraunhofer fraunhofer.de: https://fraunhofer.de/en/contact-headquarters/contact-press.html
- Pfizer pfizer.com(이메일 표기는 공식 페이지에서 못 봄): https://www.pfizer.com/contact
- MIT mit.edu: https://news.mit.edu/contact
- The University of Tokyo u-tokyo.ac.jp(하위 도메인 다수): https://www.t.u-tokyo.ac.jp/en/about/info/contact/publicity
- Toyota mail.toyota.co.jp: https://global.toyota/en/privacy-notice/
- HSBC hsbc.com: https://www.hsbc.com/news-and-media/media-contacts
- Karolinska University Hospital: https://www.karolinska.se/om-oss/kontakta-oss/
- Apollo Hospitals apollohospitals.com: https://www.apollohospitals.com/region/chennai/contact-us/
- Mayo Clinic: https://www.mayoclinic.org/about-mayo-clinic/contact
- Charité charite.de: https://www.charite.de/en/
- Singapore General Hospital sgh.com.sg: https://www.sgh.com.sg

실제 판정은 Liner 검색으로 다시 확인한다(Issue #26).
