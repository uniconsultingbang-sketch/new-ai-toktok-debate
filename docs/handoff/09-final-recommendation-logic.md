# Final Recommendation Logic

Version: v0.5.1
Date: 2026-05-12

## Purpose

The final recommendation is not a correct answer. It is the service's current practical judgment based on the interpreted agenda, debate history, uncertainty, risk, cost, and reversibility.

The system must not default to `조건부 추천` just because a topic is ambiguous.

## Allowed Judgment Values

- `추천`
- `조건부 추천`
- `보류`
- `비추천`

## Judgment Criteria

### 추천

Use when evidence is reasonably sufficient, risk is low or controllable, and acting now is unlikely to create large loss.

### 조건부 추천

Use when there is meaningful potential, but uncertainty remains, and a small, reversible pilot or conditional execution is practical.

### 보류

Use when information is too limited, the decision would rely too much on guessing, or acting now is riskier than checking first.

### 비추천

Use when evidence is weak, risk or loss is high, or failure would be hard to reverse.

## Ambiguity Rule

Ambiguous does not mean `조건부 추천`.

- Ambiguous but small and reversible test is possible: `조건부 추천`
- Ambiguous and moving now is risky: `보류`
- Weak evidence plus high loss: `비추천`
- Sufficient evidence plus controlled risk: `추천`

## Implementation Notes

- `app/api/debate/stream/route.ts` instructs the final model to choose only one of the four values using the criteria above.
- If the model returns an unclear judgment, the generated final report is rejected and retried.
- If both final model attempts fail or remain unclear, the safe fallback is `보류`, not `조건부 추천`.
- `lib/decision-storage.ts` normalizes old or malformed stored recommendation values. Unknown values are normalized to `보류`.
- The visible final panel labels remain fixed: `이유`, `주의할 점`, `핵심 쟁점`, `현실적인 실행 방향`.

## QA Focus

The QA goal is distribution quality, not equal counts.

Check that different agenda types can naturally produce:

- `추천`
- `조건부 추천`
- `보류`
- `비추천`

The result is acceptable when the judgment follows the agenda and debate reasoning, even if there is no single correct answer.
