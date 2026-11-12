# Liner API 검증

확인일: 2026-11-12. 공식 문서 확인과 실제 유료 호출 검증을 구분한다.

## 이번 세팅에서 쓰는 API

| 항목 | 확인 결과 | 공식 출처 |
|---|---|---|
| 엔드포인트 | `POST https://platform.liner.com/api/v1/tools/search/web` | [Search API](https://liner.com/developers/docs/search-api) |
| 인증 | 서버에서 `x-api-key` 헤더, JSON Content-Type 사용 | [Search API](https://liner.com/developers/docs/search-api) |
| 요청 | query 필수, max_results 1~20. 이번 구현은 3건, ko/kr, include_knowledge=false | [Search API](https://liner.com/developers/docs/search-api) |
| 응답 | results 배열의 title, url, description을 사용. JSON 비스트리밍 | [Search API](https://liner.com/developers/docs/search-api) |
| 호출 한도 | Web Search는 고정 초당 제한 없음, 공정 사용 및 계정별 제한 적용 가능. 무제한 호출을 뜻하지 않음 | [Rate limits](https://liner.com/developers/docs/rate-limits) |
| 비용 | include_knowledge=false이면 1,000회당 USD 1. 기본값 true는 프리미엄 데이터를 포함해 USD 2 | [Pricing](https://liner.com/developers/docs/pricing) |

2026-11-11부터 프리미엄 데이터가 기본 활성화됐다는 안내가 있어 `include_knowledge: false`를 명시한다. 계정별 실제 한도, 대회 크레딧 지급 여부와 잔액은 확인하지 못함. 요금은 문서 확인 시점의 공개 가격이며 대회 계정에 적용되는 조건은 별도 확인해야 한다.

## 실패와 시연

- 기본 `LINER_MODE=sample`은 키가 있어도 외부 호출하지 않는다.
- HJ가 API 사용을 허용한 뒤 서버의 `.env.local`에 키와 `LINER_MODE=live`를 설정한다. 키는 클라이언트 환경변수에 넣지 않는다.
- 키 누락, 인증 실패, 잔액 부족, 한도 초과, 네트워크 오류, 잘못된 응답, 8초 시간 초과는 출처를 포함한 준비된 예시로 전환한다.
- 예시는 입력 질의에 대한 실제 검색 결과가 아니라고 표시한다. 가상 응답을 Liner 성공 호출로 기록하지 않는다.
- 자동 재시도는 이번 범위에서 하지 않는다. 향후 재시도는 retryable과 Retry-After를 확인해야 한다.
- 출처는 HTTP(S) URL만 받는다. 원본 오류 본문과 인증 헤더는 브라우저에 반환하지 않는다.

## 검증 상태

공식 문서의 요청/응답을 기준으로 실제 HTTP 호출 코드를 작성했다. 자동 검증은 주입한 테스트 응답을 사용한다. 실제 인증된 Liner 호출, 실제 응답 지연과 계정 과금은 확인하지 못함. 키/호출 승인 없이 크레딧 소비를 실행하지 않는다.

기존 인수인계의 “Model API는 자체 웹 검색이 안 되므로 반드시 Search API와 병용”은 이번 세팅의 전제가 아니다. 이 Issue는 출처 있는 검색 결과가 필요하므로 Search API를 직접 사용한다. 카드 추론 모델은 별도 기능 Issue에서 검증한다. [공식 API 선택 안내](https://liner.com/developers/docs)
