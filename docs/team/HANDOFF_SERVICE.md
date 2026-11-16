# 서비스PM 인수인계 — onemorestep (미리내)

마지막 갱신: 2026-11-17, Tony(옛 이름 소라). 봇 전환 완료 직후.

세션을 끝낼 때마다 통째로 새로 쓴다. 이전 내용은 git 이력에 있다.

## 지금 상태

- 운영: 11-17 HJ가 봇 전환 완료를 확정했다. 서비스PM은 CPO Tony(Claude 릴레이), 개발PM은 CTO Cap(Codex 브릿지). 디스코드 규칙은 hq `playbooks/discord.md`, ID는 hq `config/discord.md`만 쓴다.
- 인계 경로 검증은 두 단계로 진행했다.
  - #13(PR #14): Tony → Cap 방향(TASK_READY, QA_READY)은 자동으로 됐다. Cap → Tony 방향(REVIEW_REQUEST, QA_RESULT)은 신호가 메시지 중간에 있어 읽기 전용 협의로 처리됐고, HJ가 대신 요청해 이어 갔다.
  - #15(PR #16): 라우팅 수정(hq PR #5, 신호를 어느 줄 맨 앞에서든 인식) 뒤 재검증했다. TASK_READY → REVIEW_REQUEST → QA_READY → QA_RESULT가 HJ 개입 없이 오갔고, Tony가 gh로 라벨·댓글·병합 확인을 직접 했다.
- #20 완료: PR #22가 merge commit `1fd6b3b`으로 병합됐다. CLAUDE.md·AGENTS.md 두 파일에서 전환 기간 절(옛 PM_Sora ID, `@codex implement this` 안내)이 빠지고 hq 정본 참조 한 줄로 바뀌었다. 과거 이력과 이 인수인계에는 해당 문구가 남아 있다.
- 기획: 여전히 기획 단계에서 멈춰 있다. 정본은 `docs/product/MVP.md` v0.2, 도식은 `docs/product/PRD.html` v0.1. 11-13 인터뷰(`docs/product/INTERVIEW.md`)는 v0.2의 가정을 뒷받침하지 않았다("범위가 넓고 범용적이다, 차별성은 특정 업의 데이터·프로세스·반복 루프에서 나온다"). 관문 2 전에 대상과 도메인을 좁히는 결정이 필요하고, 아직 HJ에게 올리지 않았다.
- 개발: 열린 PR #8(`issue-7-web-mockup`, 목업), #10(`issue-9-api-providers`, 공급자 교체 계층), #6(`issue-2-connection-recheck`, 옛 연결 점검 기록)이 병합되지 않은 채 `review`로 남아 있다. PR 없는 브랜치 `design-main-home-wireframes`(홈 와이어프레임 미리보기)도 원격에 남아 있다.
- 라벨: `qa`, `release-ready` 생성 확인.

## 열린 결정

| 결정 | 선택지 | 추천안 | owner-decision Issue |
|---|---|---|---|
| 미리내의 대상과 도메인 좁히기 (인터뷰 반영) | 초기 창업자 전반 유지 / 특정 업종·직무로 좁힘 / 팀이 직접 운영 경험을 가진 영역으로 피벗 | Tony가 정리해 관문 2 검수 패키지로 올린다 | 아직 없음 |
| 리뷰어를 Gemini로 전환 | Gemini CLI / Gemini API / Claude 리뷰어 유지 | 관문 2 전 결정 (DECISIONS 2026-11-12) | 아직 없음 |
| 테스터 2주 참여 | 확인 / 미확인 유지 | HJ 확인 필요 (관문 1 질문 3) | 아직 없음 |
| 옛 봇 정리 | PM_Sora 서버 추방, PC 옛 봇 폴더 정리 | HJ 확인 뒤 별도 진행 (#20 제외 범위) | 아직 없음 |

## 다음 할 일 (우선순위 순)

1. 인터뷰 결과를 반영해 방향 선택지 2~3개를 만들고, researcher로 근거를 보강하고, reviewer 채점을 거쳐 관문 2 검수 패키지를 `owner-decision` Issue로 올린다. 제출 마감은 11-25 23:59로 8일 남았다.
2. 열린 PR #6, #8, #10과 `design-main-home-wireframes` 브랜치를 Cap과 정리한다: 병합할 것, 닫을 것, 새 방향에 맞춰 다시 할 것. #6과 Issue #2는 전환으로 의미가 없어졌으니 닫는 쪽을 추천.
3. 테스터 참여 여부를 HJ에게 한 줄로 묻는다.

## 개발PM에게 전할 말

- 방향이 정해질 때까지 새 기능 구현은 미루고, 열린 PR 정리와 공수 추정만 해 달라.
- 남은 운영 브랜치(`backup/service-20261117`, `chore/*`, `issue-4-dev-setup`)는 병합이 끝났으면 정리해도 되는지 확인해 달라. 지우기 전에 HJ 확인이 필요하면 그대로 둔다.
