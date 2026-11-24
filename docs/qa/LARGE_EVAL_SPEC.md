# 1000건 보조 평가 — 세트 생성 명세 (Issue #135)

작성: 서비스PM Tony, 2026-11-25. HJ 결정: 1000건, 정답은 Gemini, 언어에 프랑스어 추가, 호출 여유 있음.

이 문서는 **리드 입력을 만드는 규칙**이다. 아래의 "생성 의도"는 정답이 아니다. 정답은 Gemini가 리드 입력과 라벨링 지침만 보고 매긴다(엔진 결과·생성 의도는 주지 않는다). 보고서에는 Gemini 정답 기준 결과를 쓰고, 참고로 생성 의도와 Gemini 정답의 일치율도 싣는다.

## 1. 규칙

- 시드 `20261125`로 결정적으로 생성하고, 생성 스크립트와 결과 파일(`docs/qa/large-eval/leads.csv`)을 저장소에 남긴다.
- ID `G0001`~`G1000`. 이메일 로컬 부분 `mrn-lg-0001` 형식(실제 사람 주소처럼 보이지 않게).
- 상품: PM-50, US-200, IS-3 중 무작위(IS-3는 치과·구강 관련 메모에만).
- 실제 기관은 **아래 2절 표의 기관과 이메일 도메인만** 쓴다(공식 출처로 확인된 것). 표에 없는 실제 기관 이름을 새로 만들지 않는다.
- 가상 기관은 `.test` 또는 `example.com`/`*.example.com` 도메인만 쓴다.
- 엔진 코드·프롬프트를 이 세트에 맞춰 바꾸지 않는다.

## 2. 실제 기관 풀 (이메일 도메인 확인됨)

