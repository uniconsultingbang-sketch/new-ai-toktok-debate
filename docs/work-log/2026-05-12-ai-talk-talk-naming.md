# 2026-05-12 AI Talk Talk 이름 통일

## 버전

- `v0.5.2`

## 변경 내용

- 사용자에게 보이는 공식 서비스명을 `AI Talk Talk`으로 통일했습니다.
- 브라우저 metadata, PWA manifest, 로그인 화면, 홈 화면 브랜드, 404 화면, PWA 설치 안내 문구를 정리했습니다.
- README와 핸드오프 문서를 현재 배포/로그인/기록 분리 상태에 맞게 다시 정리했습니다.
- 개발팀 전달용 이름 정책 문서 `docs/handoff/10-project-naming-ai-talk-talk.md`를 추가했습니다.

## 유지한 것

- GitHub/Vercel/폴더 slug `new-ai-toktok-debate`는 기존 연결 보호를 위해 유지했습니다.
- 쿠키, localStorage 키, 이미지 파일명에 남은 `ai-toktok` 계열 내부 이름은 저장 기록과 배포 안정성을 위해 유지했습니다.
- 관리자 화면 관련 untracked 파일은 별도 채팅방 영역으로 보고 이번 작업에 포함하지 않았습니다.

## 확인할 것

- 로그인 화면 제목이 `AI Talk Talk 로그인`으로 보이는지 확인합니다.
- 홈 화면 브랜드가 `AI Talk Talk`으로 보이는지 확인합니다.
- Vercel 배포 후 production URL에서 정상 로그인되는지 확인합니다.
