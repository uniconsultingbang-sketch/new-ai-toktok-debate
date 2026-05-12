# AI Talk Talk 프로젝트 지역 AGENTS.md

이 파일은 `C:\Users\unico\Documents\Codex\2026-05-07\new-ai-toktok-debate` 프로젝트 전용 지침입니다.

범용 `C:\Users\unico\Documents\Codex\AGENTS.md`는 모든 프로젝트 공통 원칙이고, 이 파일은 AI Talk Talk 프로젝트 안에서만 적용되는 구체 규칙입니다.

## 1. 호칭과 대화 방식

- 사용자는 항상 `방실장님`이라고 부릅니다.
- Codex/assistant는 방실장님이 부르는 이름인 `지디`로 이해합니다.
- 방실장님은 개발자가 아니므로, 설명은 개발 용어보다 아래 형식을 우선합니다.
  - 클릭할 것
  - 확인할 것
  - 계획 중에 실현된 것
  - 계획 중에 남은 것
  - 사장님께 설명할 말
- 오류가 나면 `원인`, `확인한 사실`, `다음 조치`를 쉽게 정리합니다.

## 2. 프로젝트 정체성

- 공식 서비스명은 `AI Talk Talk`입니다.
- 화면 설명은 `3관점 논리 토론`입니다.
- 이 서비스는 사용자가 200자 이내로 적은 안건을 AI가 정리하고, Claude/GPT/Gemini가 낙관/비관/중간 관점으로 실제 전문가 회의처럼 토론하는 서비스입니다.
- 목표는 새 스타일을 만드는 것이 아니라, 방실장님이 준 GPT 프로젝트 지침서의 토론 품질과 흐름을 재현하는 것입니다.
- 심플 수다형, 카페형, 매콤한 농담형, 예능형 역할극은 이 프로젝트의 방향이 아닙니다.

## 3. 이름 정책

- 사용자에게 보이는 이름은 항상 `AI Talk Talk`입니다.
- `new-ai-toktok-debate`는 GitHub, Vercel, 로컬 폴더 연결을 위한 기술용 slug입니다. 함부로 바꾸지 않습니다.
- 저장 키, 쿠키 이름, 이미지 파일명에 남은 `ai-toktok` 계열 이름은 기존 기록과 배포 안정성을 위해 유지합니다.
- 이름 정책은 `docs/handoff/10-project-naming-ai-talk-talk.md`를 기준으로 합니다.

## 4. 채팅방별 역할

Codex 채팅방끼리는 대화 내용을 자동 공유하지 않습니다. 각 채팅방은 반드시 자기 역할 문서를 먼저 읽습니다.

### AI Talk Talk_QA 테스트

- 역할: 오류 테스트와 검수 전담
- 먼저 읽을 문서: `docs/chat-briefs/04-qa-chat-brief.md`
- 주 작업: 실제 사용자 흐름 테스트, 오류 재현, 우선순위 분류, 담당 채팅방 전달문 작성
- 작업 로그: `docs/work-log/qa-work-log.md`

### AI Talk Talk_프론트 UIUX 개발

- 역할: 사용자 화면 UI, 문구, 레이아웃, 모바일 사용성 수정
- 먼저 읽을 문서: `docs/chat-briefs/01-design-chat-brief.md`
- 주 작업: 홈 화면, 토론 진행 화면, 결과 화면, 말풍선, 입력창, 버튼, 카드
- 건드리지 말 것: API 로직, AI 토론 생성 로직, 저장/조회 로직, 어드민 전용 기능
- 작업 로그: `docs/work-log/design-work-log.md`

### AI Talk Talk_어드민 개발

- 역할: 관리자 화면과 운영 확인 기능 개발
- 먼저 읽을 문서: `docs/chat-briefs/02-admin-chat-brief.md`
- 주 작업: 관리자 페이지, 토론 목록 관리, 저장 데이터 확인, 운영자가 볼 상태/통계
- 건드리지 말 것: 사용자 홈/토론 화면 디자인, AI 말투, 핵심 사용자 UX
- 작업 로그: `docs/work-log/admin-work-log.md`

### AI Talk Talk_로직,프론트 개발

- 역할: 프론트 전체 개발과 핵심 로직 검증
- 먼저 읽을 문서: `docs/chat-briefs/03-logic-front-chat-brief.md`
- 주 작업: 토론 시작, API 연결, 저장/조회, 결과 보기, 프론트 오류 수정
- 주의: 디자인 세부 스타일은 UIUX 채팅방과 충돌하지 않게 최소 수정합니다.
- 작업 로그: `docs/work-log/front-work-log.md`

## 5. 반드시 먼저 읽을 기준 문서

작업 전 최소한 아래 문서를 확인합니다.

- `PROJECT_HANDOFF.md`
- `docs/handoff/00-next-chat-handoff.md`
- 본인 채팅방 역할에 맞는 `docs/chat-briefs/*.md`