| 기관 | 국가 | 이메일 도메인 | 성격 |
|---|---|---|---|
| 서울대학교병원 | 대한민국 | snuh.org | 병원 |
| 분당서울대학교병원 | 대한민국 | snubh.org | 병원 |
| 강남세브란스병원 | 대한민국 | yuhs.ac | 병원 |
| 아주대학교병원 | 대한민국 | aumc.ac.kr | 병원 |
| 전남대학교병원 | 대한민국 | cnuh.com | 병원 |
| 경북대학교병원 | 대한민국 | knuh.kr | 병원 |
| 한림대학교의료원 | 대한민국 | hallym.or.kr | 병원 |
| 국립암센터 | 대한민국 | ncc.re.kr | 병원·연구 |
| KAIST | 대한민국 | kaist.ac.kr | 대학·연구 |
| 포항공과대학교 (POSTECH) | 대한민국 | postech.ac.kr | 대학·연구 |
| 연세대학교 | 대한민국 | yonsei.ac.kr | 대학 |
| 한국지능정보사회진흥원 (NIA) | 대한민국 | nia.or.kr | 공공기관 |
| 현대자동차 | 대한민국 | hyundai.com | 기업 |
| LG Electronics | 대한민국 | lge.com | 기업 |
| 카카오 | 대한민국 | kakaocorp.com | 기업 |
| The University of Tokyo Hospital | 일본 | h.u-tokyo.ac.jp | 병원 |
| Kyoto University Hospital | 일본 | kuhp.kyoto-u.ac.jp | 병원 |
| Tohoku University Hospital | 일본 | grp.tohoku.ac.jp | 병원 |
| Kyushu University Hospital | 일본 | jimu.kyushu-u.ac.jp | 병원 |
| St. Luke's International Hospital | 일본 | luke.ac.jp | 병원 |
| RIKEN | 일본 | riken.jp | 연구 |
| The University of Tokyo | 일본 | u-tokyo.ac.jp | 대학 |
| Toyota Motor Corporation | 일본 | mail.toyota.co.jp | 기업 |
| Hitachi, Ltd. | 일본 | hitachi.com | 기업 |
| Olympus Corporation | 일본 | olympus.com | 기업(의료기기) |
| Cleveland Clinic | 미국 | ccf.org | 병원 |
| Johns Hopkins Hospital | 미국 | jhmi.edu | 병원 |
| NYU Langone Health | 미국 | nyulangone.org | 병원 |
| Stanford Health Care | 미국 | stanfordhealthcare.org | 병원 |
| Mount Sinai Health System | 미국 | mssm.edu | 병원 |
| UCSF Health | 미국 | ucsf.edu | 병원 |
| Houston Methodist | 미국 | houstonmethodist.org | 병원 |
| Massachusetts Institute of Technology | 미국 | mit.edu | 대학 |
| Pfizer | 미국 | pfizer.com | 기업(제약) |
| Medtronic | 미국 | medtronic.com | 기업(의료기기) |
| University of Toronto | 캐나다 | utoronto.ca | 대학 |
| University Health Network | 캐나다 | uhn.ca | 병원 |
| McGill University Health Centre | 캐나다 | muhc.mcgill.ca | 병원 |
| Guy's and St Thomas' NHS Foundation Trust | 영국 | gstt.nhs.uk | 병원 |
| Great Ormond Street Hospital | 영국 | gosh.nhs.uk | 병원 |
| Cambridge University Hospitals NHS Foundation Trust | 영국 | nhs.net | 병원(NHS 공용 도메인) |
| University of Oxford | 영국 | ox.ac.uk | 대학 |
| Office for National Statistics | 영국 | ons.gov.uk | 정부기관 |
| HSBC | 영국 | hsbc.com | 기업(금융) |
| Charité – Universitätsmedizin Berlin | 독일 | charite.de | 병원 |
| Heidelberg University Hospital | 독일 | med.uni-heidelberg.de | 병원 |
| Universitätsklinikum Hamburg-Eppendorf | 독일 | uke.de | 병원 |
| Fraunhofer-Gesellschaft | 독일 | fraunhofer.de | 연구 |
| Max Planck Society | 독일 | gv.mpg.de | 연구 |
| EMBL | 독일 | embl.de | 연구 |
| Siemens AG | 독일 | siemens.com | 기업 |
| Siemens Healthineers | 독일 | siemens-healthineers.com | 기업(의료기기) |
| BASF SE | 독일 | basf.com | 기업(화학) |
| Robert Bosch GmbH | 독일 | de.bosch.com | 기업 |
| Hospices Civils de Lyon | 프랑스 | chu-lyon.fr | 병원 |
| Gustave Roussy | 프랑스 | gustaveroussy.fr | 병원·연구 |
| CHU de Bordeaux | 프랑스 | chu-bordeaux.fr | 병원 |
| Institut Pasteur | 프랑스 | pasteur.fr | 연구 |
| CHUV (Centre hospitalier universitaire vaudois) | 스위스 | chuv.ch | 병원(프랑스어권) |
| Hôpitaux Universitaires de Genève (HUG) | 스위스 | hug.ch | 병원(프랑스어권) |
| ETH Zürich | 스위스 | hk.ethz.ch | 대학 |
| Roche | 스위스 | roche.com | 기업(제약) |
| Novartis | 스위스 | novartis.com | 기업(제약) |
| Nestlé S.A. | 스위스 | nestle.com | 기업(식품) |
| Philips | 네덜란드 | philips.com | 기업(의료기기) |
| Hospital Clínic de Barcelona | 스페인 | clinic.cat | 병원(사이트와 메일 도메인 다름) |
| Fundación Santa Fe de Bogotá | 콜롬비아 | fsfb.org.co | 병원(사이트와 메일 도메인 다름) |
| Hospital Israelita Albert Einstein | 브라질 | einstein.br | 병원 |
| Singapore General Hospital | 싱가포르 | sgh.com.sg | 병원 |
| National University Hospital | 싱가포르 | nuhs.edu.sg | 병원 |
| A*STAR | 싱가포르 | a-star.edu.sg | 연구 |
| The Royal Melbourne Hospital | 호주 | mh.org.au | 병원 |
| The Royal Children's Hospital Melbourne | 호주 | rch.org.au | 병원 |
| The Alfred (Alfred Health) | 호주 | alfred.org.au | 병원 |
| CSIRO | 호주 | csiro.au | 연구 |
| Vinmec International Hospital | 베트남 | vinmec.com | 병원 |
| Apollo Hospitals | 인도 | apollohospitals.com | 병원 |
| Weizmann Institute of Science | 이스라엘 | weizmann.ac.il | 연구 |

