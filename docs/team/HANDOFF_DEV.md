# 개발PM 인수인계 — One More Step

마지막 갱신 2026-11-25, CTO Cap.

## Issue #135 보조 평가 준비, Gemini 응답 차단

- 작업 트리 `.worktrees/issue-135`, 브랜치 `issue-135-large-evaluation`, 기준 main `ca0cf6e299772744aa5e734fab99dbe96cbed7be`. PR #134 기획서와 #137 생성 명세는 main에 병합됐다. 제품 엔진과 프롬프트 차이는 없다.
- 실제 기관 78곳을 모두 포함한 가상 리드 1,000건을 생성했다. 분포는 명세의 12개 유형 및 한·영·일·독·프·스 200/350/100/100/150/100과 일치한다. 시드 `20261125` 재생성 SHA-256은 `85a74194a02ee02ae7f126d9732b720f4148302ce7ac6943d35476e5370ee51b`다.
- Liner 실행 1,000건 완료. 검색 451회, Router 의도 988회, 도메인 200회, 성공 검색 재사용 1,525회다. 검색 시간 초과가 난 G0007도 동결 엔진 결과인 애매를 유지했다. 오프라인 재생의 예측 해시는 `dfa7f4f2bcf08d8974f96453cd51d072445655884a1a4877fc8720418390fad4`로 일치했다.
- 원문 압축본과 예측 JSON의 사본은 본 폴더의 Git 제외 경로 `.cache/frozen-evaluations/issue-135/`에 있다. 재생 시 `liner-recordings.jsonl.gz`는 작업 트리 `.cache/large-eval/`, `liner-predictions.json`은 `docs/qa/large-eval/`에 둔다. 원문 압축 해시는 `87f2310c5ace3f737ee2c7f3d4d24d8dad5ddbb1308ff819b11dd371b6dd1cc5`다.
- Gemini 요청에서 모델별 무료 일일 한도(429)와 서비스 오류(503)가 반복됐고 Batch API는 400 FAILED_PRECONDITION으로 작업을 접수하지 않았다. 서로 다른 진단 구성에서 받은 일부 라벨은 채점에 쓰지 않았다. 작업 트리 `.cache/large-eval-gemini/`에 진단 기록을 남겼다.
- Gemini 호출이 가능한 환경에서 같은 모델과 지침으로 생성 1,000건과 사람 확정 정답 검증 100건을 끝낸 뒤 스코어를 산출해야 한다. 두 완성 파일과 지침 해시를 확인하기 전까지 PR은 초안 상태다. 대표 수치 17/30, README, 기획서와 영상은 현재 제출 기준을 따른다. 20:00까지 완성되지 않으면 보조 수치는 제출에 넣지 않는다.

## 재현과 재개

작업은 Issue 전용 작업 트리에서 실행한다. Gemini 실행기의 기본값은 `gemini-3.6-flash`, 10건 배치, 단일 동시 요청이다. 설정을 바꾸면 두 세트에 같은 모델과 배치 크기를 사용한다. 완료된 배치는 요청 해시로 재사용한다.

```powershell
node scripts/generate-large-eval.mjs --check
node --test tests/large-eval-generation.test.mjs
node scripts/label-large-eval.mjs validate human
node scripts/label-large-eval.mjs validate generated
New-Item -ItemType Directory -Force .cache/large-eval | Out-Null
Copy-Item ../../.cache/frozen-evaluations/issue-135/liner-recordings.jsonl.gz .cache/large-eval/
Copy-Item ../../.cache/frozen-evaluations/issue-135/liner-predictions.json docs/qa/large-eval/
node --import tsx scripts/evaluate-large-liner.ts replay
# Gemini 호출이 가능한 환경에서 실행
node scripts/label-large-eval.mjs capture human
node scripts/label-large-eval.mjs capture generated
node --import tsx scripts/score-large-evaluation.ts
```

## 이전 작업과 제출

- [PR #128](https://github.com/stynerk/onemorestep/pull/128)은 승인 커밋 `5b624a4`에서 독립 QA를 통과했다. GitHub PR의 결과와 메뉴·URL을 봇 인계와 v5 영상의 기준으로 사용한다.
- 영상 업로드와 제출, 운영 배포를 시작하는 병합은 HJ 담당이다.
