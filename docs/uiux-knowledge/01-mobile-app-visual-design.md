# Mobile App Visual Design Notes

AI Talk Talk은 PC보다 모바일 시연이 우선인 앱이다.

## 모바일 화면 기준

- 기본 기준: 390x844
- 작은 안드로이드 기준: 360x800
- 큰 모바일 기준: 412x915, 430x932
- 모든 핵심 UI는 360px 폭에서도 잘리지 않아야 한다.

## 모바일 앱처럼 보이는 조건

- 화면 첫 인상에서 브랜드, 캐릭터, 입력 흐름이 바로 보여야 한다.
- 좌우 여백은 같은 무게로 보여야 한다.
- 버튼과 입력창은 손가락으로 누르기 편한 크기여야 한다.
- 텍스트는 작게 줄여서 욱여넣지 않는다.
- 이미지가 커도 화면 밖으로 잘리면 실패다.
- 카드와 그림자는 이미지 원본의 조명과 충돌하지 않아야 한다.

## 여백과 밀도

- 모바일은 PC보다 여백이 민감하다.
- 상단 로고와 서브카피 사이, 서브카피와 이미지 사이, 이미지와 입력창 사이의 리듬이 중요하다.
- 입력창과 버튼은 너무 크면 무겁고, 너무 작으면 싸 보인다.
- 로고, 캐릭터, 버튼 중 하나만 과하게 크면 전체가 무너진다.

## 이미지 사용

- 기준 이미지가 있으면 CSS 장식보다 이미지 원본의 질감을 우선한다.
- `object-fit: contain`을 기본으로 검토한다.
- `aspect-ratio`로 이미지 영역을 고정해 기기별 흔들림을 줄인다.
- 이미지 자체에 배경이 있으면 CSS 배경과 그림자를 추가하지 않는다.
- 투명 PNG라도 실제 픽셀 안에 배경 그라데이션이 들어 있는지 확인한다.

## 터치와 접근성

- 주요 버튼은 최소 44px 이상으로 둔다.
- 텍스트 입력창은 터치하기 쉬워야 하고, 키보드가 올라와도 흐름이 무너지지 않아야 한다.
- 아이콘만 있는 버튼은 의미가 분명해야 한다.

## 참고 기준

- Apple Human Interface Guidelines
  - https://developer.apple.com/design/human-interface-guidelines/layout
  - https://developer.apple.com/design/human-interface-guidelines/typography
- Material Design 3
  - https://m3.material.io/foundations/layout/overview
  - https://m3.material.io/foundations/typography/overview
  - https://m3.material.io/components/buttons/overview
  - https://m3.material.io/components/text-fields/overview
- WCAG 2.2
  - https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
  - https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  - https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
