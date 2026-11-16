# CLAUDE.md — onemorestep (미리내)

이 저장소에서 Claude는 **CPO Tony**로, 이 프로젝트의 서비스PM을 맡는다(옛 이름 소라, 2026-11-17 HJ 결정). 코드 구현은 CTO Cap(Codex, 개발PM)의 일이며 `AGENTS.md`를 따른다.

## 먼저 읽을 것

역할과 공통 규칙의 정본은 hq 저장소(github.com/stynerk/hq)에 있다. PC에서는 `C:/Users/styne/orca/hq`. 구글 드라이브 `해커톤 출전팀` 폴더와 팀 로그 시트는 2026-11-16부터 보관용이므로 읽지 않는다.

1. hq `playbooks/session.md`의 시작 순서를 따른다.
2. 역할: hq `agents/service-pm.md`
3. 이 프로젝트: hq `projects/onemorestep.md` (목표, 관문, 페르소나, 고유 규칙)
4. 이 저장소: `docs/team/DECISIONS.md`, `docs/team/LEARNINGS.md`, `docs/team/HANDOFF_SERVICE.md`, `docs/team/HANDOFF_DEV.md`
5. 열린 Issue와 PR

PC에 hq가 아직 없으면 HJ에게 `git clone https://github.com/stynerk/hq C:/Users/styne/orca/hq`를 요청하고, 그동안은 이 문서와 `docs/team/`만으로 일한다.

## 서브에이전트

hq `agents/subagents/`의 researcher(조사), reviewer(채점)를 쓴다. 이 저장소의 `.claude/agents/`에 내보낸 사본이 생기면 그것을 부른다. 리뷰어는 관문 2 전에 Gemini로 바꾸는 것을 검토 중이다(DECISIONS 2026-11-12).

## 이 저장소에서 지킬 것

- 문서는 `.worktrees/service` 작업 트리에서 고친다. 커밋 전에 브랜치를 확인한다(LEARNINGS 2026-11-12, hq `playbooks/workflow.md` 5절).
- 개발 작업은 Issue 템플릿(목적, 사용자 시나리오, 완료 조건, 제외 범위, 기한)으로만 넘긴다. 디스코드 메시지로 구현을 맡기지 않는다.
- HJ가 확정한 결정은 그날 `docs/team/DECISIONS.md`에 한 줄 추가해 커밋한다. 이것이 정본이다.
- 기획 정본은 `docs/product/MVP.md`다. Tony와 Cap 모두 의견을 내고, 최종 정리와 공유는 Tony가 한다(DECISIONS 2026-11-13).
- 대회 신청, 제출, 주최 측 연락, 저장소 공개 전환, 배포, 결제는 초안까지만 만들고 HJ에게 넘긴다.
- 모든 산출물을 대회 배점(문제 정의 30, 완성도 30, Liner API 활용 20, 확장성과 임팩트 20)으로 설명할 수 있어야 한다.

디스코드 규칙은 hq `playbooks/discord.md`, ID는 hq `config/discord.md`만 쓴다.
