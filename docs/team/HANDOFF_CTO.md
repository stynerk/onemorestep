# CTO 인수인계

마지막 갱신: 2026-11-13, Issue #9 검색·계획 생성 API 교체 계층

## 현재 작업

- HJ 요청: 해커톤은 Liner를 사용하되 다른 API로도 변경할 수 있게 연결을 구성한다.
- 브랜치 issue-9-api-providers는 최신 origin/main에서 분리했다. 목업 작업 브랜치 issue-7-web-mockup 및 PR #8은 보존했다.
- src/lib/providers에 검색/모델 계약·환경 설정·HTTP 전송·어댑터를 분리했다. 검색과 계획 생성은 독립 선택이며 기본은 Liner다.
- 검색은 Liner 또는 정해진 HTTP JSON 계약(http-json), 모델은 Liner 또는 JSON Schema를 지원하는 Chat Completions 계약(chat-completions)이다. API 주소·키·모델은 서버 설정만 읽는다.
- 형식이 같은 API는 설정으로 바꾸고, 다른 요청/응답·인증 방식은 전용 어댑터를 추가한다. 아무 API나 URL만 바꿔 호환된다고 표현하지 않는다.
- 기존 /api/research와 ResearchResult·sample 실패 대비·이전 LINER_MODE 사용을 보존했다. 새 AI_MODE가 있으면 우선하며 기본 sample이다.
- POST /api/planning 추가: 회사 맥락·변경·기존 작업·근거·revision→검증된 변경 제안. 작업 ID/완료 상태/근거 URL/중복/의존성 순환을 확인한다. 자동 적용·DB 수정은 없다. 실패는 proposal:null, sample은 disabled다.
- 새 제공자 연결 설정과 요청/응답은 docs/tech/API_PROVIDERS.md 및 .env.example에 기록했다. README·기술 구조 현황도 갱신했다.

## 검증

- npm test 15개 통과. 기존 Liner 검색 계약, 대체 검색·모델 요청 형식, 동일 반환 계약, 환경 설정·키 분리, 잘못된 설정/응답/가짜 근거/완료 작업/순환 의존/타임아웃과 비밀 정보 비노출을 확인했다.
- 첫 샌드박스 테스트 실행은 tsx의 OS 사용자 정보 조회 ENOMEM으로 시작 실패했다. 정상 실행 환경에서 재실행해 15개 통과했다. 유료 외부 호출은 없다.
- npm run typecheck / lint / build 통과. 프로덕션 라우트에 /api/planning과 /api/research 표시.
- sample 모드 프로덕션 서버 3112에서 실제 HTTP: research 200/sample, planning 200/disabled·revision 반환·proposal 없음·Cache-Control no-store 확인.
- 실제 Liner 키·크레딧·인증/과금·모델 품질은 미검증이다. API 실패가 기존 작업을 수정하는 경로도 없다.

## 기존 목업 상태 보존

- 공개 https://stynerk.github.io/onemorestep/?scenario=autonomy 는 소스 3dc7cf5 / gh-pages f9fb1107 / 배포 43369296705 success의 루프오토 테스트 시나리오다. 이번 서버 변경을 Pages에 배포하지 않았다.
- 자료실·업무 지도·시나리오 전환은 PR #8에서 검토 대기다. 해당 코드/문서가 이 main 기반 브랜치에 모두 있는 것은 아니다.
- 기존 FLOW_AUDIT의 ‘데이터 변화→재판단→초안 재검토→작업 반영’ 미연결은 여전히 남아 있다. 새 계획 API는 이를 연결할 서버 경계이며 전체 루프 구현을 뜻하지 않는다.
- 목업 회사 왕복 전환 전체 UI·새 모바일 선택 메뉴는 이전 브라우저 연결 종료로 미검증이고, 파일 전달 전체 검증도 이전 자동 승인 거절로 남았다.
- 정적 GitHub Pages는 서버 API를 실행할 수 없다. 서버 호스팅·DB·화면 연결과 배포는 후속 범위다. 기존 승인 없는 외부 배포/유료 호출은 하지 않았다.

## 다음 작업

1. 소라가 Issue #9/후속 PR과 설정·검증을 검토한다. 기획 최종 종합은 소라 책임이다.
2. API 키를 서버에 설정한 별도 인증 호출 검증 후 회사 revision을 기준으로 계획 요청을 연결한다. 실패 시 기존 작업 유지, 오래된 응답 적용 방지와 사용자 검토/적용을 구현해야 한다.
3. 실제 회사 저장소·DB·변경 감지·워크플로우 적용·출처 검토는 별도 Issue로 범위를 정한다.
4. 로컬 Next sample 서버 3112 및 이전 목업 서버 3107~3111이 남아 있다. 연결 Issue #2/PR #6은 별도 미완료. 대회 마감은 11-25 23:59 KST다.

## PM 기술 보고

- 된 것: Liner 기본 검색·계획 생성 제공자 분리와 대체 API 설정, 계획 제안 API·공통 검증·교체 문서.
- 안 된 것: 실제 인증 호출과 전체 서비스 갱신/사용자 작업 적용, 공개 목업 연결.
- 위험: 교체 대상의 스키마·인증/지원 옵션이 다르면 어댑터가 필요하며, 모델 제안도 사용자 검토가 필요하다.
- PM이 정해야 할 것: 서버/DB/화면 연결 범위와 실제 모델 품질 평가 기준.
- 다음 작업: PR 검토 및 회사 데이터 변경을 계획 제안 API에 연결하는 후속 범위 확정.
