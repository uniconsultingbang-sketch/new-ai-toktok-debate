# 다음 채팅방 인수인계: new AI 톡톡 토론

작성일: 2026-05-12

## 한 줄 요약

이 프로젝트는 기존 AI 톡톡을 건드리지 않고 따로 만든 사장님용 심층 토론 버전입니다. 배포하지 말고 로컬에서만 이어서 작업합니다.

## 방실장님이 다음 채팅방에 붙여 넣을 메시지

```text
프로젝트 위치:
C:\Users\unico\Documents\Codex\2026-05-07\new-ai-toktok-debate

먼저 아래 문서를 읽고 이어서 작업해줘.
- PROJECT_HANDOFF.md
- docs/handoff/00-next-chat-handoff.md
- docs/handoff/09-final-recommendation-logic.md

이 프로젝트는 사장님용 new AI 톡톡 토론입니다.
기존 AI 톡톡(new-chat)은 건드리지 말고, 로컬에서만 교수단 심층 토론 버전을 이어서 다듬어줘.
배포는 아직 하지 마.
```

## 프로젝트 위치

- 새 프로젝트: `C:\Users\unico\Documents\Codex\2026-05-07\new-ai-toktok-debate`
- 기존 AI 톡톡: `C:\Users\unico\Documents\Codex\2026-05-07\new-chat`

중요: 기존 AI 톡톡은 방실장님과 지디가 계속 수정할 프로젝트입니다. 다음 채팅방에서는 `new-chat`을 수정하지 않습니다.

## 실행 방법

로컬 서버:

```powershell
npm.cmd run dev -- -p 3010
```

브라우저 주소:

```text
http://localhost:3010/
```

필요하면 먼저 설치:

```powershell
npm.cmd install
```

검사:

```powershell
npx.cmd tsc --noEmit
npm.cmd run build
```

## 현재 구현 방향

- 앱명: `new AI 톡톡 토론`
- 목적: 사장님용 심층 토론
- 톤: 교수단 심층 검토
- 모드: 심층 토론 전용
- 농담/매콤함: 꺼짐
- 저장: 브라우저 localStorage
- 배포: 아직 안 함

## 현재 핵심 로직

홈에서 토론을 시작하면 항상 아래 값으로 저장됩니다.

```ts
discussionDepth: "deep"
councilMode: "role_based"
banterLevel: "off"
rebuttalRotations: 2
focusAreas: ["전제", "근거", "리스크", "실행"]
```

API에서도 다시 한 번 강제합니다.

- 클라이언트가 `simple`을 보내도 `deep`으로 처리합니다.
- 클라이언트가 `spicy`를 보내도 `off`로 처리합니다.
- 클라이언트가 `open_debate`를 보내도 `role_based`로 처리합니다.

교수단 역할:

- Claude 교수: 가능성과 인간 맥락
- GPT 교수: 전제, 비용, 리스크 비판 검증
- Gemini 교수: 종합 판단과 기준 제시

## 주요 파일

- `components/DecisionDashboard.tsx`
  - 홈 화면
  - 심층 토론 입력 폼
  - 최근 심층토론 목록

- `components/StreamingDecisionView.tsx`
  - 결과 화면
  - 교수단 발언
  - 최종 판단 표시

- `app/api/debate/stream/route.ts`
  - 토론 생성 로직
  - 교수단 프롬프트
  - fallback 토론
  - 최종 판단 생성

- `lib/decision-storage.ts`
  - localStorage 저장/조회
  - 저장 키: `newAiToktokProfessorDebates`

- `app/layout.tsx`
  - 앱 metadata
  - PWA 설치 팝업 제거

- `app/manifest.ts`
  - 앱 이름과 설명

## 확인된 것

- TypeScript 검사 통과
- production build 통과
- `http://localhost:3010/` 홈 화면 로드 확인
- 홈 화면에 `new AI 톡톡 토론`, `AI 교수단 심층토론`, `심층 토론 전용` 표시 확인
- API 테스트에서 교수단 심층 토론 응답 확인

## 아직 확인이 부족한 것

브라우저 자동 입력 도구가 가상 클립보드 문제로 막혀서, 실제 화면에서 입력부터 결과까지 전체 클릭 루틴은 충분히 반복 검수하지 못했습니다.

다음 채팅방에서 우선 확인할 흐름:

1. 홈에서 안건 입력
2. 심층 토론 시작
3. 결과 화면 이동
4. Claude 교수, GPT 교수, Gemini 교수 발언 확인
5. 최종 판단 확인
6. 홈 복귀
7. 최근 심층토론 다시 보기

## 다음 작업 제안

1. UI 방향부터 사장님용으로 새로 잡기
   - 기존 AI 톡톡의 귀여운 채팅 앱 느낌과 분리
   - 교수단, 심층 검토, 의사결정 보고서 느낌 강화

2. 토론 품질 개선
   - 질문을 안건으로 구조화
   - 전제와 반론을 더 깊게 만들기
   - 최종 판단을 사장님 보고용으로 정리

3. 시연용 예시 질문 만들기
   - 신입과 경력직 중 누구를 뽑아야 할까?
   - AI 도입 비용을 늘려도 될까?
   - 새 서비스 출시를 지금 해야 할까?
   - 고객 불만이 늘 때 가격을 내려야 할까?

4. 로컬 QA
   - 화면 멈춤 없음
   - 토론 시작 버튼 동작
   - 결과 재진입 가능
   - 최근 목록 표시
   - build 통과

## 배포 주의

아직 배포하지 않습니다.

나중에 배포할 때는 기존 AI 톡톡 Vercel 프로젝트를 재사용하면 안 됩니다. 반드시 별도 GitHub/Vercel 프로젝트로 분리해야 합니다.

## 사장님께 말할 수 있는 설명

```text
기존 AI 톡톡은 유지하고, 사장님 요청에 맞춰 심층 토론 버전을 별도 프로젝트로 분리했습니다.
이 버전은 세 AI가 교수단처럼 전제, 근거, 리스크, 실행 조건을 검토하고
최종 판단을 정리하는 방향입니다.
현재는 로컬에서 방향성과 화면을 먼저 다듬는 단계라 아직 배포하지 않았습니다.
```