출처: 시연 30건(`DEMO_DATA.md`), 평가 70건(`EVAL_DATA.md`), 새 블라인드 30건(11-21 researcher 조사), 프랑스어·스페인어권 8곳(11-25 researcher 조사: HCL·Gustave Roussy·CHU de Bordeaux·CHUV·HUG·Clínic·FSFB 확인, AP-HP·La Paz는 제외).

## 3. 구성 (생성 의도, 1000건)

| 유형 | 건수 | 만드는 법 |
|---|---|---|
| A. 실제 기관, 공식 메일, 구매 문의, 국가 일치 | 300 | 2절 기관 + 공식 도메인 + 기관 국가 = 리드 국가 + 구매 메모 |
| B. 실제 기관, 공식 메일, 의도가 약함 | 50 | 2절 기관 + "자료만", "참고용", "가격?" 같은 짧은 메모 |
| C. 실제 기관, 무료 메일 | 150 | 2절 기관 + gmail.com / naver.com / yahoo.co.jp / outlook.com / gmx.de / orange.fr / hotmail.es + 구매 메모 |
| D. 사칭: 실제 기관 이름 + 닮은꼴 도메인 | 70 | `기관약어-procurement.test`, `기관명-hospital.test`, `기관-mail.test` 등 + 급한 주문·선입금·"이 주소로만 회신" 메모 |
| E. 사칭: 실제 기관 이름 + 다른 실제 기관 도메인 | 30 | 2절의 다른 기관 도메인 + 송장·당일 결제 메모 |
| F. 가상 기관 | 100 | 아래 4절 가상 이름 + `.test`/`example.com` 도메인 + 구매 메모(그럴듯하게) |
| G. 국가 불일치 | 100 | 2절 기관 + 공식 도메인 + 리드 국가를 기관 국가와 다르게 + 구매 메모 |
| H. 제휴·협업·정부 협조 | 50 | 2절 기업·연구·공공기관 + 협업·공동연구·설문·통계 협조 메모 |
| I. 채용 문의 | 30 | 2절 기관 + 지원·채용 메모 |
| J. 학생 개인 과제·논문 | 40 | 2절 대학·병원 + 과제·논문 자료 메모 |
| K. 영업 제안(우리에게 파는 것) | 30 | 2절 기업 + 서비스·소재·금융 제안 메모 |
| L. 스팸·소속 없음·무의미 | 50 | 빈칸·"N/A"·"Individual"·"asdf" + example.com + 스팸·"hi"·"test" 메모 |

같은 기관이 여러 번 나와도 된다(검색 캐시로 호출 절약). 한 기관이 A·C·D·G에 함께 나오는 조합을 일부러 섞는다.

## 4. 언어 (메모 언어)

한국어 20%, 영어 35%, 일본어 10%, 독일어 10%, **프랑스어 15%**, 스페인어 10%. 기관 국가와 자연스럽게 맞추되(프랑스·스위스 프랑스어권 → 프랑스어, 스페인·콜롬비아 → 스페인어), 영어 메모는 모든 국가에 쓴다. 가상 기관 이름도 언어에 맞춘다.

가상 기관 이름 예(유형 F, 필요한 만큼 조합): Clinique du Lac Bleu, Centre Médical Saint-Aubin, Hôpital des Trois Rivières, Laboratoire Vernet Santé, Clínica Sol Andino, Hospital San Rafael del Valle, Centro Médico Bahía Clara, Rheinland Diagnostik Zentrum, Klinikum Nordheide, Northbridge Medical Center, Bluewater Regional Hospital, Maple Valley Hospital, Sakura Test Hospital, 하늘숲요양병원, 한강여성의원, Lion City Dental Group, Gulf Pearl Hospital.

## 5. 메모 문형 (언어별, 무작위로 숫자·제품만 바꿔 쓴다)

