# 평가 세트 (홀드아웃 70건)

작성: 서비스PM Tony, 2026-11-19. 상태: HJ 블라인드 라벨링 전. 기준: DECISIONS 2026-11-19 "정답셋에 평가 전용 세트를 더한다".

시연용 30건(`DEMO_DATA.md`)과 따로, 판정 엔진의 실제 성능을 재기 위한 세트다. 시연 30건은 판정 규칙과 함께 설계해 엔진이 맞히기 쉬울 수 있다. 이 70건은 정답을 **HJ가 Tony 제안 없이** 매기고, 엔진 개발에는 리드 입력만 쓴다.

## 지키는 것

- 이 파일에는 Tony의 설계 의도나 제안 정답을 적지 않는다. HJ가 실무자 눈으로 처음 보는 리드처럼 판단한다.
- 정답이 채워지면 Cap에게는 리드 입력(ID~메모)만 넘기고, 정답 칸은 평가 전용 파일로 분리한다(#28과 같은 방식). 판정 규칙은 이 세트를 보고 고치지 않는다. 고치면 그 뒤 결과는 "평가 세트 기준"으로 내세우지 않는다.
- 기관 이름과 도메인은 실제 공개 정보(아래 "출처", 2026-11-19 확인), 인물·이메일 앞부분·전화는 가상이다. 가상 기관은 예약 도메인(`.test`, `example.com`)을 쓴다.
- 정책 파일의 기관 도메인 별칭은 이 세트를 위해 추가하지 않는다. 실무에서 처음 들어온 기관과 같은 조건이다.
- 측정: `MVP.md` "일치율 산출"과 같은 식. 결과는 시연 30건과 나눠 "평가 세트 기준"으로 밝힌다(#32).

## HJ에게 부탁 (약 40분)

"HJ 정답"에 다섯 가지 중 하나를 적어 주세요: **유효 / 애매 / 국가 확인 / 제휴 확인 / 무효**. 유효면 "넘길 곳"에 딜러 이름(대한민국 A Medical·D Medi, 일본 J Medica, 미국 U Health Supply·V MedSource, 독일 E Medtech GmbH, 싱가포르 S Medical Pte) 또는 "지역 담당자 직접"·"지역 담당자 확인"을 적어 주세요. 딜러 이력은 `DEMO_DATA.md` 표와 같습니다. 무효면 짧은 이유(예: 영업, 학생, 사칭)를 적어 주시면 좋습니다. 확신이 없으면 "?"를 붙여 주세요.

## 리드 70건 (접수 순)

| ID | 소속 | 이메일 | 리드 국가 | 상품 | 메모 | HJ 정답 | 넘길 곳 |
|---|---|---|---|---|---|---|---|
| E01 | BASF SE | mrn-eval-01@basf.com | 독일 | PM-50 | We supply specialty polymers for medical device housings. Could we present our portfolio? | | |
| E02 | 분당서울대학교병원 | mrn-eval-02@snubh.org | 대한민국 | PM-50 | 응급실 환자 모니터 8대 증설 검토 중입니다. 견적 부탁드립니다 | | |
| E03 | (빈칸) | mrn-eval-03@example.com | 미국 | PM-50 | test | | |
| E04 | NYU Langone Health | mrn-eval-04@nyulangone.org | 미국 | PM-50 | Evaluating patient monitors for 20 ICU beds, please send pricing | | |
| E05 | Northbridge Medical Center | mrn-eval-05@northbridge-med.test | 미국 | US-200 | We are expanding our imaging department and want a quote for 4 units | | |
| E06 | University of Oxford | mrn-eval-06@ox.ac.uk | 영국 | US-200 | I'm writing my dissertation on the ultrasound market. Could you share your sales figures? | | |
| E07 | Kyoto University Hospital | mrn-eval-07@kuhp.kyoto-u.ac.jp | 일본 | US-200 | 研究用モードの仕様と見積もりをお願いします | | |
| E08 | Johns Hopkins Hospital | mrn-eval-08@hopkins-medicine-procure.test | 미국 | PM-50 | Urgent bulk order of 30 monitors. Wire transfer ready, reply to this address only | | |
| E09 | National Cancer Center Korea (국립암센터) | mrn-eval-09@ncc.re.kr | 대한민국 | PM-50 | | | |
| E10 | Roche | mrn-eval-10@roche.com | 스위스 | US-200 | We'd like to discuss a joint clinical study partnership | | |
| E11 | Siemens AG | mrn-eval-11@siemens.com | 독일 | PM-50 | Für unseren betriebsärztlichen Dienst benötigen wir 2 Monitore. Bitte um ein Angebot | | |
| E12 | Han River Women's Clinic | mrn-eval-12@hanriver-clinic.test | 대한민국 | US-200 | 산부인과 초음파 1대 구매 예정, 가격 알려 주세요 | | |
| E13 | Philips | mrn-eval-13@philips.com | 네덜란드 | PM-50 | Please send your full product brochure and price list for comparison | | |
| E14 | St. Luke's International Hospital | mrn-eval-14@luke.ac.jp | 대한민국 | PM-50 | Interested in a quotation for 6 monitors | | |
| E15 | Lion City Dental Group | mrn-eval-15@lcdg.test | 싱가포르 | IS-3 | Looking to equip 3 new clinics with intraoral scanners | | |
| E16 | Stanford Health Care | mrn-eval-16@stanfordhealthcare.org | 미국 | US-200 | Procurement review next month, need a quote and lead time | | |
| E17 | RIKEN | mrn-eval-17@riken.jp | 일본 | PM-50 | Applying for a sales position in Japan. Is there an opening? | | |
| E18 | University College London Hospitals | mrn-eval-18@nhs.net | 영국 | US-200 | Can you send a brochure? | | |
| E19 | Winner Notice | mrn-eval-19@example.com | 인도 | PM-50 | Congratulations! You have been selected. Click the link to claim | | |
| E20 | Heidelberg University Hospital | mrn-eval-20@med.uni-heidelberg.de | 독일 | PM-50 | Angebot für 5 Monitore für die Intensivstation erbeten | | |
| E21 | NYU Langone Health | mrn-eval-21@nyulangone-health.test | 미국 | US-200 | Large order, payment in advance, please confirm quickly | | |
| E22 | KAIST (한국과학기술원) | mrn-eval-22@kaist.ac.kr | 대한민국 | US-200 | 졸업 과제로 초음파 원리 자료가 필요합니다 | | |
| E23 | Osaka Bay Heart Institute | mrn-eval-23@obhi.test | 일본 | PM-50 | 心臓血管センターのモニター更新を検討しています | | |
| E24 | LG Electronics (LG전자) | mrn-eval-24@lge.com | 대한민국 | PM-50 | 의료용 디스플레이 공동 개발 협업을 제안드립니다 | | |
| E25 | Hitachi, Ltd. | mrn-eval-25@hitachi.com | 일본 | PM-50 | 社内診療所向けに1台検討中です | | |
| E26 | Nestlé S.A. | mrn-eval-26@nestle.com | 스위스 | PM-50 | We offer corporate wellness catering for your offices | | |
| E27 | Royal Prince Alfred Hospital | mrn-eval-27@gmail.com | 호주 | PM-50 | price list? | | |
| E28 | Stanford Health Care | mrn-eval-28@nyulangone.org | 미국 | PM-50 | Need 10 monitors ASAP, send invoice | | |
| E29 | University of Toronto | mrn-eval-29@utoronto.ca | 독일 | US-200 | Please send pricing for 3 research units | | |
| E30 | Kestrel Monitoring | mrn-eval-30@kestrel.example.com | 독일 | PM-50 | Requesting technical specifications of your monitor line | | |
| E31 | National University Hospital | mrn-eval-31@nuhs.edu.sg | 싱가포르 | US-200 | Tender for point-of-care ultrasound closes in two weeks, please share specs | | |
| E32 | N/A | mrn-eval-32@example.com | 영국 | IS-3 | hello | | |
| E33 | Mount Sinai Health System | mrn-eval-33@mountsinai-purchasing.test | 미국 | US-200 | Urgent purchase, our usual vendor is unavailable, reply here | | |
| E34 | Siemens Healthineers | mrn-eval-34@siemens-healthineers.com | 독일 | US-200 | Market research: comparing ultrasound portfolios, please send datasheets | | |
| E35 | Hospital Israelita Albert Einstein | mrn-eval-35@einstein.br | 브라질 | PM-50 | Sou estudante de enfermagem e preciso de material para meu TCC | | |
| E36 | Rheinland Diagnostik Zentrum | mrn-eval-36@rdz.test | 독일 | US-200 | Wir planen die Anschaffung von zwei Geräten | | |
| E37 | RIKEN | mrn-eval-37@riken.jp | 일본 | US-200 | Research-use ultrasound for small animal imaging, quotation please | | |
| E38 | Seoul St. Mary's Hospital (서울성모병원) | mrn-eval-38@naver.com | 대한민국 | US-200 | 가격 문의 | | |
| E39 | Novartis | mrn-eval-39@novartis.com | 스위스 | PM-50 | We offer clinical trial site management services. Can we schedule a call? | | |
| E40 | Kyoto University Hospital | mrn-eval-40@kyoto-hosp.test | 일본 | PM-50 | 至急20台注文したい。前払い可能、このアドレスにのみ返信してください | | |
| E41 | Great Ormond Street Hospital | mrn-eval-41@gosh.nhs.uk | 영국 | PM-50 | Information only | | |
| E42 | Medtronic | mrn-eval-42@medtronic.com | 미국 | PM-50 | I'm interested in your quality engineer opening | | |
| E43 | Sunrise Health Network | mrn-eval-43@sunrise-health.test | 호주 | PM-50 | Planning to buy monitors for 4 regional clinics | | |
| E44 | Johns Hopkins Hospital | mrn-eval-44@jhmi.edu | 미국 | US-200 | Our department plans to purchase two units this fiscal year | | |
| E45 | Institut Pasteur | mrn-eval-45@pasteur.fr | 싱가포르 | US-200 | Lab procurement, please send a quote | | |
| E46 | qwerty | mrn-eval-46@example.com | 브라질 | US-200 | qwerty | | |
| E47 | Olympus Corporation | mrn-eval-47@olympus.com | 일본 | US-200 | 御社製品の比較資料をいただけますか | | |
| E48 | Maple Valley Hospital | mrn-eval-48@maplevalley.test | 캐나다 | PM-50 | Replacing monitors in our emergency department | | |
| E49 | Max Planck Society | mrn-eval-49@gv.mpg.de | 독일 | US-200 | One of our institutes is considering a purchase, please send specifications and price | | |
| E50 | A*STAR | mrn-eval-50@a-star.edu.sg | 싱가포르 | US-200 | Exploring a co-development collaboration on imaging AI | | |
| E51 | Stanford Health Care | mrn-eval-51@stanford-health-orders.test | 미국 | PM-50 | Please process our order today, details attached | | |
| E52 | University of Toronto | mrn-eval-52@utoronto.ca | 캐나다 | PM-50 | Course project: could you send device specifications? | | |
| E53 | Robert Bosch GmbH | mrn-eval-53@de.bosch.com | 독일 | PM-50 | Wir bieten Sensorkomponenten für Ihre Geräte an | | |
| E54 | Max Planck Society | mrn-eval-54@roche.com | 독일 | US-200 | Quote needed for our institute | | |
| E55 | Great Ormond Street Hospital | mrn-eval-55@gosh.nhs.uk | 영국 | PM-50 | I'm a nursing student writing a report on monitoring devices | | |
| E56 | The Alfred (Alfred Health) | mrn-eval-56@alfred.org.au | 호주 | IS-3 | Do you have a dental scanner demo in Melbourne? | | |
| E57 | Clínica Atlântica | mrn-eval-57@atlantica.test | 브라질 | IS-3 | Queremos comprar dois scanners intraorais | | |
| E58 | KAIST (한국과학기술원) | mrn-eval-58@kaist.ac.kr | 대한민국 | US-200 | 연구실 장비 구매 검토 중입니다. 연구용 모드 포함 견적 요청드립니다 | | |
| E59 | Home | mrn-eval-59@example.com | 미국 | PM-50 | for my dad | | |
| E60 | Weizmann Institute of Science | mrn-eval-60@weizmann.ac.il | 미국 | US-200 | Need a quote for research ultrasound | | |
| E61 | National University Hospital | mrn-eval-61@nuh-sg-procurement.test | 싱가포르 | PM-50 | Bulk order, advance payment, contact this email only | | |
| E62 | Sonora Medical Imaging | mrn-eval-62@sonora.example.com | 미국 | US-200 | Could you share your distributor pricing structure? | | |
| E63 | Hospital Israelita Albert Einstein | mrn-eval-63@einstein.br | 브라질 | US-200 | Gostaria de saber mais | | |
| E64 | Kyungpook National University Hospital (경북대학교병원) | mrn-eval-64@knuh.kr | 대한민국 | US-200 | 초음파 교체 예산이 확보됐습니다. 데모 요청드립니다 | | |
| E65 | Gulf Pearl Hospital | mrn-eval-65@gpearl.test | 아랍에미리트 | PM-50 | We need 12 monitors for our new wing | | |
| E66 | University Health Network | mrn-eval-66@uhn.ca | 캐나다 | US-200 | Looking for a clinical application specialist job | | |
| E67 | Self | mrn-eval-67@example.com | 대한민국 | PM-50 | 가격만 궁금해요 | | |
| E68 | asdfgh | mrn-eval-68@example.com | 멕시코 | IS-3 | asdfgh | | |
| E69 | Mount Sinai Health System | mrn-eval-69@mssm.edu | 미국 | PM-50 | Replacing step-down unit monitors, please arrange a call with sales | | |
| E70 | Verified Lead Supply | mrn-eval-70@leadsupply.example.com | 미국 | PM-50 | We sell verified hospital procurement lead lists. Interested? | | |

## 출처 (도메인 확인, 2026-11-19)

researcher 조사. A는 기관 공식 페이지를 직접 열어 확인, B는 공식 페이지 내용을 검색 결과로 확인.

| 기관 | 사이트 도메인 | 이메일 도메인 | 출처 | 정도 |
|---|---|---|---|---|
| 분당서울대학교병원 | snubh.org | 같음 | https://www.snubh.org/member/privacy.do | A |
| 경북대학교병원 | knuh.kr | 같음 | https://knuh.kr (개인정보 처리방침) | B |
| 국립암센터 | ncc.re.kr | 같음 | https://www.ncc.re.kr/main.ncc?uri=my_privacy | A |
| 서울성모병원 | cmcseoul.or.kr | 확인 못 함(이 세트에서는 무료 메일로만 씀) | - | - |
| Kyoto University Hospital | kuhp.kyoto-u.ac.jp | 같음 | https://www.kuhp.kyoto-u.ac.jp/english/access/ | A |
| St. Luke's International Hospital | hospital.luke.ac.jp | luke.ac.jp | 병원 영문 사이트 국제부 연락처 | B |
| Johns Hopkins Medicine | hopkinsmedicine.org | jhmi.edu | https://hopkinsmedicine.org/news/newsroom/contact-media-relations | B |
| NYU Langone Health | nyulangone.org | 같음 | https://nyulangone.org/news/media-contacts | A |
| Stanford Health Care | stanfordhealthcare.org | 같음 | https://stanfordhealthcare.org/newsroom/contact/media-contacts.html | A |
| Mount Sinai | mountsinai.org | mssm.edu | https://icahn.mssm.edu/about/faculty-resources/handbook/institutional/press | A |
| Heidelberg University Hospital | klinikum.uni-heidelberg.de | med.uni-heidelberg.de | https://www.klinikum.uni-heidelberg.de/impressum | A |
| National University Hospital | nuh.com.sg | nuhs.edu.sg | https://www.nuh.com.sg/contact-us | A |
| Royal Prince Alfred Hospital | slhd.nsw.gov.au | health.nsw.gov.au | https://www.slhd.nsw.gov.au/RPA/research/Contact.html | A |
| The Alfred | alfredhealth.org.au | alfred.org.au | https://www.alfredhealth.org.au/media-centre/media-resources | A |
| Great Ormond Street Hospital | gosh.nhs.uk | 같음 | https://www.gosh.nhs.uk/press-office/ | A |
| UCLH | uclh.nhs.uk | nhs.net | https://www.uclh.nhs.uk/about-us/what-we-do/media-and-communications/media-enquiries | B |
| University Health Network | uhn.ca | 같음 | https://www.uhn.ca/corporate/News/Pages/media_contacts.aspx | A |
| Hospital Israelita Albert Einstein | einstein.br | 같음 | https://www.einstein.br/n/en/einstein/legal-information/privacy-data-protection | B |
| University of Oxford | ox.ac.uk | admin.ox.ac.uk 등 하위 도메인 | https://www.ox.ac.uk/public-affairs/contact | B |
| University of Toronto | utoronto.ca | 같음 | https://president.utoronto.ca/contact-us/ | A |
| KAIST | kaist.ac.kr | 같음 | https://kds.kaist.ac.kr/dormInfo/dormContact.do | B |
| Max Planck Society | mpg.de | gv.mpg.de | https://www.mpg.de/en/contact/communication | A |
| Institut Pasteur | pasteur.fr | 같음 | https://www.pasteur.fr/en/institut-pasteur/press/press-documents | B |
| RIKEN | riken.jp | 같음 | https://www.riken.jp/en/news_pubs/press_center/ | A |
| Weizmann Institute of Science | weizmann.ac.il | 같음 | https://www.weizmann.ac.il/pages/contact-us | B |
| A*STAR | a-star.edu.sg | 같음 | a-star.edu.sg 보도자료 미디어 연락처 | B |
| Siemens AG | siemens.com | 같음 | https://www.siemens.com/en-us/contact/press-contacts | A |
| Robert Bosch GmbH | bosch.com | de.bosch.com 등 | https://bosch-presse.de/pressportal/de/en/contact.html | A |
| BASF SE | basf.com | 같음 | https://www.basf.com/global/en/media/contact.html | A |
| Nestlé S.A. | nestle.com | 같음 | https://www.nestle.com/media/media-contacts/nestle-group | A |
| Hitachi, Ltd. | hitachi.com | 같음 | https://www.hitachi.com/en-us/contact/ | A |
| LG Electronics | lg.com | lge.com | https://www.lg.com/us/press-release/lg-electronics-ai-and-iot-innovations-transforming-accessibility-opportunities | A |
| Medtronic | medtronic.com | 같음 | https://news.medtronic.com/contacts | A |
| Roche | roche.com | 같음 | https://www.roche.com/contact/media-contacts | A |
| Novartis | novartis.com | 같음 | https://novartis.com/contacts/media-contacts | A |
| Philips | philips.com | 같음 | https://www.philips.com/a-w/about/news-and-insights/media-contacts.html | A |
| Siemens Healthineers | siemens-healthineers.com | 같음 | https://www.siemens-healthineers.com/press-room/presscontact | A |
| Olympus Corporation | olympus-global.com | olympus.com | https://www.olympusamerica.com/news-media | A |
