# AI Talk Talk 동적 3관점 토론 화면 UIUX 전달 문서

작성일: 2026-05-14  
작성 채팅방: AI Talk Talk_UIUX 개발 C  
전달 대상: 로직/프론트 개발 채팅방

## 목적

새 토론 화면을 방실장님이 전달한 이미지 기준으로 설계합니다.

이번 문서는 실제 앱 구현 지시가 아니라, 프론트 개발 채팅방이 화면을 만들 때 참고할 UIUX 구조와 정적 HTML 시안입니다.

정적 HTML 시안:

```text
docs/chat-briefs/07-uiux-c-dynamic-perspective-preview.html
```

## 절대 건드리지 않을 범위

- 기존 로그인 화면
- 저장/조회 로직
- Supabase 연결
- API 키와 환경변수
- Vercel 배포 설정
- 인증/쿠키/권한 로직
- 기존 토론 생성 로직의 데이터 저장 구조

## 화면 방향

- 모바일 우선 화면입니다.
- 기준 폭은 360px, 390x844, 412x915, 430x932입니다.
- 화면 톤은 이미지처럼 밝은 화이트/라벤더 배경, 부드러운 카드, 둥근 버튼, 얇은 경계선, 파스텔 AI 색상으로 맞춥니다.
- 일반 SaaS 대시보드 느낌보다, “AI 친구들이 회의실에서 분석 카드를 보여주는 모바일 앱” 느낌을 우선합니다.

## 화면 구조

### 1. 상단 네비게이션

구성:

- 왼쪽: 뒤로가기 버튼
- 중앙: `AI Talk Talk` + `Beta`
- 오른쪽: 더보기 버튼

프론트 구현 참고:

- 버튼은 44~48px 정사각형 터치 영역을 유지합니다.
- 모바일에서 브랜드명이 줄바꿈되면 안 됩니다.

### 2. 주제 정리 카드

구성:

- `주제 정리` 라벨
- 큰 안건 제목
- 완료 상태 pill
- 한 줄 설명
- 핵심 질문
- 토론 목적
- 토론 관점
- 참여 AI pill: 사회자, Claude, GPT, Gemini

핵심 UX:

- 사회자가 사용자의 안건을 먼저 정리합니다.
- `토론 관점`은 고정 문구가 아니라 주제에 맞춰 동적으로 정합니다.
- 예: 비용 관점, 고객 관점, 시장/비즈니스 관점

### 3. 3 관점 토론 영역

구성:

- 섹션 제목: `3 관점 토론`
- 우측 보조 버튼: `토론 요약 보기`
- 사회자 안내 말풍선
- Claude 분석 카드
- GPT 분석 카드
- Gemini 분석 카드

각 AI 카드 필수 구성:

- AI 이름
- 배정된 관점명
- 장점
- 단점
- 인사이트 영역

카드 색상 제안:

- Claude: 오렌지 계열
- GPT: 민트/그린 계열
- Gemini: 보라/블루 계열
- 사회자: 크림/베이지 계열

### 4. 종합 결론 영역

구성:

- `종합 결론`
- 결론 문단
- `핵심 제안`
- 번호형 제안 3개

핵심 UX:

- 각 AI 카드의 분석이 끝난 뒤 마지막에 결론이 한 번에 정리되어야 합니다.
- 결론은 보고서처럼 딱딱하지 않게, 모바일에서 바로 읽을 수 있는 짧은 문단 중심으로 보여줍니다.

## 데이터 구조 제안

프론트 개발 시 아래 형태로 화면 데이터를 연결하면 됩니다.

```ts
type DynamicPerspectiveDebateView = {
  title: string;
  subtitle: string;
  status: "running" | "completed" | "failed";
  moderatorSummary: {
    coreQuestion: string;
    purpose: string;
    perspectives: string[];
  };
  participants: Array<{
    id: "moderator" | "claude" | "gpt" | "gemini";
    label: string;
  }>;
  moderatorMessage: string;
  aiCards: Array<{
    speaker: "claude" | "gpt" | "gemini";
    perspectiveName: string;
    pros: string[];
    cons: string[];
    insight: string;
  }>;
  finalSummary: string;
  keyProposals: string[];
};
```

## 구현 시 주의할 점

- `비용 관점`, `고객 관점`, `시장/비즈니스 관점`은 예시입니다. 특정 단어로 고정하지 말고 사회자/로직이 주제에 맞춰 3개 관점을 정해야 합니다.
- Claude/GPT/Gemini 이름은 유지하되, 각 AI가 맡는 관점명은 주제별로 바뀔 수 있어야 합니다.
- 장점/단점/인사이트가 비어 있으면 카드가 깨지지 않게 빈 상태 문구가 필요합니다.
- 긴 문장은 카드 밖으로 나가지 않게 줄바꿈해야 합니다.
- 360px 폭에서 인사이트 박스가 오른쪽에 따로 붙기보다 아래로 내려가는 구조가 안전합니다.
- 720px 이상 넓은 화면에서는 장점/단점과 인사이트를 좌우 2열로 보여줘도 됩니다.

## QA 확인 요청

모바일 사이즈:

- 360x800
- 390x844
- 412x915
- 430x932

확인할 흐름:

- 토론 결과 화면 진입
- 주제 정리 카드 확인
- 사회자 메시지 확인
- Claude/GPT/Gemini 각 카드 확인
- 장점/단점/인사이트 긴 문장 줄바꿈 확인
- 종합 결론과 핵심 제안 확인
- 뒤로가기 버튼 터치 영역 확인
- 더보기 버튼 터치 영역 확인

## 프론트 개발 채팅방에 전달할 말

```text
AI Talk Talk 새 토론 화면은 사회자가 먼저 안건을 정리하고, 주제에 맞춰 3개 관점을 동적으로 정한 뒤 Claude/GPT/Gemini가 각 관점별 분석 카드를 보여주는 구조입니다.

정적 HTML 시안:
docs/chat-briefs/07-uiux-c-dynamic-perspective-preview.html

필수 카드 구조:
- 관점명
- 장점
- 단점
- 인사이트

마지막 영역:
- 종합 결론
- 핵심 제안 3개

주의:
- 로그인, 저장/조회, Supabase, API 키, 배포 설정은 건드리지 않습니다.
- 특정 예시 관점을 하드코딩하지 말고, 주제에 맞춰 3개 관점이 바뀌도록 연결합니다.
- 모바일 360~430px에서 먼저 확인합니다.
```
