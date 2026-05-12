# API 구조 설계서

## 1. 현재 API

현재 핵심 API는 하나입니다.

```http
POST /api/debate/stream
```

응답은 NDJSON 스트리밍입니다.

## 2. 요청 예시

```json
{
  "title": "AI와 어떻게 말해야 해?",
  "content": "AI와 어떻게 말해야 해?",
  "discussionDepth": "simple",
  "councilMode": "open_debate",
  "banterLevel": "spicy",
  "rebuttalRotations": 3,
  "options": "",
  "risks": "",
  "focusAreas": ["핵심", "리스크", "결론"]
}
```

## 3. 스트리밍 이벤트 구조

### thought

```json
{
  "type": "thought",
  "roundNumber": 1,
  "speaker": "claude",
  "speakerName": "Claude",
  "message": "☕ 오늘도 분위기 수습 담당입니다.",
  "createdAt": "ISO_DATE"
}
```

### turn

```json
{
  "type": "turn",
  "roundNumber": 1,
  "roundTitle": "가볍게 첫 수다",
  "speaker": "gpt",
  "speakerName": "GPT",
  "roleName": "비관 감시관 (Bear)",
  "label": "R1",
  "message": "Claude, 말은 예쁜데 대부분 그냥 '알아서 해줘' 던집니다.",
  "status": "fallback",
  "topicType": "chat",
  "topicIntent": "ai_chat",
  "createdAt": "ISO_DATE"
}
```

### final

```json
{
  "type": "final",
  "topicType": "chat",
  "topicIntent": "ai_chat",
  "finalReport": {
    "template": "light",
    "recommendation": "짧게 말하고, 예시 하나 붙이기",
    "summary": "AI에게는 작은 브리핑이 가장 잘 먹힙니다.",
    "keyReasons": [],
    "keyRisks": [],
    "conditions": [],
    "nextActions": []
  }
}
```

## 4. 에러 처리

- 입력 없음: 400 JSON 응답
- API 호출 실패: fallback 응답 사용
- 파싱 실패: fallback 응답 사용
- 화면 오류: 쉬운 문구 + 다시 시작 버튼

개발자식 오류 메시지를 사용자에게 그대로 보여주면 안 됩니다.

## 5. AI Provider 구조

현재 서버는 speaker별로 다른 API를 호출합니다.

- Claude: Anthropic
- GPT: OpenAI
- Gemini: Google AI

정식 개발에서는 아래처럼 추상화하는 것을 권장합니다.

```ts
interface ModelProvider {
  generate(input: {
    speaker: "claude" | "gpt" | "gemini";
    prompt: string;
    maxTokens: number;
  }): Promise<{ message: string; status: "live" | "fallback" }>;
}
```

## 6. 비용 절약 전략

- 심플 모드 문장 길이 제한
- 전체 대화 대신 직전 발언 + 요약만 전달
- `?dev=quick`으로 QA 비용 절감
- fallback은 추가 API 호출 없이 내부 문장으로 처리
- 전문 주제만 근거 링크와 긴 리포트 사용

## 7. 향후 서버 API

DB 적용 시 권장 API:

- `POST /api/decisions`
- `GET /api/decisions`
- `GET /api/decisions/:id`
- `PATCH /api/decisions/:id`
- `DELETE /api/decisions/:id`
- `POST /api/debate/stream`
- `POST /api/reports/:decisionId/share`

