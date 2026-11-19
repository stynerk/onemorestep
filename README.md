# onemorestep

제1회 라이너 해커톤 .EXE-THON 출품작 저장소.

- 프로젝트: onemorestep
- 출품 에이전트: 미리내. 사용자가 묻기 전에 놓치고 있는 일과 지금 해 두면 좋은 일을 먼저 알려 주는 프로액티브 업무 에이전트.
  - 이름의 뜻: "미리 내야 할 것"을 챙겨 준다는 뜻과, 은하수(미리내)처럼 일의 흐름을 따라가며 챙긴다는 뜻을 함께 담았다.

- 개발 기간: 2026-11-12부터 11-25까지. 제품 코드는 이 기간에 새로 작성한다.
- 배점: 문제 정의 30, 완성도 30, Liner API 활용 20, 확장성과 임팩트 20.

## 팀

HJ(오너), CPO Tony(Claude, 서비스PM), CTO Cap(Codex, 개발PM). Tony는 리서처·리뷰어를, Cap은 구현·QA·릴리즈 서브에이전트를 지휘한다. 역할과 공통 규칙의 정본은 hq 저장소(stynerk/hq)에 있다.

- `CLAUDE.md`: 서비스PM이 이 저장소에서 지킬 것
- `AGENTS.md`: 개발PM과 서브에이전트가 이 저장소에서 지킬 것
- `docs/team/DECISIONS.md`: 확정된 결정 (정본)
- `docs/team/HANDOFF_SERVICE.md`, `docs/team/HANDOFF_DEV.md`: 인수인계
- `docs/team/LEARNINGS.md`: 시행착오 기록
- 흐름: hq `playbooks/workflow.md`

## 로컬 개발 실행

Node.js 24와 npm을 사용한다. 최초 설치는 `npm ci`, 이후 실행은 아래 한 명령이다.

```powershell
npm run dev
```

<http://127.0.0.1:3000>에서 미리내 문의함을 연다. **판정 시작**을 누르면 가상 리드 30건이 근거와 함께 다섯 묶음으로 분류된다. 결정, 회신과 딜러 결과는 이 브라우저에 저장되며 **시연 초기화**로 지울 수 있다. Liner 단일 검색 화면은 <http://127.0.0.1:3000/research>에서 계속 사용할 수 있다.

실제 검색을 확인하려면 `.env.example`을 `.env.local`로 복사하고 서버용 `LINER_API_KEY`를 넣은 뒤 서버를 다시 실행한다. 위 검색 화면(`/api/research`)은 기본 `LINER_MODE=auto`에서 키가 있으면 실제 검색, 없으면 예시로 동작한다. `LINER_MODE` 미설정·빈 값도 `auto`와 같다. 키와 `.env.local`은 커밋하지 않는다. 기존 로컬 파일에 `LINER_MODE=sample`이 있다면 그대로 오프라인이며, 키만 넣어도 실제 검색하려면 이를 `auto`로 바꾸거나 모드 설정을 지운다. 이 변경이 기존 로컬 환경 파일을 자동 수정하지는 않는다.

| 모드 | 키 있음 | 키 없음 |
|---|---|---|
| 미설정·빈 값·`auto` | 실제 검색 | 예시 |
| `live` | 실제 검색 | 예시 |
| `sample` | 외부 호출 없이 예시 | 예시 |
| 알 수 없는 값 | 외부 호출 없이 예시·설정 안내 | 예시·설정 안내 |

