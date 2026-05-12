# AI Talk Talk 프로젝트 핸드오프

작성일: 2026-05-12

이 문서는 다른 Codex 채팅방이 AI Talk Talk 프로젝트를 바로 이어받기 위한 기준 문서입니다.

현재 프로젝트는 PM 현황 관리, QA 테스트, 프론트 UIUX 개발, 어드민 개발, 로직/프론트 개발까지 총 5개 채팅방이 함께 작업합니다.

## 1. 프로젝트 기준

- 공식 서비스명: `AI Talk Talk`
- 서비스 설명: 3관점 논리 토론 서비스
- 프로젝트 위치: `C:\Users\unico\Documents\Codex\2026-05-07\new-ai-toktok-debate`
- GitHub: `https://github.com/uniconsultingbang-sketch/new-ai-toktok-debate.git`
- Vercel: `https://new-ai-toktok-debate.vercel.app/`
- 현재 기준 버전: `v0.5.2`

중요: GitHub/Vercel/폴더 이름의 `new-ai-toktok-debate`는 기존 연결을 유지하기 위한 기술용 이름입니다. 사용자에게 보이는 이름과 문서의 공식 이름은 `AI Talk Talk`입니다.

## 2. 다음 채팅방 첫 메시지

다른 채팅방을 열면 아래 내용을 그대로 붙여 넣어 주세요.

```text
프로젝트 위치:
C:\Users\unico\Documents\Codex\2026-05-07\new-ai-toktok-debate

먼저 아래 문서를 읽고 이어서 작업해줘.
- AGENTS.md
- PROJECT_HANDOFF.md
- docs/handoff/00-next-chat-handoff.md
- docs/handoff/09-final-recommendation-logic.md
- docs/handoff/10-project-naming-ai-talk-talk.md
- docs/handoff/11-design-chat-document-routing.md

이 프로젝트는 AI Talk Talk입니다.
사용자에게 보이는 서비스명은 AI Talk Talk으로 통일하고,
GitHub/Vercel/폴더 slug인 new-ai-toktok-debate는 기존 연결 보호용으로 유지해줘.
```

## 3. 현재 목표

AI Talk Talk은 사용자가 200자 이내로 적은 안건을 AI가 먼저 정리하고, Claude/GPT/Gemini가 실제 전문가 회의처럼 논리적으로 토론하는 서비스입니다.

핵심 방향:

- 새 스타일을 만들기보다 GPT 프로젝트 지침서의 토론 품질을 재현합니다.
- 심플 수다형, 카페형, 매콤한 농담형 흐름은 제거합니다.
- Claude는 낙관, GPT는 비관/회의, Gemini는 중간 관점을 맡습니다.
- 주제 정리는 별도 사회자가 담당합니다.
- 로테이션은 주제에 맞게 1~3회 적응형으로 진행합니다.
- 최종 판단은 `추천 / 조건부 추천 / 보류 / 비추천` 중 자연스럽게 선택합니다.

## 4. 현재 구현 상태

- 고정 3계정 로그인 구현 완료
- 같은 ID 중복 로그인 시 새 로그인 우선 처리
- 계정별 토론 기록 분리 완료
- Supabase 저장과 localStorage fallback 유지
- Vercel 배포 완료
- AI API 키와 Supabase 환경변수는 Vercel에 등록 완료
- 사용자 화면 이름은 `AI Talk Talk`으로 통일

## 5. 핵심 문서

- `docs/handoff/09-final-recommendation-logic.md`
  - 최종 판단이 항상 조건부 추천으로 쏠리지 않도록 만든 기준

- `docs/handoff/10-project-naming-ai-talk-talk.md`
  - 공식 이름과 기술 slug 유지 정책

- `docs/handoff/11-design-chat-document-routing.md`
  - 디자인 채팅방에 전달할 원본 문서 경로와 작업 범위 기준

- `docs/supabase-v0.5.0-owner-session.sql`
  - 계정별 기록 분리와 중복 로그인 차단에 필요한 Supabase SQL

- `docs/work-log/`
  - 채팅방별 변경 내역 기록

- `docs/chat-briefs/05-pm-status-chat-brief.md`
  - 5개 채팅방 전체 현황 관리와 담당 요청문 정리 기준

## 6. 주요 파일

- `components/DecisionDashboard.tsx`
  - 홈 화면, 안건 입력, 이전 토론 기록

- `components/StreamingDecisionView.tsx`
  - 토론 진행 화면, 말풍선, 최종 결론

- `app/api/debate/stream/route.ts`
  - 안건 해석, 사회자, 토론 생성, fallback, 최종 결론 생성

- `lib/decision-storage.ts`
  - Supabase/localStorage 저장, 계정별 기록 조회

- `lib/auth.ts`
  - 고정 계정 로그인, 세션 쿠키, 중복 로그인 판단

## 7. 검증 기준

작업 후 아래 검사를 기본으로 합니다.

```powershell
npx.cmd tsc --noEmit
npm.cmd run build
```

배포 후에는 Vercel production URL에서 확인합니다.

```text
https://new-ai-toktok-debate.vercel.app/
```

## 8. 주의할 점

- 관리자 화면은 별도 채팅방 담당입니다. 로직/프론트 채팅방에서 자동으로 건드리지 않습니다.
- PM 채팅방은 전체 현황과 우선순위를 정리하되, 구현 파일을 직접 수정하지 않습니다.
- `AGENTS.md`의 역할 구분을 먼저 확인합니다.
- 기존 저장 키, 쿠키 이름, 이미지 파일명은 기록과 배포 안정성을 위해 함부로 바꾸지 않습니다.
- 예시별 하드코딩은 금지합니다. 모든 토론과 fallback은 정리된 안건 데이터를 기준으로 처리합니다.

## 9. 사장님께 설명할 말

```text
AI Talk Talk은 사용자가 짧게 적은 안건을 AI가 먼저 정리한 뒤,
Claude, GPT, Gemini가 낙관, 비관, 중간 관점으로 실제 회의처럼 토론하는 서비스입니다.
현재는 3명만 로그인할 수 있고, 각자 자기 토론 기록만 보이도록 분리했습니다.
서비스 이름도 AI Talk Talk으로 통일했고, 기존 배포 주소는 깨지지 않게 유지했습니다.
```
