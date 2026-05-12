# 토론 생성 알고리즘 / 로직 설계서

## 1. 입력 구조

```ts
type DebateInput = {
  title?: string;
  content?: string;
  options?: string;
  risks?: string;
  focusAreas?: string[];
  councilMode?: "role_based" | "open_debate";
  discussionDepth?: "simple" | "deep";
  banterLevel?: "off" | "light" | "spicy";
  rebuttalRotations?: number;
  devMode?: "quick";
};
```

필수 입력은 `content`입니다. 홈 화면에서는 질문만 넣어도 실행됩니다.

## 2. 질문 분류 알고리즘

우선순위는 아래 순서입니다.

1. 제약/의료 키워드가 명확하면 `pharma`
2. 채용/인사/조직 키워드가 명확하면 `people`
3. 출시/사업/고객/매출/제품 키워드가 명확하면 `business`
4. 회식/음식/오늘/내일/좋을까/뭐하지 같은 가벼운 선택은 `fun`
5. AI와 말하기/AI 사용법은 `chat` 또는 `tech`
6. 애매한 질문은 기본적으로 가벼운 수다형 `general`에 가깝게 처리

AI가 들어갔다고 무조건 `tech`로 보내면 안 됩니다.  
예: `AI와 어떻게 말해야 해?`는 기술 보고서가 아니라 AI 수다/사용법입니다.

## 3. 질문 의도 추론

분류 뒤에 더 세부 의도를 둡니다.

- `ai_chat`: AI와 말하는 법, AI에게 질문하는 법
- `ai_usage`: AI에게 일을 시키는 법
- `company_ai`: 회사 업무에 AI를 쓰는 방법
- `report_ai`: 대표님 보고/요약/자료 작성에 AI 활용
- `meal_gathering`: 회식/음식/모임 장소 선택
- `ai_cost_hiring`: AI 비용과 채용 판단이 섞인 질문

## 4. 캐릭터별 응답 규칙

### Claude

- 부드럽고 사람 중심
- 가능성을 먼저 봅니다.
- GPT의 차가운 지적을 받아치되 공격적이지 않습니다.

### GPT

- 짧고 차갑게 태클
- 비용, 실패, 모호함, 운영 부담을 봅니다.
- 무례한 말투가 아니라 리스크 담당처럼 보여야 합니다.

### Gemini

- 건조한 중재
- 두 의견을 구조화합니다.
- 마지막에 판단 기준을 잡습니다.

## 5. 티키타카 생성 규칙

첫 발언 이후에는 반드시 직전 AI의 이름, 단어, 논리 중 하나를 받아칩니다.

좋은 예:

```text
Claude: AI도 결국 브리핑 잘 받으면 일 잘해요.
GPT: Claude, 말은 예쁜데 대부분 그냥 '알아서 해줘' 던집니다.
Gemini: 두 분 요약하면 인간과 요구사항이 따로 앉아 있다는 겁니다.
```

나쁜 예:

```text
Claude: AI 활용은 중요합니다.
GPT: AI는 효율을 높입니다.
Gemini: AI는 여러 분야에서 사용됩니다.
```

## 6. 속마음 생성 규칙

- 1줄만 사용합니다.
- 심플 모드에서는 이모지를 허용합니다.
- 같은 토론 안에서 같은 속마음을 반복하지 않습니다.
- 사용자 조롱은 금지합니다.

예:

```text
Claude 속마음: ☕ 오늘도 분위기 수습 담당입니다.
GPT 속마음: 🧊 또 '알아서 해줘'가 등장했다.
Gemini 속마음: 👀 인간과 요구사항이 또 따로 앉았습니다.
```

## 7. 라운드 생성 규칙

### 심플

- Round 1: 가볍게 첫 수다
- Round 2: 받아치기 1~3회
- Round 3: 한 줄 정리
- 최종: Simple Answer

### 심층

- Round 1: 오프닝
- Round 2: 교차 반박
- Round 3: 근거 검증 또는 마지막 판단
- 최종: Final Recommendation

## 8. fallback 우선순위

1. 실제 AI 응답 사용
2. 응답이 너무 일반적이거나 주제와 어긋나면 내부 fallback으로 교체
3. API 실패 시 질문 유형별 fallback 사용
4. 그래도 실패하면 사용자 친화적 오류 메시지와 다시 시작 제공

## 9. 반복 방지 로직

- `usedThoughts`로 속마음 반복 방지
- `usedFallbacks`로 fallback 문장 반복 방지
- `history`를 보고 직전 발언과 같은 문장 사용 금지
- 전문 주제도 라운드별로 다른 문장 세트를 사용

## 10. DEV 빠른 테스트 모드

`POST /api/debate/stream?dev=quick`

- Round 1만 실행
- 속마음은 OFF
- QA에서 비용과 시간을 줄이는 용도
- 실제 사용자 화면 기본 동작에는 영향 없음

