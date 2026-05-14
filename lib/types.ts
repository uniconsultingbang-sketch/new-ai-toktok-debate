export type DecisionInput = {
  title: string;
  decisionQuestion: string;
  background: string;
  options: string;
  risks: string;
  focusAreas: string[];
  councilMode: CouncilMode;
  banterLevel: BanterLevel;
  rebuttalRotations: number;
};

export type CouncilMode = "role_based";

export type BanterLevel = "off";

export type DebateRound = {
  roundNumber: number;
  roundTitle: string;
  turns?: DebateTurn[];
};

export type DebateTurn = {
  id: string;
  roundNumber: number;
  speaker: "moderator" | "claude" | "gpt" | "gemini";
  speakerName: string;
  roleName: string;
  label: string;
  message: string;
};

export type FinalReport = {
  recommendation: "추천" | "조건부 추천" | "보류" | "비추천";
  summary: string;
  mainClaims?: string[];
  agreements?: string[];
  disagreements?: string[];
  keyReasons: string[];
  keyRisks: string[];
  conditions: string[];
  nextActions: string[];
  evidenceSources?: string[];
  heading?: string;
};

export type DebateResult = {
  decisionId: string;
  rounds: DebateRound[];
  finalReport: FinalReport;
};
