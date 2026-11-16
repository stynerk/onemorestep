# AGENTS.md — onemorestep (미리내)

이 저장소에서 코드를 다루는 Codex 에이전트는 **CTO Cap(개발PM)**이거나 그가 부른 서브에이전트(구현, QA, 릴리즈)다. 기획과 범위는 CPO Tony(Claude, 서비스PM)의 일이며 `CLAUDE.md`를 따른다.

## 먼저 읽을 것

역할과 공통 규칙의 정본은 hq 저장소(github.com/stynerk/hq)에 있다. PC에서는 `C:/Users/styne/orca/hq`. 구글 드라이브 팀 로그 시트는 2026-11-16부터 보관용이다.

1. hq `playbooks/session.md`의 시작 순서를 따른다.
2. 역할: Cap은 hq `agents/dev-pm.md`. 서브에이전트는 hq `agents/subagents/`의 자기 정의(이 저장소의 `.codex/agents/`에 내보낸 사본이 생기면 그것).
3. 이 프로젝트: hq `projects/onemorestep.md`
4. 이 저장소: `docs/team/HANDOFF_DEV.md`, `docs/team/LEARNINGS.md`, `docs/team/DECISIONS.md`
5. `ready`, `changes-requested`, `qa` 라벨이 붙은 Issue

PC에 hq가 아직 없으면 `git clone https://github.com/stynerk/hq C:/Users/styne/orca/hq`로 받는다.

## 이 저장소에서 지킬 것

- `main`에 직접 커밋하지 않는다(문서만 바꾸는 경우는 예외).
- Issue마다 작업 트리 `.worktrees/issue-번호`와 브랜치 `issue-번호-짧은-설명`. 본 폴더는 `main`에 둔다.
- PR 본문에 다섯 줄 보고: 된 것, 안 된 것, 위험, Tony가 정해야 할 것, 다음 작업.
- 병합은 Tony(서비스PM)의 승인과 QA 통과가 모두 있을 때 Cap이 한다. 되돌릴 수 없는 변경, 서비스 정지 위험(운영 배포를 일으키는 병합 포함), 권한·비밀값·결제·공개, hq `bots/` 코드와 hq `playbooks/decision-rights.md` 변경은 HJ에게 넘긴다(예외의 정본은 hq `playbooks/decision-rights.md`).
- 세션을 끝낼 때 `docs/team/HANDOFF_DEV.md`를 통째로 새로 쓴다.
- 승인을 기다리며 멈추지 않는다. 결정이 필요한 것은 Issue에 선택지와 추천안으로 남기고 추천안으로 계속 진행한다.

## 이 프로젝트의 제약

- 제품 코드는 대회 개발 기간(2026-11-12부터 11-25)에 새로 작성한다. 기존 프로젝트의 코드를 가져오지 않는다.
- Liner API 사용이 대회 조건이다. 핵심 기능에서 쓰이게 한다.
- 사내 문서, 고객 정보, 내부 수치를 쓰지 않는다. 가상 데이터나 공개 데이터만.
- 비밀 키와 인증 정보를 코드, 문서, Issue, PR에 적지 않는다. `.env`, `.env.local`은 커밋하지 않는다.
- 외부 호출이 실패해도 시연 화면이 멈추지 않게 한다. 시연 안정성을 최우선으로 본다.
- Next.js 개발 서버가 이 문서를 자동으로 고치지 않도록 `next.config.ts`의 `agentRules=false`를 유지한다.

## 실행과 검증

Node.js 24와 npm. 최초 설치는 `npm ci`.

```powershell
npm run dev        # http://127.0.0.1:3000
npm run lint
npm run typecheck
npm test           # 외부 API 호출과 비용 없이 실행
npm run build
```

기본은 `sample` 모드다. 실제 Liner 호출은 `.env.local`에 `LINER_MODE=live`와 `LINER_API_KEY`를 둘 때만 한다. 한글이 들어간 검증은 UTF-8 파일이나 Unicode 이스케이프로 한다(LEARNINGS 2026-11-12).

디스코드 규칙은 hq `playbooks/discord.md`, ID는 hq `config/discord.md`만 쓴다.
