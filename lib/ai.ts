import type { DebateResult, DecisionInput } from "@/lib/types";

export async function generateDebate(input: DecisionInput): Promise<DebateResult> {
  const decisionId = crypto.randomUUID();

  return {
    decisionId,
    rounds: [
      {
        roundNumber: 1,
        roundTitle: "주제 정리",
        turns: [
          {
            id: crypto.randomUUID(),
            roundNumber: 1,
            speaker: "moderator",
            speakerName: "사회자",
            roleName: "회의 진행자",
            label: "STEP 1",
            message: `"${input.title}" 안건은 가능성, 리스크, 실행 조건을 같은 기준에서 검토해야 합니다.`,
          },
        ],
      },
    ],
    finalReport: {
      recommendation: "조건부 추천",
      heading: "결론",
      summary:
        "결론은 전면 실행이 아니라 작은 범위에서 검증하며 추진하는 조건부 추천입니다. 핵심은 실제 수요와 리스크를 먼저 확인해 진행 범위와 멈출 기준을 정하는 것입니다. 검증 결과가 약하면 보류 또는 비추천으로 바꿔야 합니다.",
      mainClaims: [
        "Claude: 가능성은 살리되 작은 범위에서 먼저 확인해야 한다고 봅니다.",
        "GPT: 비용과 실패 기준이 없으면 실행 위험이 커진다고 봅니다.",
        "Gemini: 성공 조건과 중단 조건을 먼저 합의해야 한다고 봅니다.",
      ],
      agreements: [
        "전면 실행보다 작은 검증이 먼저 필요합니다.",
        "성공 기준과 중단 기준을 함께 정해야 합니다.",
      ],
      disagreements: ["지금 바로 실행할 만큼 근거가 충분한지에 대한 판단은 갈립니다."],
      keyReasons: [
        "Claude: 가능성은 살리되 작은 범위에서 먼저 확인해야 한다고 봅니다.",
        "GPT: 비용과 실패 기준이 없으면 실행 위험이 커진다고 봅니다.",
        "Gemini: 성공 조건과 중단 조건을 먼저 합의해야 한다고 봅니다.",
      ],
      keyRisks: ["지금 바로 실행할 만큼 근거가 충분한지에 대한 판단은 갈립니다."],
      conditions: [
        "전면 실행보다 작은 검증이 먼저 필요합니다.",
        "성공 기준과 중단 기준을 함께 정해야 합니다.",
      ],
      nextActions: ["검증 범위, 기간, 비용 한도, 중단 기준을 정한 뒤 다시 판단합니다."],
      evidenceSources: [],
    },
  };
}
