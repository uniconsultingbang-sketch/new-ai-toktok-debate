# new AI 톡톡 토론 프로젝트 핸드오프

작성일: 2026-05-12

이 문서는 다른 Codex 채팅방이 사장님용 심층 토론 프로젝트를 바로 이어받기 위한 기준 문서입니다.

최종 판단 로직은 `docs/handoff/09-final-recommendation-logic.md`에 별도로 기록했습니다.

## 1. 프로젝트 구분

- 기존 AI 톡톡 개인/재미 버전:
  - `C:\Users\unico\Documents\Codex\2026-05-07\new-chat`
  - 방실장님과 지디가 계속 수정할 원래 프로젝트입니다.
  - 이 새 채팅방에서는 건드리지 않습니다.

- 사장님용 새 심층 토론 버전:
  - `C:\Users\unico\Documents\Codex\2026-05-07\new-ai-toktok-debate`
  - 현재 문서가 들어 있는 프로젝트입니다.
  - 이름은 `new AI 톡톡 토론`입니다.
  - 아직 배포하지 않았고, 로컬에서만 확인하는 상태입니다.

## 2. 다음 채팅방 첫 메시지

다른 채팅방을 열면 아래 내용을 그대로 붙여 넣어 주세요.

```text
프로젝트 위치:
C:\Users\unico\Documents\Codex\2026-05-07\new-ai-toktok-debate

먼저 아래 문서를 읽고 이어서 작업해줘.
- PROJECT_HANDOFF.md
- docs/handoff/00-next-chat-handoff.md

이 프로젝트는 사장님용 new AI 톡톡 토론입니다.
기존 AI 톡톡(new-chat)은 건드리지 말고, 로컬에서만 교수단 심층 토론 버전을 이어서 다듬어줘.
배포는 아직 하지 마.
```

## 3. 현재 목표

사장님 요청에 맞춰 기존의 가벼운 AI 톡톡과 별도로, 대학교 교수님 수준의 심층 토론 서비스를 만든다.

현재 방향:

- 심플 모드 중심이 아닙니다.
- 매콤한 농담형 서비스가 아닙니다.
- 교수단이 안건을 검토하는 느낌입니다.
- 전제, 근거, 반론, 리스크, 실행 조건을 차분하게 다룹니다.
- 최종 판단은 보고용으로 정리됩니다.

## 4. 현재 실행 상태

- 로컬 URL: `http://localhost:3010/`
- 배포 상태: 배포 안 함
- Vercel 연결: 새 프로젝트 폴더에서는 `.vercel` 폴더를 제거한 상태
- 저장 방식: 브라우저 localStorage
- localStorage 키: `newAiToktokProfessorDebates`
- Git 상태: 새 프로젝트 폴더는 현재 Git 저장소가 아닙니다.

서버가 꺼져 있으면 새 채팅방에서 아래 순서로 실행하면 됩니다.

```powershell
npm.cmd install
npm.cmd run dev -- -p 3010
```

검증용 명령:

```powershell
npx.cmd tsc --noEmit
npm.cmd run build
```

## 5. 이미 적용된 주요 변경

프로젝트를 기존 AI 톡톡에서 복사한 뒤, 사장님용 심층 토론 방향으로 분리했습니다.

- `package.json`
  - 프로젝트 이름을 `new-ai-toktok-debate`로 변경했습니다.

- `app/layout.tsx`
  - 앱 제목을 `new AI 톡톡 토론`으로 변경했습니다.
  - PWA 설치 팝업은 렌더링하지 않도록 정리했습니다.

- `app/manifest.ts`
  - 앱 이름과 설명을 새 심층 토론 버전에 맞췄습니다.

- `lib/decision-storage.ts`
  - 기존 AI 톡톡 저장 기록과 섞이지 않도록 localStorage 키를 새로 분리했습니다.

- `components/DecisionDashboard.tsx`
  - 홈을 심층 토론 전용 입력 화면으로 바꿨습니다.
  - 심플/심층 선택 토글을 없앴습니다.
  - 입력 항목은 토론 안건, 현재 선택지, 우려되는 점, 집중 검토 영역입니다.
  - 새 토론 생성 시 항상 아래 값으로 시작합니다.
    - `discussionDepth: "deep"`
    - `councilMode: "role_based"`
    - `banterLevel: "off"`
    - `rebuttalRotations: 2`
    - 기본 집중 검토: `전제`, `근거`, `리스크`, `실행`

