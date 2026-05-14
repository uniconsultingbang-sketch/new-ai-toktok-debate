# AI Talk Talk 디자인 채팅방 전달 문서

## 이 채팅방의 역할

이 채팅방은 AI Talk Talk 프로젝트의 디자인 수정 전용 채팅방입니다.

## 먼저 읽을 문서

- `AGENTS.md`
- `PROJECT_HANDOFF.md`
- `docs/ai-decision-council-design.md`
- `docs/handoff/06-design-system.md`
- `docs/work-log/design-work-log.md`가 있으면 함께 확인

## 작업 범위

- 모바일 UI
- 화면 문구
- 카드, 버튼, 입력창, 말풍선
- 홈 화면, 토론 진행 화면, 결과 화면의 시각적 완성도
- 카카오톡처럼 가볍고 귀여운 톤 유지

## 핵심 디자인 역할

이번 디자인 채팅방의 작업은 일반 웹 UI 구현이 아니라 `Image-to-UI Reconstruction Task`입니다.

첨부 이미지를 단순 참고자료로 보지 말고, 시안 원본에 가깝게 보고 모바일 화면에서 픽셀 감성과 디자인 밀도를 최대한 복원합니다.

현재 필요한 것은 프론트엔드 개발 능력보다 비주얼 복원 능력입니다.

반드시 아래 디자인 스킬을 적용합니다.

- visual density matching
- soft shadow recreation
- premium spacing analysis
- clay-style depth recreation
- lighting-aware UI styling
- image-based typography matching
- visual balance preservation
- mobile app visual polish
- emotional UI recreation

금지합니다.

- Tailwind default 느낌
- shadcn 기본 카드 스타일
- 일반 SaaS 대시보드 느낌
- 단순 `rounded-xl + shadow-md` 조합
- 엔지니어식 단순 구현

목표는 첨부 이미지와 최대한 유사한 감성의 모바일 앱 UI 복원입니다.

## 건드리지 말 것

- API 로직
- AI 토론 생성 로직
- 저장/조회 로직
- 어드민 전용 기능

## 작업 후 반드시 남길 기록

`docs/work-log/design-work-log.md`에 아래 내용을 정리합니다.

- 수정한 화면
- 수정한 파일
- 확인한 내용
- 남은 디자인 이슈

## 방실장님께 보고할 형식

- 클릭할 것
- 확인할 것
- 계획 중에 실현된 것
- 계획 중에 남은 것

## UIUX 필수 자체 검수 프로세스

디자인 채팅방은 방실장님께 말하기 전에 아래 순서를 반드시 지킵니다.

1. UI를 수정합니다.
2. 모바일 기준 화면을 직접 열어 스크린샷을 찍습니다.
3. 방실장님이 준 기준 이미지와 스크린샷을 비교합니다.
4. 기준 이미지와 다른 부분이 보이면 다시 수정합니다.
5. 다시 스크린샷을 찍고 자체 검수를 반복합니다.
6. 자체 검수까지 끝난 뒤에만 방실장님께 결과를 보고합니다.

특히 로그인, 홈, 토론방처럼 시각 품질이 중요한 화면은 단순 구현 완료가 아니라 이미지 복원도와 모바일 실사용 화면 균형을 기준으로 완료 여부를 판단합니다.

## UIUX 지식 파일

디자인 작업 전에는 아래 폴더를 기준으로 확인합니다.

- `docs/uiux-knowledge/README.md`
- `docs/uiux-knowledge/00-uiux-work-process.md`
- `docs/uiux-knowledge/01-mobile-app-visual-design.md`
- `docs/uiux-knowledge/02-copywriting-content-design.md`
- `docs/uiux-knowledge/03-html-css-mobile-publishing.md`
- `docs/uiux-knowledge/04-screenshot-review-checklist.md`
