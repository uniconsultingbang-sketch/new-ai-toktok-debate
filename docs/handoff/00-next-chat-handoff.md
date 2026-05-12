# 다음 채팅방 인수인계: AI Talk Talk

작성일: 2026-05-12

## 한 줄 요약

AI Talk Talk은 사용자가 짧게 적은 안건을 사회자가 정리하고, Claude/GPT/Gemini가 낙관/비관/중간 관점으로 전문가 회의처럼 토론하는 서비스입니다.

현재 프로젝트는 PM 현황 관리, QA 테스트, 프론트 UIUX 개발, 어드민 개발, 로직/프론트 개발까지 총 5개 채팅방이 함께 작업합니다.

## 방실장님이 다음 채팅방에 붙여 넣을 메시지

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
사용자에게 보이는 이름은 AI Talk Talk으로 통일합니다.
GitHub/Vercel/폴더 slug인 new-ai-toktok-debate는 기존 연결 보호용으로 유지합니다.
```

## 프로젝트 위치

- 프로젝트 폴더: `C:\Users\unico\Documents\Codex\2026-05-07\new-ai-toktok-debate`
- GitHub: `https://github.com/uniconsultingbang-sketch/new-ai-toktok-debate.git`
- Vercel: `https://new-ai-toktok-debate.vercel.app/`

## 현재 구현 방향

- 공식 서비스명: `AI Talk Talk`
- 화면 설명: `3관점 논리 토론`
- 입력: 200자 이내 자연어 안건 1개
- 안건 정리: 별도 사회자
- 토론 참여자: Claude, GPT, Gemini
- 토론 방식: 주제에 따라 1~3회 적응형 로테이션
- 최종 판단: `추천 / 조건부 추천 / 보류 / 비추천`
- 로그인: 회원가입 없는 고정 3계정
- 기록: 로그인 ID별 분리

## 현재 완료된 것

- 심플 수다형/카페형/매콤한 농담형 흐름 제거
- 사회자 도입
- 예시별 하드코딩 제거
- 끊긴 AI 응답 보정과 오류 안내 강화
- 최종 판단 기준 정리
- 3계정 로그인과 중복 로그인 차단
- 계정별 이전 토론 기록 분리
- Vercel 배포와 Supabase 연결
- 사용자에게 보이는 이름을 `AI Talk Talk`으로 통일

## 주요 파일

- `AGENTS.md`
  - 방실장님 호칭, 채팅방 역할, 작업 로그 규칙

- `components/DecisionDashboard.tsx`
  - 홈 화면, 안건 입력, 이전 토론 기록

- `components/StreamingDecisionView.tsx`
  - 토론 화면, 말풍선, 최종 결론

- `app/api/debate/stream/route.ts`
  - 안건 해석, 토론 생성, fallback, 최종 결론

- `lib/decision-storage.ts`
  - Supabase/localStorage 기록 저장과 계정별 조회

- `lib/auth.ts`
  - 로그인과 세션 처리

## 개발팀 전달 문서

- `docs/handoff/09-final-recommendation-logic.md`
  - 최종 판단이 자연스럽게 나뉘도록 만든 기준

- `docs/handoff/10-project-naming-ai-talk-talk.md`
  - AI Talk Talk 공식 이름과 기술 slug 유지 정책

- `docs/handoff/11-design-chat-document-routing.md`
  - 디자인 채팅방에 전달할 원본 문서 경로와 작업 범위 기준

- `docs/supabase-v0.5.0-owner-session.sql`
  - 계정별 기록 분리와 중복 로그인 차단 SQL

## 확인 방법

로컬 실행:

```powershell
npm.cmd run dev -- -p 3010
```

로컬 주소:

```text
http://localhost:3010/
```

검사:

```powershell
npx.cmd tsc --noEmit
npm.cmd run build
```

배포 주소:

```text
https://new-ai-toktok-debate.vercel.app/
```

## 주의할 점

- 관리자 화면은 별도 채팅방 담당입니다. 이 채팅방에서 자동으로 건드리지 않습니다.
- PM 채팅방은 전체 현황과 우선순위를 정리하되, 구현 파일을 직접 수정하지 않습니다.
- 다른 채팅방 작업을 자동으로 알고 있다고 가정하지 않습니다.
- 작업 후 `docs/work-log`에 변경 내역을 남깁니다.
- 저장 키, 쿠키 이름, 이미지 파일명은 기존 기록 보호 때문에 함부로 바꾸지 않습니다.
- 사장님 시연용이므로 “보이는 결과”와 “실제 동작 확인”을 우선합니다.

## 사장님께 말할 수 있는 설명

```text
서비스 이름을 AI Talk Talk으로 통일했습니다.
사용자가 안건을 짧게 적으면 AI가 먼저 주제와 핵심 질문을 정리하고,
세 AI가 낙관, 비관, 중간 관점으로 실제 회의처럼 토론합니다.
현재는 3명만 로그인할 수 있고, 각자의 토론 기록도 분리되어 보입니다.
```
