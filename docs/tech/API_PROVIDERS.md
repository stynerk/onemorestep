# 검색·계획 생성 API 교체

2026-11-13, Issue #9. 해커톤 기본 제공자는 Liner다. 검색과 계획 생성은 별도 계약으로 분리하며 같은 제공자를 사용할 필요가 없다. 기본 fetch를 사용해 추가 SDK 의존성을 만들지 않았다.

## 경계

- `providers/contracts.ts`: `SearchProvider.search → Source[]`, `ModelProvider.generate → unknown` 계약.
- `providers/search.ts`: Liner 요청/응답 또는 정해진 HTTP JSON 계약으로 변환.
- `providers/model.ts`: Liner 모델 또는 호환 Chat Completions 요청/응답 변환.
- `providers/config.ts`: 서버 환경 설정을 선택한다. 브라우저 요청으로 제공자·키·주소를 바꾸지 않는다.
- `research.ts`: 기존 `ResearchResult`와 입력/출처 검증·예시 전환을 유지한다.
- `planning.ts`: 회사 맥락·변경·기존 작업·근거를 받아 공통 계획 형식과 작업 ID/근거/의존성을 검증한다.
- `/api/research`, `/api/planning`: 제공자 독립적인 앱 진입점. 키는 서버에서만 사용한다.

계획 응답은 ‘제안’이다. 상태 변경 감지, DB 저장, 사용자 승인 후 적용, 이전 revision 응답 폐기와 전체 UI 갱신은 후속 서비스 연결 범위다. 기존 GitHub Pages 정적 목업은 이 서버 API를 아직 호출하지 않는다.

## 해커톤 설정

```dotenv
AI_MODE=sample
SEARCH_PROVIDER=liner
PLANNER_PROVIDER=liner
PLANNER_MODEL=liner-claude-router
LINER_API_KEY=
```

기본 sample에서는 키가 있어도 외부 호출하지 않는다. 실제 호출을 사용할 때 서버 로컬 설정에서 `AI_MODE=live`로 바꾼다. `AI_MODE`가 없으면 기존 `LINER_MODE`를 읽는다. 새 예시 파일에는 AI_MODE가 있으므로 LINER_MODE만 live로 바꿔서는 실시간 호출되지 않는다. 이 작업에서 유료 호출이나 실제 키 검증은 하지 않았다.

Liner 검색: `POST https://platform.liner.com/api/v1/tools/search/web`, x-api-key, 3개 결과, ko/kr, include_knowledge=false. [공식 Search 문서](https://liner.com/developers/docs/search-api)

Liner 계획 생성: `POST https://platform.liner.com/api/v1/chat/completions`, Bearer 인증, 기본 liner-claude-router, 비스트리밍 JSON Schema 출력. [공식 Chat Completions 문서](https://liner.com/developers/docs/liner-model-api-chat-completions), [Claude Router](https://liner.com/developers/docs/llm-claude-router)

기존 [LINER_API.md](LINER_API.md)의 검색 비용/한도 기록은 검색만의 확인 기록이다. 모델 요금·계정 권한·가용 모델은 실제 연결 전에 [공식 요금](https://liner.com/developers/docs/pricing)과 계정에서 별도 확인한다.

## 설정으로 대체할 수 있는 API

```dotenv
SEARCH_PROVIDER=http-json
SEARCH_API_URL=https://search.example.com/query
SEARCH_API_KEY=

PLANNER_PROVIDER=chat-completions
PLANNER_API_URL=https://model.example.com/v1/chat/completions
PLANNER_API_KEY=
PLANNER_MODEL=your-supported-model-id
```

주소는 예시이며 실재 제공자 연결을 뜻하지 않는다. 전체 HTTPS 엔드포인트와 해당 서비스의 모델 ID를 지정하고 서버를 재시작한다. 검색/모델 키는 각각 독립이며 Liner 키를 다른 제공자에게 재사용하지 않는다.

- 검색 HTTP JSON 계약: Bearer 인증, `POST {query,maxResults:3,locale:"ko-KR"}` → `{sources:[{title,url,description}]}`. 응답 최대 3건과 안전한 HTTP/HTTPS 출처만 앱에 전달한다.
- 모델 호환 계약: Bearer 인증, 비스트리밍 Chat Completions의 system/user 메시지, max_completion_tokens, response_format=json_schema 지원. choices[0].message.content의 JSON과 finish_reason=stop을 요구한다. 공급자별 비공개 응답 필드는 반환하지 않는다.
- 다른 요청/인증/응답 형식이라면 위 설정만으로 호환되지 않는다. 해당 제공자의 공식 사양을 확인하고 어댑터를 추가한다. 공통 서비스·화면 데이터 형식은 그대로 둔다. 예: native Messages API나 별도 검색 API는 각 전용 어댑터가 필요하다.

알 수 없는 제공자·잘못된 주소·누락된 키는 외부 호출 전에 실패한다. 리다이렉트를 따라 키를 전송하지 않는다. 검색 실패는 명시된 예시, 계획 실패는 `unavailable` 및 `proposal:null`을 반환한다. 실패를 실제 계획 성공으로 표시하지 않으며 기존 사용자 작업을 덮어쓰지 않는다.

## 계획 API 계약

`POST /api/planning` 요청 예시(가상 데이터):

```json
{
  "revision": "company-2",
  "company": "가상 자율주행 차량 운영 관리 스타트업. 목표는 첫 파일럿 준비.",
  "change": "실증 파트너와 협의를 시작했다.",
  "existingTasks": [
    {"id":"partner-search","title":"파트너 후보 탐색","status":"doing"}
  ],
  "evidence": []
}
```

성공은 `{status:"ready",revision,notice,proposal:{summary,tasks}}`. 각 제안은 `id`, `action(add/update/defer)`, `title`, `reason`, `sourceUrls`, `dependsOn`이다. 신규 작업 ID와 기존 작업 ID를 구분하고 완료 작업 변경, 알 수 없는 근거/선행 작업, 중복 ID, 순환 의존성을 거부한다. 날짜를 생성하는 필드는 이번 계약에 넣지 않았다. 근거가 없을 때 외부 사실을 검증했다고 간주하지 않는다.

회사는 4,000자, 변경은 4,000자, 기존 작업 30개, 근거 3개, 제안 10개까지다. 요청 revision은 응답에 돌려준다. 호출자가 현재 회사 revision과 비교해 오래된 제안의 적용을 막아야 한다. 이 API 자체는 DB나 사용자 작업을 수정하지 않는다.

## 검증

유료 호출 없이 주입한 fetch로 Liner/대체 검색 요청·응답과 Liner/대체 모델의 동일 계획 계약을 검사했다. 기본 sample·키 누락·잘못된 설정은 외부 호출하지 않으며, 오류·잘못된 응답·완료 작업 변경·가짜 출처·순환 의존·타임아웃·비밀 정보 비노출을 확인한다. 실제 제공자 인증/과금/품질과 전체 서비스 루프는 이 테스트로 검증되지 않는다.
