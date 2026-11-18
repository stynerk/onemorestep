# DEMO_DATA table snapshot

Source: PR #23, commit 1da2b587b393b4e627338fada671031965c12c41.
Only the author-provided lead and dealer rows are retained for fixture parity checks.

| A Medical | 대한민국 | 8 | 3 | 4 | 1 | 0 | 서울대학교병원과 이전 거래 |
| D Medi | 대한민국 | 6 | 1 | 2 | 0 | 3 | 강남세브란스병원과 이전 거래. 최근 응답 느림 |
| J Medica | 일본 | 7 | 3 | 3 | 1 | 0 | |
| U Health Supply | 미국 | 6 | 2 | 3 | 0 | 1 | |
| V MedSource | 미국 | 7 | 3 | 3 | 1 | 0 | |
| E Medtech GmbH | 독일 | 5 | 2 | 2 | 1 | 0 | |
| S Medical Pte | 싱가포르 | 2 | 1 | 1 | 0 | 0 | 신규 딜러, 이력 적음(3건 미만) |
| L01 | 서울대학교병원 | 실제 | mrn-demo-01@snuh.org | 대한민국 | PM-50 | 중환자실 모니터 12대 교체 예정, 견적 요청 | 유효 | 유효 → A Medical | |
| L02 | The University of Tokyo Hospital | 실제 | mrn-demo-02@h.u-tokyo.ac.jp | 일본 | US-200 | Budget approved this year, requesting a demo | 유효 | 유효 → J Medica | |
| L03 | Cleveland Clinic | 실제, 도메인 주의 | mrn-demo-03@ccf.org | 미국 | PM-50 | Replacing monitors in the new wing, decision next month | 유효 | 유효 → V MedSource (U는 미응답 1) | |
| L04 | Fraunhofer-Gesellschaft | 실제 | mrn-demo-04@fraunhofer.de | 독일 | US-200 | Our lab is evaluating ultrasound for a research project, please send a quote | 유효(병원 아님) | 유효 → E Medtech GmbH | 같음 |
| L05 | 강남세브란스병원 | 실제, 도메인 주의 | mrn-demo-05@yuhs.ac | 대한민국 | US-200 | 기존 장비 노후, 교체 견적 | 유효 | 유효 → A Medical (이전 거래 D Medi는 미응답 3) | |
| L07 | The Royal Melbourne Hospital | 실제, 도메인 주의 | mrn-demo-07@mh.org.au | 호주 | PM-50 | Planning to purchase 6 units next quarter | 유효(딜러 없음) | 유효 → 딜러 없음, 담당 APAC 직접 처리 | 같음 (HJ 결정) |
| L08 | Mayo Clinic | 실제 | mrn-demo-08@gmail.com | 미국 | US-200 | price? | 애매: 무료 메일 | 애매 → 전화 필요 | |
| L09 | Guy's and St Thomas' NHS Foundation Trust | 실제, 도메인 주의 | mrn-demo-09@gstt.nhs.uk | 영국 | PM-50 | For reference only | 애매: 의향 없음 | 애매 → 전화 필요 | |
| L10 | 삼성서울병원 | 실제 | mrn-demo-10@naver.com | 대한민국 | PM-50 | 카탈로그 요청 | 애매: 무료 메일 | 애매 → 전화 필요 | |
| L11 | Toyota Motor Corporation | 실제, 도메인 주의 | mrn-demo-11@mail.toyota.co.jp | 일본 | PM-50 | 社内診療所用に2台検討しています | 유효(업종은 참고) | 유효 → J Medica | 같음 (업종은 참고 사항) |
| L12 | Charité – Universitätsmedizin Berlin | 실제 | mrn-demo-12@charite.de | 대한민국 | PM-50 | Interested in a demo | 국가 확인 | 국가 확인 메일 → 회신 대기 | |
| L13 | Vinmec International Hospital | 실제 | mrn-demo-13@vinmec.com | 미국 | US-200 | Quotation please | 국가 확인 | 국가 확인 메일 → 회신 대기 | |
| L14 | Apollo Hospitals | 실제 | mrn-demo-14@apollohospitals.com | 일본 | PM-50 | Need pricing for 10 units | 국가 확인 | 국가 확인 메일 → 회신 대기 | |
| L15 | (빈칸) | - | mrn-demo-15@example.com | 카자흐스탄(지역 미지정) | PM-50 | test | 무효: 소속 없음 | 무효 | |
| L16 | Individual | - | mrn-demo-16@example.com | 멕시코 | IS-3 | just curious | 무효: 소속 없음 | 무효 | |
| L17 | asdf | - | mrn-demo-17@example.com | 브라질 | US-200 | asdf | 무효: 스팸 | 무효 | |
| L18 | Zxq Medical Group | 가상 | mrn-demo-18@zxq-medical.test | 아랍에미리트 | US-200 | Bulk purchase possible, contact me | 무효: 실재하지 않음 | 무효 | |
| L19 | Mirinae Demo Clinic | 가상 | mrn-demo-19@mirinae-demo.test | 베트남 | IS-3 | Considering adoption this year | 무효: 실재하지 않음(메모는 그럴듯함) | 무효 | |
| L20 | Sakura Test Hospital | 가상 | mrn-demo-20@sakura-test.test | 일본 | PM-50 | 見積もりをお願いします | 무효: 실재하지 않음 | 무효 | |
| L21 | HSBC | 실제 | mrn-demo-21@hsbc.com | 영국 | PM-50 | We'd like to offer corporate banking services | 무효: 판매·영업 | 무효 | 같음 (HJ) |
| L22 | 현대자동차 | 실제 | mrn-demo-22@hyundai.com | 대한민국 | PM-50 | 협업 제안드립니다 | 제휴 확인 | 제휴 상세 요청 메일 → 회신 대기 | 같음 (L23과 같은 규칙) |
| L23 | Pfizer | 실제 | mrn-demo-23@pfizer.com | 미국 | US-200 | Proposal for a co-marketing partnership | 제휴 확인 | 제휴 상세 요청 메일 → 회신 대기 | 같음 (HJ 결정) |
| L24 | Massachusetts Institute of Technology | 실제 | mrn-demo-24@mit.edu | 미국 | US-200 | Need specs for a class project | 무효: 학생 | 무효 | |
| L25 | 연세대학교 | 실제 | mrn-demo-25@yonsei.ac.kr | 대한민국 | US-200 | 졸업 논문 자료 요청 | 무효: 학생 | 무효 | |
| L26 | The University of Tokyo | 실제 | mrn-demo-26@u-tokyo.ac.jp | 일본 | PM-50 | Applying for a sales position | 무효: 구직 | 무효 | |
| L27 | Dentra Imaging | 가상 경쟁사 | mrn-demo-27@dentra.example.com | 독일 | IS-3 | Requesting product comparison materials | 무효: 경쟁사 | 무효 | |
| L28 | 서울아산병원 | 실제 이름, 가짜 도메인 | mrn-demo-28@asan-medical.test | 대한민국 | US-200 | 급히 견적 필요, 선입금 가능 | 무효: 사칭 의심 | 무효(도메인 불일치) | |
| L29 | Cleveland Clinic | 실제 이름, 가짜 도메인 | mrn-demo-29@clevelandclinic-mail.test | 미국 | PM-50 | Urgent order, reply to this address only | 무효: 사칭 의심 | 무효(도메인 불일치) | |
| L30 | Karolinska University Hospital | 실제 이름, 가짜 도메인 | mrn-demo-30@karolinska-hospital.test | 스웨덴 | US-200 | Large order, payment in advance | 무효: 사칭 의심 | 무효(도메인 불일치) | |
| L06 | Singapore General Hospital | 실제 | mrn-demo-06@sgh.com.sg | 싱가포르 | PM-50 | Tender closes next week, need specs by Friday | 유효(놓칠 뻔한 리드) | 유효 → 지역 담당자(담당 APAC)에게 신규 딜러 S Medical Pte 확인 요청 | 같음 (HJ 결정) |
