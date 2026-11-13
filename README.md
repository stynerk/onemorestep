# onemorestep

제1회 라이너 해커톤 .EXE-THON 출품작 저장소.

- 프로젝트: onemorestep
- 출품 에이전트: 미리내. 사용자가 묻기 전에 놓치고 있는 일과 지금 해 두면 좋은 일을 먼저 알려 주는 프로액티브 업무 에이전트.
  - 이름의 뜻: "미리 내야 할 것"을 챙겨 준다는 뜻과, 은하수(미리내)처럼 일의 흐름을 따라가며 챙긴다는 뜻을 함께 담았다.

- 개발 기간: 2026-11-12부터 11-25까지. 제품 코드는 이 기간에 새로 작성한다.
- 배점: 문제 정의 30, 완성도 30, Liner API 활용 20, 확장성과 임팩트 20.

## 팀

HJ(오너), PM 소라, CTO Cap, 심사위원. 역할과 흐름은 아래 문서에 있다.

- `AGENTS.md`: CTO의 역할과 규칙
- `CLAUDE.md`: PM과 심사위원의 역할
- `docs/team/WORKFLOW.md`: Issue와 PR의 흐름
- `docs/team/HANDOFF_CTO.md`: CTO 인수인계
- `docs/team/LEARNINGS.md`: 시행착오 기록

## 로컬 개발 실행

Node.js 24와 npm을 사용한다. 최초 설치는 `npm ci`, 이후 실행은 아래 한 명령이다.

```powershell
npm run dev
```

<http://127.0.0.1:3000>에서 질의를 입력하고 **조사 결과 확인**을 누른다. 환경변수 설정 없이 준비된 예시와 출처가 표시된다. 예시는 입력 질의의 실제 검색 결과가 아니며, 실제 Liner 호출 성공을 뜻하지 않는다. 오늘 세팅에는 카드 생성과 제품 디자인이 포함되지 않는다.

실제 검색을 확인하려면 `.env.example`을 `.env.local`로 복사하고, 로컬 파일에 `AI_MODE=live` 및 `LINER_API_KEY`를 설정한 뒤 서버를 다시 실행한다. 키와 `.env.local`은 커밋하지 않는다. 기본 `sample` 모드는 키가 있어도 외부 API를 호출하지 않는다. `AI_MODE`가 없을 때만 기존 `LINER_MODE` 설정을 읽는다. 실시간 검색 실패는 명시된 예시로, 계획 생성 실패는 제안 없음으로 반환한다.

검색과 계획 생성 API는 독립적으로 교체할 수 있다. 기본은 Liner이며, 호환 API는 서버의 제공자·주소·키·모델 설정으로 교체한다. 요청 형식이 다른 API는 연결 어댑터를 추가한다. [API 교체 설정과 계획 API 계약](docs/tech/API_PROVIDERS.md)을 참고한다. 계획 API는 검토용 제안만 반환하며, 공개 정적 목업의 데이터 갱신·자동 적용은 아직 연결하지 않았다.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm start`는 빌드 후 프로덕션 서버를 로컬에 실행한다. 자동 테스트는 외부 API 호출과 비용 없이 실행된다.

- [기획 초안](docs/product/PLAN.md)
- [기술 구조·공수·위험](docs/tech/ARCHITECTURE.md)
- [Liner 공식 사양과 검증 상태](docs/tech/LINER_API.md)
