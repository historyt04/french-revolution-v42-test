# Supabase 학생 시험판 — 단계 1

독립 입구: `supabase-student.html`
새 함수: `supabase/functions/history-trial-api/index.ts`
새 SQL: `supabase/migrations/202609190005_student_trial.sql`

기존 `index.html`, GAS 연결, 교사 화면, `history-api`, 속도 시험 파일은 이번 작업에서 수정하지 않는다.
새 `trial_*` 테이블에만 게임 기록·보상·카드를 저장한다. 이전 속도 시험의 보상 수령 여부와도 독립적이다.
홍길동 시험 계정(`legacy_id = TEST-2026-2-4-4`)만 사용 가능. 실제 학생 배포/데이터 이전은 아직 하지 않는다.

## 설치 순서

1. 기존 001~004 적용 상태에서 005 SQL 전체를 SQL Editor의 새 쿼리에 붙여넣고 Run.
   성공 결과: `trial_questions = 12`, `trial_version = student-trial-1`.
2. Edge Functions에서 **기존 history-api는 보존**하고 새 `history-trial-api` 생성.
   해당 폴더의 `index.ts` 전체를 붙여넣고 배포.
3. 새 함수만 legacy JWT 검증을 끈다. 이 함수는 DB 안에서 자체 학생 세션을 검증한다.
   기존 `HISTORY_SERVICE_KEY` secret을 재사용한다. 어떤 키도 브라우저 파일에 넣지 않는다.
4. `supabase-student.html`에서 학교/2026/2/4/4/12345로 시험한다.

## 동작과 안전 범위

- 로그인은 5자리 코드+학교/학년/반/번호. 해시 대조. 기기에는 코드가 아닌 만료되는 세션만 보관.
- 같은 계정의 로그인 시도는 DB에서 15분당 20회 제한. 실제 학생 적용 전 IP별 제한,
  잠금 복구, 개인정보 보존 정책, 교사 권한·기관별 분리의 별도 검토 필요.
- 시작 1회에 순서가 정해진 12문항을 받음. 정답·오답 확인/다음 문제는 서버 요청 없음.
- 두 번 오답이면 정답 안내 후 다음 문제, 마지막에 재도전. 첫 글자 힌트 표시.
- 완료 시 순서대로 제출된 답안을 DB가 재채점. 클라이언트의 정답 수/보상량은 신뢰하지 않음.
- 문제 스냅샷을 시작 기록에 보관. 중간 클릭·화면 노출·다음 문제 로그는 서버에 개별 저장하지 않음.
- 최소 15초, 최대 24시간의 시험 완료 범위. 이 값은 공식 순위 검증 수단이 아님.
- **로컬 정답이 공개되므로 자동 답안 생성/대리 풀이를 완전히 막을 수 없다.**
  재채점은 무효·불완전 답안을 막는 장치이며 실제 사람이 풀었다는 증명이 아니다.
  모든 시험 완료는 `official:false`. 공식 순위/스피드런은 별도 검증 설계 후 이전.
- 학생별 행 잠금+고유 보상 키+동일 요청 영수증으로 완료·팩 소모를 트랜잭션 처리.
  모든 학생이 공유하는 전역 잠금 없음. 같은 요청 재시도는 같은 개봉 결과를 반환.
- 네트워크 응답 유실 시 제출 대기 요청을 sessionStorage에 보관하고 동일 ID로 재시도.
  풀던 문제 중간 저장/복구와 별개이며, 중단한 미완료 풀이는 복원하지 않음.
- 재접속 때 완료 기록/최근 개봉/도감은 서버에서 확인. UI 공개 효과는 보상을 다시 지급하지 않음.
- 처음 초급 완료시 시험팩 1개. 팩은 기존 일반팩 기본 등급 확률 70/23/6/0.9/0.1%를 사용.
  이로치 1%는 **시험용**이며 기존 교사 설정을 이전한 것이 아님.
- 현재 카드 12사건×5등급 시험 도감. 기존 70칸/8종팩/효과/천장/합성/미션/교사 설정은 후속 이전.

## 검증

`npm install --prefix /tmp/history-trial-test @electric-sql/pglite@0.5.8 jsdom@26.1.0`

```sh
HISTORY_TEST_DEPS=/tmp/history-trial-test node --test tests/trial.test.mjs
HISTORY_TEST_DEPS=/tmp/history-trial-test node --experimental-vm-modules --test tests/trial-ui.test.mjs
```

실제 SQL을 PostgreSQL WASM(PGlite)으로 실행하며 UI는 DOM 환경에서 같은 SQL과 통합 검사한다.
중복 호출 검사는 포함하지만 PGlite는 단일 연결이므로 다중 DB 연결의 잠금 경합이나
학급 동시접속 성능이 검증된 것은 아니다. 배포 후 실제 Supabase 시험을 반드시 수행한다.

## 다음 단계 / 인계

현재: 초급 연결 슬라이스 구현, Supabase에 새 SQL/함수 배포 대기.
다음: 배포 확인 → 실제 기기에서 로그인/풀이/완료/개봉 시간 검증 → 교사 보상 설정/전체 카드 체계 이식 → 나머지 게임 → 교사 화면.
최종 디자인은 승인된 이미지를 다시 열어 확인한 후 적용. 이 시험 화면은 최종 디자인이 아니다.
역사①의 대·중·소단원과 `학습하기 / 게임하기` 구조 및 최근 단원 바로가기는 후속 통합 단계.
모든 UI·권한·카드 규칙을 옮기기 전 기존 주소를 새 시험판으로 전환하지 않는다.

구현 참고: https://supabase.com/docs/guides/database/functions
서버 함수 인증: https://supabase.com/docs/guides/functions/auth
