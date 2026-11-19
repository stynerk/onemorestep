# Liner API 검증

확인일: 2026-11-18. 공식 문서 확인, 실제 Search 호출, 주입 응답 자동 테스트를 구분한다. 키·인증 헤더·잔액 응답 본문은 기록하지 않는다.

## Search API 계약

| 항목 | 공식 문서 기준 |
|---|---|
| 엔드포인트 | `POST https://platform.liner.com/api/v1/tools/search/web` |
| 인증 | 서버의 `x-api-key`, JSON Content-Type |
| 요청 | `query` 필수, `max_results` 1~20. `lang`·`country_code`는 선택 |
| 응답 | 비스트리밍 JSON. `requestId`, `results`, `totalCount`; 결과에 `title`, `url`, `hostname`, `faviconUrl`, `description`, `date` |
| 결과 의미 | 검색 링크와 스니펫이다. 모델이 종합한 답변이나 자동 작성 인용문이 아니다. 출처 표시는 반환 URL로 구성한다 |
| 현재 앱 | 결과 중 `title`·`url`·`description`만 검증해 최대 3건 반환한다. 앱 요청의 언어·국가는 ko/kr다 |

공식 출처: [Search API](https://liner.com/developers/docs/search-api). Web Search의 프리미엄 데이터는 `include_knowledge: false`로 끈다. 현재 앱은 이를 명시한다. 공식 공개 요금은 이 조건에서 1,000회당 USD 1이며 계정의 실제 차감액을 확인한 것은 아니다. [요금](https://liner.com/developers/docs/pricing)

## Model API 존재·엔드포인트

일반 텍스트 생성 API가 공식 **Router API**로 문서화돼 있음을 확인했다. Chat Completions의 엔드포인트는 `POST https://platform.liner.com/api/v1/chat/completions`이고, `model`·`messages`를 보낸다. 인증은 `Authorization: Bearer` 또는 `x-api-key`다. 문서의 모델 예시는 `liner-gpt-router`이며 기존 `liner-mark` 계열 안내도 있다. [Router API](https://liner.com/developers/docs/router-api), [Chat Completions 명세](https://liner.com/developers/docs/liner-model-api-chat-completions)

이는 공식 문서의 존재 확인이다. 이 계정에서 Model API를 실제 호출하거나 모델 권한·생성 품질을 검증하지 않았다. 구형 `/developers/docs/model-api` 문서의 접근 실패는 API가 없다는 증거가 아니다. #29는 Search 근거와 의도 규칙·이유/메일 템플릿을 기본으로 유지하고 Model API는 별도 검증 후 선택한다.

## 실제 호출 검증

2026-11-18 05:16:43~56 UTC(한국 14:16, 정오 기한 이후)에 공개 기관 5곳×2질의를 실제 실행했다. **10요청 모두 HTTP 200**, 관찰 응답은 `requestId`·`results`·`totalCount`, 결과 객체는 `date`·`description`·`faviconUrl`·`hostname`·`title`·`url`이었다. 별도 인용문 필드는 관찰되지 않았으며 `description`을 생성 답변으로 취급하지 않는다. 요청은 동시 2개·8초 제한·자동 재시도 없음·`max_results: 3`·`include_knowledge: false`였다. 질의별 측정 지연은 약 1.8~3.9초였고 다른 키·시간·질의의 지연을 보장하지 않는다.

**엄격 기준 3/5 성공 → 실시간 시연**으로 판정했다. 두 질의가 정상 응답하고, 반환된 공식 기관/의료그룹의 제목·스니펫에서 실재·업종·소재지·공식 도메인 네 항목을 직접 확인한 기관만 성공으로 셌다. 질의에 넣은 국가, 국가 도메인, 기관명 속 도시만으로 소재지를 채우지 않았다. Cleveland Clinic·Charité·Singapore General Hospital은 네 항목을 충족했다. 서울대학교병원·The University of Tokyo Hospital은 실재·업종·공식 도메인은 확인했지만 공식 스니펫의 소재지 직접 근거가 부족해 부분 충족으로 남겼다. 두 기관의 부분 충족은 API 실패를 뜻하지 않는다.

이 결과는 검색 응답의 수동 정보 가용성 평가이며 자동 판정 엔진의 정확도가 아니다. 기관별 두 질의와 항목별 근거·출처는 [검증 기록](../qa/LINER_SEARCH_EVALUATION_2026-11-18.md)에 있다. 저장 결과 시연은 실시간 성공으로 집계하지 않는다. 키 갱신 뒤 앞선 인증 성공은 [#26 기록](https://github.com/stynerk/onemorestep/issues/26#issuecomment-6969204207)과 구분하며 이번 결과를 정오 이전 실행으로 소급하지 않는다.

## LINER_MODE 기본값과 실패

- `LINER_MODE` 미설정·빈 값·`auto`: 서버에 키가 있으면 실제 호출, 없으면 예시.
- 명시적인 `sample`: 키가 있어도 외부 호출하지 않는다. 기존 로컬 설정을 자동으로 바꾸지 않는다.
- 명시적인 `live`: 키가 있으면 실제 호출, 없으면 예시 안내.
- 알 수 없는 값: 외부 호출 없이 예시와 설정 안내로 처리한다.
- 인증·잔액·한도·네트워크·응답 검증 실패나 8초 시간 초과는 실제 검색 결과가 아니라고 표시한 예시로 전환한다. 원본 오류와 키는 브라우저에 반환하지 않는다. HTTP(S)만 허용하고 URL의 사용자 정보는 거절한다.

기본 모드 결정은 전달받은 옵션만 사용한다. 자동 테스트는 모의 응답을 주입하며 실제 외부 API를 호출하지 않는다. 기관 판정 엔진에서는 실패/예시를 기관 부재의 근거로 사용하지 않아야 한다.

## 30건 일괄 처리 방침 (#29 구현 계약)

캐시가 없는 30건은 리드당 2질의이므로 기본 최대 60요청이다. 기관명·국가·정규화 질의·추출 버전·언어/국가 옵션·`include_knowledge`를 캐시 키로 묶어 같은 요청을 재사용한다. 동시 2요청, 요청당 8초 제한과 건별 상태로 점진 갱신한다. 현재 `research`는 자동 재시도를 하지 않는다. #29에서 429 재시도를 넣을 경우 `Retry-After`를 지키고 요청당 최대 1회로 제한해 기본 60+재시도 60=최대 120회 상한을 둔다. 기다리는 동안 다른 건은 계속 처리하고 장시간 대기는 재시도 가능 상태로 반환한다. 401/402는 자동 재시도하지 않는다. 캐시 성공과 저장 결과 재생은 모드·출처·시각을 함께 표시하며 실제 호출 성공 횟수와 분리한다. 이 단락은 후속 구현 방침이고 현재 검색 화면에 배치·캐시 기능이 구현됐다는 뜻이 아니다. Web Search의 고정 초당 제한이 없다는 안내도 무제한 계정 호출을 뜻하지 않는다. [한도·재시도](https://liner.com/developers/docs/rate-limits)
