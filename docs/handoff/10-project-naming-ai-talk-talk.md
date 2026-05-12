# AI Talk Talk 이름 정책

작성일: 2026-05-12

## 결론

사용자에게 보이는 공식 서비스명은 `AI Talk Talk`으로 통일합니다.

`3관점 논리 토론`은 서비스명이 아니라 기능 설명으로 사용합니다.

## 바꾼 대상

- 브라우저 제목과 앱 metadata
- PWA manifest 이름
- 로그인 화면 제목
- 홈 화면 브랜드 영역
- 404 화면 표시 이름
- PWA 설치 안내 문구
- README와 핸드오프 문서
- package 이름

## 유지하는 대상

아래 이름은 기존 연결과 저장 기록 보호를 위해 당장 바꾸지 않습니다.

- GitHub repository slug: `new-ai-toktok-debate`
- Vercel project/domain slug: `new-ai-toktok-debate`
- 로컬 폴더명: `new-ai-toktok-debate`
- 쿠키 이름: `new_ai_toktok_session`
- localStorage 키: `newAiToktokProfessorDebates`
- 기존 이전 프로젝트 이미지 파일명: `ai-toktok-*`

이 값들은 사용자에게 거의 보이지 않는 내부 식별자입니다. 바꾸려면 별도 마이그레이션 계획이 필요합니다.

단, `ai-toktok-*` 이미지 파일은 이전 프로젝트 이미지로 확인되어 2026-05-12 디자인 작업에서 제거했습니다. 현재 앱 아이콘과 공유 이미지는 `ai-talk-*` 파일을 사용합니다.

## 개발팀 전달 기준

- 새 화면, 문서, 안내문에서는 `AI Talk Talk`을 사용합니다.
- `AI 톡톡`, `new AI 톡톡 토론`, `AI 3-Mind Council`은 과거 기준 또는 참고 문서에서만 남길 수 있습니다.
- 과거 참고 문서가 필요할 때도 “현재 공식 이름은 AI Talk Talk”이라고 명시합니다.
- 예전 이름이 들어간 저장 키나 URL은 기능 안정성을 먼저 보고 변경합니다.

## 방실장님께 설명할 말

```text
사용자가 보는 서비스명은 AI Talk Talk으로 통일했습니다.
다만 GitHub와 Vercel 주소처럼 이미 연결된 내부 이름은 바꾸면 배포와 저장 기록이 흔들릴 수 있어서 유지했습니다.
보이는 이름은 정리됐고, 내부 이름 변경은 나중에 별도 작업으로 진행하는 것이 안전합니다.
```
