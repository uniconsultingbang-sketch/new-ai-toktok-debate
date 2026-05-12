# 2026-05-12 모바일 디자인 마무리

## 요청

- AI Talk Talk을 PC보다 모바일 시연 기준으로 최적화합니다.
- iPhone/Android 기종을 특정할 수 없으므로 360~430px 폭에서 화면이 꽉 차고 예쁘게 보이도록 확인합니다.
- 이전 프로젝트 이미지로 보이는 `ai-toktok-*`, `ai-council-*`, 개별 Claude/GPT/Gemini 이미지는 사용하지 않습니다.
- 화면 서비스명은 `AI Talk Talk`, PWA 설치 이름은 `AI Talk`으로 유지합니다.

## 반영

- 로그인, 홈, 토론방을 모바일 우선 레이아웃으로 정리했습니다.
- Pretendard 우선 서체, `100dvh`, safe-area 여백, 하단 입력창 고정감을 반영했습니다.
- Claude/GPT/Gemini 화자는 현재 CSS 기반 캐릭터와 말풍선형 배치로 표시합니다.
- Open Graph 이미지는 `/images/ai-talk-og.png`로 연결했습니다.
- PWA 아이콘은 `/images/ai-talk-icon-192.png`, `/images/ai-talk-icon-512.png`로 연결했습니다.
- PWA 설치 이름은 `AI Talk`, 화면/브라우저 서비스명은 `AI Talk Talk`으로 유지했습니다.
- 모바일 브라우저 테마 색을 새 보라색 계열 `#6A4CFF`로 맞췄습니다.

## 확인

- `npx.cmd tsc --noEmit` 통과.
- `npm.cmd run build` 통과.
- 로컬 production 화면에서 아래 모바일 크기를 확인했습니다.
  - 360x800
  - 375x667
  - 390x844
  - 412x915
  - 430x932
- 로그인 화면의 입력창/로그인 버튼이 하단에 잘리지 않는 것을 확인했습니다.
- 홈 화면의 로봇 영역, 입력창, 전송 버튼이 가로 넘침 없이 보이는 것을 확인했습니다.
- 토론방 말풍선과 화자 아이콘이 모바일 폭에서 가로 넘침 없이 배치되는 것을 확인했습니다.
- `/manifest.webmanifest`에서 `short_name`이 `AI Talk`으로 나오는 것을 확인했습니다.
- HTML metadata에서 `og:image`가 `/images/ai-talk-og.png`를 가리키는 것을 확인했습니다.

## 배포

- Vercel production 배포 확인 후 이 항목을 갱신합니다.