실시간 호출 실패·시간 초과·잘못된 응답도 실제 결과와 구분되는 예시 안내로 전환한다. 예시 재생은 인증·검색 성공이나 기관 부재로 집계하지 않는다. Search/Model 문서 확인과 5기관 평가 결과는 [Liner 검증 문서](docs/tech/LINER_API.md)를 읽는다.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm start`는 빌드 후 프로덕션 서버를 로컬에 실행한다. 자동 테스트는 외부 API 호출과 비용 없이 실행된다.

## 세일즈 포워딩 데이터·저장 계층 (#28)

`src/lib/forwarding/seed.ts`는 PR #23의 `1da2b58` 표에서 리드 30건, 딜러 7곳, 가상 전달 내역 41건을 새 객체로 만든다. L06은 마지막 접수다. 표의 `(빈칸)`은 빈 기관명으로, `카자흐스탄(지역 미지정)`은 국가명 `카자흐스탄`으로 정규화했다. 이름·전화는 `Demo L01`·`DEMO-NOT-A-PHONE-L01` 같은 명백한 가상 값이다. 딜러 상품 범위는 원문에 제한이 없어 시연 상품 세 종류를 모두 취급하는 가정이다. 기존 거래 관계는 현재 리드 기관과 겹치지 않는 90일 전달 내역과 별도로 보존한다.

기본값은 `policy.ts` 한 파일에서 바꾼다. 시연 기준 시각은 `2026-11-18T00:00:00.000Z`이며 후속 계산에 전달해 실제 날짜 경과로 시연 이력이 사라지지 않게 한다. 판정과 업무 상태는 별도 필드이고 초기 판정은 없다. 평가 정답은 `evaluation/ground-truth.json`에만 있고 런타임 입력·저장 모듈은 가져오지 않는다. 원문 표 스냅샷 대조, 정답 분리, 딜러별 합계는 `npm test`로 확인한다.

`store.ts`의 `createBrowserForwardingStore()`는 단일 사용자의 브라우저 localStorage에 버전이 있는 이벤트만 저장한다. 화면 연결은 #31의 범위이며 이번 변경에는 버튼·판정·추천·발송 구현이 없다.

```ts
const store = createBrowserForwardingStore();
const restored = store.hydrate();
// 실패하면 error를 표시하고, 저장값을 임의로 덮어쓰지 않는다.
const saved = store.append(event); // 호출자가 제공하는 안정적인 이벤트 ID
const reset = store.reset();       // '시연 초기화' 버튼에서 호출할 API
```

동일 ID와 내용은 한 번만 반영되고 다른 내용은 거절된다. 분리한 콜백도 동작한다. 처음 append할 때 기존 저장값을 먼저 읽고, 손상 JSON·지원하지 않는 버전·없는 대상·알 수 없는 필드는 오류로 반환한다. 손상 저장값은 사용자가 `reset()`하기 전 덮어쓰지 않는다. 초기화는 앱 전용 키만 지운다. 저장소 차단·용량 초과·삭제 실패는 호출자에게 명시적 결과를 반환하며 메모리 상태도 부분 변경하지 않는다. 스냅샷의 외부 수정은 내부 상태에 반영되지 않는다. 재판정·회신은 이미 승인한 배정을 취소하지 않는다.

이벤트에는 판정 근거·결정·딜러 결과·회신·메일 상태만 담으며 별도의 수신 주소나 인증 정보 필드는 없다. 메일 상태 `unknown`은 전송 여부 불명이다. SMTP 전송·재시도는 #25가 맡는다. 서버와 브라우저 저장소는 공유되지 않으므로 #31/#25 연결에서 서버가 검증한 전송 결과를 이벤트로 반영해야 한다. 이 계층은 메일·검색을 호출하지 않으며 import 시 window에 접근하지 않는다. 다중 사용자·다중 탭 동시 편집과 저장 형식 마이그레이션은 범위 밖이다.

## 세일즈 포워딩 기관 판정 (#29)

`POST /api/forwarding/assess`에 JSON으로 `{"leadId":"L01"}`을 보내면 해당 리드의 `assessment`와 `workflow`를 받는다. 국가 회신 확인에는 지원 국가를 `country`로 함께 보낼 수 있다. 여러 리드는 요청별 응답이 도착하는 순서대로 화면과 저장소에 반영한다. 한 서버 프로세스에서 Liner 외부 요청은 최대 2개가 동시에 실행된다.

리드 판정(`/api/forwarding/assess`)은 `LINER_MODE=live`를 명시하고 키가 있을 때만 Liner를 쓴다. 일괄 판정 영상처럼 저장 결과를 재생하려면 `LINER_MODE=sample`로 실행한다. `details.sourceKind`는 실제 검색(`liner`), 서버 캐시(`cache`), 실제 검색과 캐시 혼합(`mixed`), 수동 검토한 공개 페이지와 저장 검색 결과(`curated`), 소속 없음처럼 외부 조사가 불필요한 내부 규칙(`local`)을 구분한다. 두 질의 모두 이번 요청에서 성공한 건만 `liner`와 `externalStatus=complete`가 함께 붙는다. 수동 검토한 공개 페이지에는 검토 기준일을, 저장 검색 결과에는 당시 검색 시각을 표시한다. 저장 자료가 없는 기관은 `saved-unavailable`이다. 두 질의가 정상 완료되고 기관 일치 근거가 없으면 미발견으로 판정한다. 저장 모드는 [공개 검색 기록](docs/qa/LINER_SAVED_NONMATCHES_2026-11-19.md)과 같은 기관명·국가 조합일 때만 검색 미발견을 재생한다. 검색 일부 또는 전체 실패는 `failed`로 표시한다.

정답 30건과의 혼동행렬은 출시 키 설정과 관계없이 로컬에서 저장 근거와 내부 규칙으로 검증할 수 있다.

```powershell
npm exec -- tsx scripts/evaluate-forwarding.ts
```

## 장면 6 딜러 결과 입력 (#30)

시연 입력 한 번으로 추천 순위가 바뀌도록 V MedSource의 가상 이력 `delivery-030`을 거래 성사에서 미성사로 바꿨다. 아래 행과 L03 점수 예시를 기획 문서에 반영하면 된다. [DEMO_DATA 딜러 표](https://github.com/stynerk/onemorestep/blob/1da2b587b393b4e627338fada671031965c12c41/docs/product/DEMO_DATA.md)

| 딜러 | 국가 | 최근 90일 전달 | deal | no deal | 진행 중 | 미응답 |
|---|---|---:|---:|---:|---:|---:|
| V MedSource | 미국 | 7 | 2 | 4 | 1 | 0 |

L03(Cleveland Clinic)을 승인 대기로 두면 V MedSource 0.333이 U Health Supply 0.300보다 앞선다. V MedSource의 진행 중 이력 `delivery-034`을 미응답으로 한 번 저장하면 U Health Supply 0.300이 V MedSource 0.233보다 앞선다. 딜러 7곳과 전달 41건을 유지한다.

- [기획 초안](docs/product/PLAN.md)
- [기술 구조·공수·위험](docs/tech/ARCHITECTURE.md)
- [Liner 공식 사양과 검증 상태](docs/tech/LINER_API.md)

## 테스트 수신함 메일 (#25)

HJ가 지정한 테스트 수신함과 발신 설정을 로컬 `.env.local`에 넣고 서버를 다시 실행한다.

- `TEST_MAIL_TO`에는 테스트 수신함 주소 하나를 적는다.
- `MAIL_FROM`에는 발신 전용 Gmail 주소, `GMAIL_APP_PASSWORD`에는 해당 계정의 앱 비밀번호를 적는다. 앱 비밀번호는 2단계 인증이 필요하다. [Gmail 앱 비밀번호 안내](https://support.google.com/mail/answer/185833)

메일 5종은 발송 직전에 수신함 제한을 검증한다. 설정이 없거나 SMTP가 실패하면 화면에 표시할 상태를 반환한다. 명시적인 실패는 사용자가 다시 시도할 수 있고, 전송 여부가 불명인 경우에는 테스트 수신함을 먼저 확인한다. 가상 리드의 이메일 앞부분은 가상이며, 가상 기관은 `example.com`이나 `.test` 같은 예약 도메인을 사용한다. 발송 기록과 로그에는 수신 주소나 인증 정보를 넣지 않는다.

화면 연결(#31)은 서버에서 처리한 업무 이벤트의 안정적인 ID와 리드 ID, 메일 종류를 `dispatchForwardingMail`에 전달하고 결과의 `event`를 기존 저장소에 반영한다. 재시도는 직전 실패의 기록 ID를 `retryOf`로 전달한다. 단일 사용자 로컬 서버의 `.forwarding-mail/` 기록은 새로고침과 재시작 뒤에도 유지된다. 브라우저 시연을 초기화하면 새 세션에서 새 업무 이벤트 ID를 사용한다. [Gmail SMTP 설정](https://support.google.com/mail/answer/7104828)과 [Nodemailer의 SMTP 전송 사양](https://nodemailer.com/smtp)을 사용한다.
