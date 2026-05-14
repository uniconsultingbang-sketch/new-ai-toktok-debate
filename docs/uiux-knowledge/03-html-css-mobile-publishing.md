# HTML CSS Mobile Publishing Notes

이 프로젝트의 UIUX 수정은 모바일 퍼블리싱 품질을 우선한다.

## 기본 원칙

- 모바일 폭 360~430px에서 먼저 설계한다.
- PC 화면은 이번 UIUX 판단의 1순위가 아니다.
- `max-width: 430px` 기준으로 앱 프레임을 잡고, 좌우 패딩을 균형 있게 유지한다.
- `box-sizing: border-box`를 전제로 폭 계산을 한다.

## 높이와 뷰포트

- 모바일 브라우저 주소창과 하단 바 때문에 `100vh`만 믿지 않는다.
- `100svh`, `100dvh`를 함께 검토한다.
- iPhone safe area와 Android 내비게이션 바에 가리지 않게 한다.

## 레이아웃

- 이미지 영역은 `aspect-ratio`로 비율을 고정한다.
- 이미지가 잘리면 `object-fit: contain`을 우선한다.
- 시안처럼 꽉 차야 할 때만 `cover`를 쓰고, 반드시 캡처로 잘림을 확인한다.
- `overflow-x: hidden`으로 문제를 숨기지 말고, 원인을 먼저 고친다.

## 타이포그래피

- Pretendard를 우선한다.
- 폰트 로딩이 불안정하면 로컬 폰트 파일을 사용한다.
- 모바일에서 제목이 한쪽으로 밀리거나 잘리면 폰트 크기보다 이미지/컨테이너 폭부터 확인한다.
- `letter-spacing`과 `line-height`를 생략하지 않는다.

## 폼과 버튼

- 입력창과 버튼은 터치하기 쉬워야 한다.
- 좌우 패딩, 아이콘 크기, placeholder 크기를 함께 본다.
- 버튼이 화면 밖으로 잘리면 높이보다 전체 레이아웃 밀도를 먼저 조정한다.

## 디버깅 체크

- CSS 파일이 200으로 로딩되는지 확인한다.
- 로그인 세션 때문에 `/login`이 `/`로 리다이렉트되는지 확인한다.
- 캡처 도구가 실제 모바일 CSS를 반영했는지 확인한다.
- DOM 스냅샷만 믿지 말고 실제 스크린샷을 본다.

## 참고 기준

- MDN CSS
  - https://developer.mozilla.org/en-US/docs/Web/CSS/length
  - https://developer.mozilla.org/en-US/docs/Web/CSS/env
  - https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit
  - https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio
  - https://developer.mozilla.org/en-US/docs/Web/CSS/clamp
- web.dev Learn Responsive Design
  - https://web.dev/learn/design
