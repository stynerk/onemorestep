# 저장 검색에서 소속 기관을 찾지 못한 리드 검증

2026-11-19 04:55~04:56 KST에 가상 리드의 기관명과 국가·업종 키워드만 Liner Search API에 전송했다. 기관당 2회, 총 10회가 모두 HTTP 200이었다. 질의별 상위 3개 제목·설명·링크를 검토했다. 요청 설정은 질의별 8초, 동시 최대 2회, 자동 재시도 없음, `max_results=3`, `include_knowledge=false`다.

| 리드 | 기관명 | 국가 질의의 국가 키워드 | 언어 / 지역 | 검색 완료 UTC | 상위 결과에서 제외한 예 |
| --- | --- | --- | --- | --- | --- |
| L17 | asdf | Brazil | pt / br | 2026-11-18 19:55:59.773 | [ASDF 사전 항목](https://dictionary.reverso.net/english-portuguese/ASDF), [버전 관리 도구](https://asdf-vm.com/guide/getting-started.html), [별개 의료 논문](https://www.scielo.br/j/bor/a/3KfdsM8BsDkcdY7tHFPmr9N/) |
| L18 | Zxq Medical Group | United Arab Emirates | en / ae | 2026-11-18 19:56:02.981 | [Yasmed Group](https://yasmedgroup.com/), [Dubai Dental Hospital](https://dubaihealth.ae/facility/ambulatory-health-center/dental-hospital) |
| L19 | Mirinae Demo Clinic | Vietnam | en / vn | 2026-11-18 19:56:05.477 | [Muse Clinic](https://museclinic.vn/en/), [별개 이동 치과 논문](https://pmc.ncbi.nlm.nih.gov/articles/PMC12149995/) |
| L20 | Sakura Test Hospital | Japan | ja / jp | 2026-11-18 19:56:08.212 | [다른 의료기관의 Sakura 검진 프로그램](https://j-medical-healthcare.com/en/search-treatment/detail/2962/), [Showa Medical University](https://www.showa-u.ac.jp/en/research/dent.html) |
| L27 | Dentra Imaging | Germany | en / de | 2026-11-18 19:56:12.737 | [다른 방사선 영상 진료소](https://www.die-radiologie.de/en/locations/overview), [Dentra 부분 일치](https://dentra.it/security), [별개 의료 영상 사례](https://medical.sectra.com/case/dental-radiology-is-following-the-enterprise-imaging-trend/) |

업종 질의에는 기관명 뒤에 `hospital clinic dental research institute medical devices`를 붙였다. 일본어 질의에는 `病院 歯科 研究所 医療機器`를 붙였다.

두 질의 모두 결과를 3개씩 반환했다. 다섯 기관 모두 일치 기관을 뒷받침하는 결과는 없었다. 단어가 일치하는 L17의 사전 항목과 버전 관리 도구는 기관 근거에서 제외했다. L27의 Dentra 페이지는 기관 전체 이름이나 해당 독일 기관의 소속 근거가 확인되지 않았다. 위 링크는 검토 기록에만 두고 리드의 기관 출처로 표시하지 않는다.

저장 모드는 일치하는 기관명·국가에 조회 완료 시각과 수동 검토 결과를 재사용한다. 이 관찰은 당시 상위 결과의 범위에 한정된다. 원시 검색 결과를 그대로 사용하는 실시간 자동 경로에서는 다른 결과가 나올 수 있다.
