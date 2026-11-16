# 개발PM 인수인계 — onemorestep (미리내)

마지막 갱신: 2026-11-16, Cap. PC 전환 준비 중이며 새 봇 설치·구조 전환은 완료되지 않았다.

## 지금 상태

- HJ가 onemorestep부터 새 운영 구조로 전환하도록 지시했다. 규칙 정본은 hq, 소라=서비스PM(Claude), Cap=개발PM(Codex)이다.
- 이 변경은 Issue #11의 에이전트 정의 내보내기다. 최신 origin/main `1e6f629`에서 별도 작업 트리를 만들어 hq의 researcher/reviewer 2개와 implementer/qa/release 3개를 생성했다. 직접 작성된 기존 동명 파일은 없었다.
- 저장소에 `qa`, `release-ready` 라벨을 생성했다. 기존 Issue #2·#7·#9와 PR #6·#8·#10은 검토 대기 상태를 유지한다.
- PC 본 폴더는 아직 `issue-9-api-providers` `00dc7ef`이며 미커밋 변경이 없었다. 작업 브랜치와 옛 봇은 보존했다. 새 봇 가동 전에 issue-9를 작업 트리로 분리하고 본 폴더를 main으로 전환한 뒤 `git pull --ff-only origin main`으로 최신화해야 한다. 기존 로컬 main은 origin/main보다 21커밋 뒤처져 있다.
- hq PR #1은 paused 프로젝트 격리, 현재 봇 멘션 주입, 최신 origin/main 기반 서비스 작업 트리 생성 문제를 수정했다. 서비스PM 재검토 중 Claude 사용량 한도가 발생했으며 PC 표시상 15:00 KST 자동 재개 예정이다. 승인과 실제 설치 전에는 전환 완료로 보지 않는다.
- onemorestep 설정과 OurAdventure의 미커밋 작업·설정은 Git 밖 비공개 체크포인트에 SHA-256 대조 백업했다. OurAdventure는 paused 상태로 유지한다.

## 기존 개발 작업

- Issue #9 / PR #10은 Liner 기본 검색·계획 생성 제공자 교체 계층과 제안 검증을 구현한 검토 대기 작업이다. 상세 구현과 당시 검증은 `issue-9-api-providers`의 `docs/team/HANDOFF_CTO.md` 및 PR #10에 남아 있다. 그 브랜치를 병합하거나 버리지 않았다.
- Issue #7 / PR #8의 PC·모바일 목업과 `design-main-home-wireframes`도 그대로 보존한다. 회사 변경→재판단→사용자 검토→작업 반영 전체 루프가 연결됐다고 보지 않는다.
- 실제 Liner 인증 호출, 모델 품질, 서버·DB·화면 통합과 공개 배포는 이번 세팅에서 검증하지 않았다. 기본 sample 모드를 유지한다.

## 검증한 것과 못 한 것

- hq 생성기로 에이전트 정의 5개를 생성하고 원본과 대조했다. 코드 기능을 수정하지 않아 제품 빌드는 재실행하지 않았다.
- hq 봇은 Windows 테스트 64개와 구문 검사, 독립 개발 QA를 통과했다. 이는 실제 Discord·작업 스케줄러·DPAPI·로그인·재로그인 검증을 대신하지 않는다.
- custom Codex 에이전트 이름 호출과 자동 탐색은 실제 CLI에서 별도 확인해야 한다. 실패하면 해당 TOML의 developer_instructions를 읽고 worker에 전달한다.
- PC Git push는 403이다. GitHub 연결 도구의 코드 쓰기와 GitHub CLI의 라벨 생성은 성공했다. 새 봇의 자동 레지스트리 commit/push 검증에서도 이 실패를 구분한다. 토큰 발급·권한 변경은 HJ가 한다.

## 열린 결정과 다음 할 일

1. 서비스PM은 hq PR #1의 새 커밋을 재검토한다. 승인과 QA 뒤 main에 병합하고 PC 설치를 진행한다. 한도·로그인 실패를 승인이나 성공으로 기록하지 않는다.
2. Issue #11의 생성 정의와 이 인수인계를 PR로 검토한다. 새 봇 검증 전에는 AGENTS.md·CLAUDE.md의 전환 기간 절을 지우지 않는다.
3. PC 작업 트리 분리·main 최신화와 로컬 `.worktrees/` ignore를 확인한 뒤 기존 토큰 공유 봇만 종료하고 새 봇을 가동한다. 절차는 hq `bots/PC_HANDOFF.md`를 따른다.
4. dev 스레드에서 실제 테스트 Issue로 TASK_READY→PR→검토→QA를 확인한다. 현재 릴레이 응답은 요청 채널로 전송하므로 본문에서 dev로 자동 전달되는 기능으로 오인하지 않는다.
5. 중복 수신, 읽기 전용 협의, !stop, 미등록 채널과 재로그인 자동 실행을 확인한 뒤에만 옛 봇·전환 문구를 정리한다.
6. 제품 방향·데모 범위와 API·목업 브랜치 병합 우선순위는 소라가 정한다. 방향 결정 전 새 기능을 추가하지 않는다.

## 서비스PM에게 전할 말

된 것: 에이전트 정의 5개와 QA·릴리즈 라벨 준비, 기존 작업 보존.
안 된 것: 새 봇 설치·실제 인계·재로그인 검증, 제품 기능 브랜치 병합.
위험: 로컬 main 지연, CLI 사용량 한도, Git push 403, 예시 실행과 실제 API 활용의 혼동.
소라가 정할 것: hq 봇 설치 전 코드 검토 승인, 기존 제품 PR 검토와 데모 범위.
다음 작업: 승인 후 PC 전환과 실제 검증을 이어간다.
