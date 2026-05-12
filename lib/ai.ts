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
      recommendation: "보류",
      heading: "최종 결론",
      summary: "실제 화면에서는 /api/debate/stream이 3관점 논리 토론을 순서대로 생성합니다. 이 기본 응답은 스트리밍을 사용할 수 없을 때의 안전한 보류 응답입니다.",
      keyReasons: ["최종 판단 근거가 충분하지 않으면 추천으로 넘기지 않고 보류합니다."],
      keyRisks: ["근거 없이 결정하면 비용과 책임 범위가 커질 수 있습니다."],
      conditions: ["실제 수요가 강한가", "비용 대비 효과가 나오는가", "중단 기준이 있는가"],
      nextActions: ["작은 범위에서 검증 기준을 정한 뒤 다시 판단합니다."],
      evidenceSources: [],
    },
  };
}