- `app/api/debate/stream/route.ts`
  - 클라이언트에서 어떤 값이 와도 심층 토론으로 강제합니다.
  - `discussionDepth`는 항상 `deep`입니다.
  - `councilMode`는 항상 `role_based`입니다.
  - `banterLevel`은 항상 `off`입니다.
  - 발표자는 아래 교수단 역할로 정리했습니다.
    - Claude 교수: 가능성과 인간 맥락
    - GPT 교수: 전제, 비용, 리스크 비판 검증
    - Gemini 교수: 종합 판단과 기준 제시

- `components/StreamingDecisionView.tsx`
  - 화면 문구를 교수단 토론 톤으로 바꿨습니다.
  - `Live Seminar`, `교수단 토론` 중심의 결과 화면입니다.

## 6. 검증된 내용

이전 작업에서 확인한 내용입니다.

- 의존성 설치 완료
- TypeScript 검사 통과
- production build 통과
- 로컬 홈 화면이 `http://localhost:3010/`에서 열림
- 홈에 `new AI 톡톡 토론`, `AI 교수단 심층토론`, `심층 토론 전용` 문구가 표시됨
- API에 일부러 `discussionDepth: "simple"`, `banterLevel: "spicy"`를 보내도 응답이 교수단 심층 토론으로 나옴
- API 응답에서 `Claude 교수`, `GPT 교수`, `Gemini 교수`, `FINAL 최종 판단` 흐름을 확인함

## 7. 아직 남은 일

다음 채팅방에서 이어서 하면 좋은 일입니다.

1. 사장님용 UI를 완전히 새 톤으로 정리
   - 기존 귀여운 AI 톡톡 UI와 분리
   - 교수단, 심층 검토, 보고용 판단 느낌 강화

2. 실제 화면 기준 QA
   - 홈에서 안건 입력
   - 토론 생성
   - 결과 화면 진입
   - 최근 심층토론 다시 보기
   - 오류/중단 상황 확인

3. 교수단 대화 품질 개선
   - 대학 교수님 수준의 질문 분석
   - 전제 검토
   - 찬반 논리
   - 근거와 한계
   - 실행 조건
   - 최종 판단

4. 사장님 시연용 예시 질문 정리
   - 경영 판단
   - 인사/조직 판단
   - 제품/사업 전략
   - 비용/리스크 판단

5. 배포는 나중에 별도 결정
   - 방실장님이 요청하기 전에는 Vercel 배포하지 않습니다.
   - 배포하게 되면 기존 AI 톡톡 Vercel 프로젝트를 재사용하지 말고 별도 프로젝트로 연결해야 합니다.

## 8. 주의할 점

- 이 폴더 안의 `docs/handoff/01~08` 문서는 기존 AI 톡톡에서 복사된 과거 문서일 수 있습니다.
- 특히 심플 모드, 매콤한 수다, 기존 AI 톡톡 디자인 관련 내용은 새 사장님용 프로젝트와 맞지 않을 수 있습니다.
- 다음 채팅방은 우선 `PROJECT_HANDOFF.md`와 `docs/handoff/00-next-chat-handoff.md`만 기준으로 삼아야 합니다.
- 기존 프로젝트 `new-chat`은 방실장님과 지디가 계속 수정할 예정이므로 새 채팅방에서 손대면 안 됩니다.

## 9. 사장님께 설명할 말

사장님께는 이렇게 설명하면 됩니다.

```text
기존 AI 톡톡은 가벼운 재미형 서비스로 유지하고,
사장님이 말씀하신 심층 토론 버전은 별도 프로젝트로 분리했습니다.
새 버전은 세 AI가 교수단처럼 전제, 근거, 리스크, 실행 조건을 나눠 검토하고
마지막에 보고용 최종 판단을 정리하는 방향입니다.
아직 배포는 하지 않았고, 로컬에서 방향성과 화면을 먼저 다듬는 단계입니다.
```