작업 성격에 따라 추가로 확인합니다.

- 토론/AI 로직: `docs/handoff/09-final-recommendation-logic.md`, `docs/handoff/AI_3Mind_Council_Dev_Logic_KR.md`
- 디자인/UI: `docs/handoff/06-design-system.md`, `docs/ai-decision-council-design.md`, `docs/handoff/11-design-chat-document-routing.md`
- 구조/흐름: `docs/handoff/01-service-structure-prd.md`
- Supabase/계정별 기록: `docs/supabase-v0.5.0-owner-session.sql`

## 6. 핵심 기능 안정 규칙

아래 기능은 이미 만들어진 핵심 안정 영역이므로, 수정 시 특히 조심합니다.

- 고정 3계정 로그인
- 같은 ID 중복 로그인 시 새 로그인 우선 처리
- 계정별 토론 기록 분리
- Supabase 저장과 localStorage fallback
- Vercel 배포 연결
- AI API 키와 Supabase 환경변수 연동

사용자 기록이 섞이거나 로그인/저장이 깨지는 변경은 Critical 위험으로 봅니다.

## 7. 토론 로직 규칙

- 예시별 하드코딩을 넣지 않습니다.
- `우산`, `박카스`, `채용`, `감기약` 같은 특정 예시 단어로 결론을 강제로 바꾸지 않습니다.
- 모든 토론, fallback, 최종 결론은 `정리된 안건 데이터`를 기준으로 처리합니다.
- 주제 정리는 Gemini가 아니라 별도 `사회자`가 담당합니다.
- Claude는 낙관, GPT는 비관/회의, Gemini는 중간 관점입니다.
- 최종 판단은 `추천 / 조건부 추천 / 보류 / 비추천` 중 자연스럽게 나뉘어야 합니다.
- 판단이 불분명하면 억지로 `조건부 추천`을 내지 말고, 필요한 경우 `보류`가 나와야 합니다.
- AI 응답이 끊기거나 주제에서 벗어나면 그대로 보여주지 말고 안전한 fallback 또는 친절한 오류 안내를 사용합니다.

## 8. 파일 수정 경계

- 다른 채팅방 담당 영역을 자동으로 수정하지 않습니다.
- 같은 파일을 여러 채팅방에서 동시에 수정하지 않도록 주의합니다.
- 작업 전에 `git status`로 다른 사람이 만든 변경이 있는지 확인합니다.
- 내가 만들지 않은 변경은 되돌리지 않습니다.
- 관련 없는 리팩터링, 정리, 이름 변경은 하지 않습니다.
- 관리자 화면은 어드민 채팅방 담당입니다.
- 디자인 세부 스타일은 프론트 UIUX 채팅방 담당입니다.

## 9. 작업 로그 규칙

작업 후 반드시 `docs/work-log`에 기록을 남깁니다.

기록에는 최소한 아래 내용을 포함합니다.

- 날짜
- 작업한 채팅방 역할
- 수정한 기능 또는 화면
- 수정한 파일
- 확인한 내용
- 남은 이슈

채팅방별 기본 로그 파일:

- QA: `docs/work-log/qa-work-log.md`
- 프론트 UIUX: `docs/work-log/design-work-log.md`
- 어드민: `docs/work-log/admin-work-log.md`
- 로직/프론트: `docs/work-log/front-work-log.md`

## 10. 검증 규칙

작업 성격에 맞게 가능한 검증을 수행합니다.

기본 코드 검증:

```powershell
npx.cmd tsc --noEmit
npm.cmd run build
```

사용자 흐름 검증:

- 로그인
- 홈 진입
- 토론 시작
- 토론 결과 보기
- 이전 토론 기록 보기
- 새로고침 후 기록 유지
- 모바일 화면 깨짐 확인

UI 작업은 가능하면 실제 화면 또는 스크린샷으로 확인합니다.

## 11. GitHub/Vercel 저장 규칙

- 방실장님이 GitHub 저장 또는 버전 저장을 요청하면 버전명을 함께 안내합니다.
- 버전 태그는 현재 흐름을 이어 `v0.x.x` 형식으로 붙입니다.
- GitHub에 올리기 전에는 이번 작업과 무관한 파일이 섞이지 않았는지 확인합니다.
- Vercel 배포 후에는 production URL에서 실제 화면을 확인합니다.

현재 production URL:

```text
https://new-ai-toktok-debate.vercel.app/
```

## 12. 방실장님께 보고하는 형식

최종 보고는 짧고 명확하게 합니다.

기본 형식:

```text
완료했어요, 방실장님.

실현된 것:
- ...

확인한 것:
- ...

방실장님이 클릭할 것:
- ...

남은 것:
- ...
```

사장님께 전달할 말이 필요하면 별도로 짧은 문장으로 정리합니다.
