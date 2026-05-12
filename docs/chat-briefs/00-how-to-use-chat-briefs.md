# AI Talk Talk 채팅방별 전달 문서 사용법

## 목적

Codex 채팅방끼리는 대화 내용을 자동으로 공유하지 않습니다.
그래서 각 채팅방이 같은 프로젝트 폴더 안의 전달 문서를 읽고 작업을 시작하게 만듭니다.

## 방실장님 사용법

새 채팅방을 만들 때 아래처럼 말합니다.

```text
방실장님이라고 불러줘.
이 채팅방은 AI Talk Talk 프로젝트의 [역할] 전용이야.

먼저 아래 문서를 읽고 그 지침대로 작업해줘.
[문서 경로]
```

## 채팅방별 문서

- PM 현황 관리: `docs/chat-briefs/05-pm-status-chat-brief.md`
- 디자인: `docs/chat-briefs/01-design-chat-brief.md`
- 어드민: `docs/chat-briefs/02-admin-chat-brief.md`
- 로직/프론트: `docs/chat-briefs/03-logic-front-chat-brief.md`
- QA: `docs/chat-briefs/04-qa-chat-brief.md`

## 중요한 규칙

- 작업 후 반드시 `docs/work-log`에 기록을 남깁니다.
- 다른 채팅방 작업을 자동으로 안다고 가정하지 않습니다.
- 같은 파일을 여러 채팅방이 동시에 수정하지 않도록 주의합니다.
- 최종 개발팀 전달 문서는 `docs/handoff`에 정리합니다.