| 유형 | 한국어 | English | 日本語 | Deutsch | Français | Español |
|---|---|---|---|---|---|---|
| 구매 | 중환자실 모니터 {n}대 교체 예정, 견적 부탁드립니다 / 내년 예산으로 {n}대 도입 검토 중입니다 | Planning to replace {n} monitors, please send a quote / Budget approved, requesting a demo | {n}台の更新を検討中です。見積もりをお願いします | Wir benötigen ein Angebot für {n} Geräte | Nous souhaitons recevoir un devis pour {n} moniteurs / Projet de remplacement de {n} appareils, merci de nous contacter | Solicitamos una cotización para {n} monitores / Estamos evaluando la compra de {n} equipos |
| 의도 약함 | 자료만 받아 볼게요 / 참고용입니다 | For reference only / price? | 資料だけください | Nur zur Information | Pour information seulement | Solo para referencia |
| 사칭 | 급하게 {n}대 주문합니다. 선입금 가능, 이 메일로만 회신 바랍니다 | Urgent order of {n} units, wire transfer ready, reply to this address only | 至急{n}台注文します。この宛先にのみ返信ください | Dringende Bestellung, bitte nur an diese Adresse antworten | Commande urgente de {n} unités, paiement immédiat, répondez uniquement à cette adresse | Pedido urgente de {n} unidades, pago por adelantado, responda solo a este correo |
| 제휴·협조 | 플랫폼 연동 협업을 제안드립니다 | Exploring a joint research collaboration / Please complete our official statistics survey | 共同研究のご提案です | Kooperationsanfrage für ein Forschungsprojekt | Proposition de partenariat de recherche | Propuesta de colaboración en investigación |
| 채용 | 영업직 채용이 있는지 궁금합니다 | Applying for a sales position / Is there an opening for application specialists? | 営業職に応募したいです | Bewerbung als Vertriebsmitarbeiter | Je souhaite postuler à un poste commercial | Quisiera postularme a un puesto de ventas |
| 학생 | 졸업 논문 자료 요청드립니다 | Need specs for my class project | 卒業論文のために資料が欲しいです | Ich schreibe meine Bachelorarbeit | Je prépare mon mémoire de master, pourriez-vous m'envoyer de la documentation ? | Estoy haciendo mi tesis, necesito información |
| 영업 제안 | 기업 금융 서비스를 소개드리고 싶습니다 | We supply specialty polymers for device housings | 弊社サービスのご紹介です | Wir bieten Ihnen unsere Logistiklösungen an | Nous proposons nos services de conseil | Le ofrecemos nuestros servicios de marketing |
| 스팸·무의미 | test / 안녕하세요 | Get 10,000 verified leads for $99 / hi | テスト | asdf | Gagnez un iPhone ! | hola |

## 6. Gemini 라벨링 지침 (그대로 전달)

리드 입력(소속, 이메일, 리드 국가, 상품, 메모)만 보고 정답(유효/애매/국가 확인/제휴 확인/무효)과 넘길 곳을 매긴다. 기준은 `docs/team/DECISIONS.md`의 HJ 실무 기준이다:
- 실재하지 않는 기관(가상 기관)은 메모와 관계없이 **무효, 넘길 곳 없음**. `.test`·`example` 도메인은 실재 기관의 공식 메일이 아니다.
- 실제 기관 이름에 닮은꼴·다른 기관 도메인 → 사칭 의심 **애매**, 리드 국가 권역 세일즈팀.
- 무료 메일, 의도 불명 → **애매**, 권역 세일즈팀.
- 기관 소재지와 리드 국가가 다름 → **국가 확인**, 권역 세일즈팀.
- 기업·기관 단위 협업, 공동연구, 정부·공공기관 협조 요청 → **제휴 확인**, 권역 세일즈팀.
- 채용 문의 → **무효, 인사팀**. 학생 개인 과제·논문 → **무효, 없음**. 우리에게 파는 영업 제안·스팸·소속 없음 → **무효, 없음**.
- 실제 기관, 공식 메일, 구매 의도, 국가 일치 → **유효, 리드 국가 딜러**.
- 권역: 대한민국·일본·싱가포르·호주·베트남·인도 → APAC, 미국·캐나다 → NA, 독일·영국·프랑스·스위스·네덜란드·스페인·스웨덴 → EU, 브라질·멕시코·콜롬비아 → LATAM, 이스라엘·아랍에미리트 → MEA.

Gemini가 실재 여부를 모를 때는 "모름"이라고 적게 하고, 보고서에서 따로 센다.
