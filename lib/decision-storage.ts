"use client";

import { supabase } from "@/lib/supabase";

export type CouncilMode = "role_based";
export type DiscussionDepth = "deep";
export type BanterLevel = "off";
export type DecisionStatus = "running" | "paused" | "completed" | "failed";
export type SpeakerId = "moderator" | "claude" | "gpt" | "gemini";
export type TopicType = "pharma" | "business" | "people" | "tech" | "general";

export type FinalReport = {
  recommendation: string;
  summary: string;
  keyReasons: string[];
  keyRisks: string[];
  conditions: string[];
  nextActions: string[];
  evidenceSources?: string[];
  heading?: string;
  sectionLabels?: {
    keyReasons?: string;
    keyRisks?: string;
    conditions?: string;
    nextActions?: string;
    evidenceSources?: string;
  };
};

export type DebateEvent =
  | {
      id: string;
      type: "turn";
      roundNumber: number;
      roundTitle: string;
      speaker: SpeakerId;
      speakerName: string;
      roleName: string;
      label: string;
      message: string;
      status?: "live" | "assisted" | "fallback";
      topicSummary?: {
        topic: string;
        coreQuestion: string;
      };
      createdAt: string;
    }
  | {
      id: string;
      type: "thought";
      roundNumber: number;
      speaker: SpeakerId;
      speakerName: string;
      message: string;
      createdAt: string;
    };

export type DecisionRecord = {
  id: string;
  title: string;
  content: string;
  options: string;
  risks: string;
  focusAreas: string[];
  councilMode: CouncilMode;
  discussionDepth: DiscussionDepth;
  banterLevel: BanterLevel;
  rebuttalRotations: number;
  topicType?: TopicType;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
  events: DebateEvent[];
  finalReport: FinalReport | null;
  error: string | null;
};

const STORAGE_KEY = "newAiToktokProfessorDebates";
const LEGACY_STORAGE_KEY = "newAiToktokProfessorDebatesLegacy";

const statusLabels: Record<DecisionStatus, string> = {
  running: "진행중",
  paused: "중단됨",
  completed: "완료",
  failed: "오류",
};

const topicLabels: Record<TopicType, string> = {
  pharma: "제약·의료",
  business: "사업·시장",
  people: "인사·조직",
  tech: "AI·기술",
  general: "일반 의사결정",
};

export function createDecisionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `decision-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadDecisions(): DecisionRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const primary = readStorage(STORAGE_KEY);
  if (primary.length) {
    return primary;
  }

  const legacy = readStorage(LEGACY_STORAGE_KEY);
  if (legacy.length) {
    writeStorage(legacy);
  }

  return legacy;
}

export async function loadDecisionsAsync(): Promise<DecisionRecord[]> {
  const localDecisions = loadDecisions();

  if (!supabase) {
    return localDecisions;
  }

  const { data, error } = await supabase
    .from("decision_records")
    .select("payload")
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return localDecisions;
  }

  const remoteDecisions = data
    .map((row) => row.payload as DecisionRecord | null)
    .filter((value): value is DecisionRecord => Boolean(value))
    .map(normalizeDecision);

  const merged = mergeDecisions(remoteDecisions, localDecisions);
  writeStorage(merged);
  return merged;
}

export function getDecision(id: string) {
  return loadDecisions().find((decision) => decision.id === id) ?? null;
}

export async function getDecisionAsync(id: string) {
  const localDecision = getDecision(id);

  if (localDecision || !supabase) {
    return localDecision;
  }

  const { data, error } = await supabase
    .from("decision_records")
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  if (error || !data?.payload) {
    return null;
  }

  const decision = normalizeDecision(data.payload as DecisionRecord);
  saveDecision(decision);
  return decision;
}

export function saveDecision(decision: DecisionRecord) {
  if (typeof window === "undefined") {
    return;
  }

  const decisions = loadDecisions();
  const index = decisions.findIndex((item) => item.id === decision.id);
  const next =
    index >= 0
      ? decisions.map((item, itemIndex) => (itemIndex === index ? normalizeDecision(decision) : item))
      : [normalizeDecision(decision), ...decisions];

  writeStorage(next);
}

export async function saveDecisionAsync(decision: DecisionRecord) {
  saveDecision(decision);

  if (!supabase) {
    return;
  }

  const normalized = normalizeDecision(decision);

  await supabase.from("decision_records").upsert(
    {
      id: normalized.id,
      title: normalized.title,
      status: normalized.status,
      created_at: normalized.createdAt,
      updated_at: normalized.updatedAt,
      payload: normalized,
    },
    { onConflict: "id" },
  );
}

export function deleteDecision(id: string) {
  if (typeof window === "undefined") {
    return;
  }

  const next = loadDecisions().filter((decision) => decision.id !== id);
  writeStorage(next);
}

export async function deleteDecisionAsync(id: string) {
  deleteDecision(id);

  if (!supabase) {
    return;
  }

  await supabase.from("decision_records").delete().eq("id", id);
}

export function formatDecisionDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getStatusLabel(status: DecisionStatus) {
  return statusLabels[status] ?? status;
}

export function getTopicLabel(topicType?: TopicType | string) {
  return topicType && topicType in topicLabels ? topicLabels[topicType as TopicType] : "일반 의사결정";
}

function readStorage(key: string): DecisionRecord[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeDecision) : [];
  } catch {
    return [];
  }
}

function writeStorage(decisions: DecisionRecord[]) {
  const value = JSON.stringify(decisions.map(normalizeDecision));
  window.localStorage.setItem(STORAGE_KEY, value);
  window.localStorage.setItem(LEGACY_STORAGE_KEY, value);
}

function mergeDecisions(primary: DecisionRecord[], secondary: DecisionRecord[]) {
  const seen = new Set<string>();
  const merged: DecisionRecord[] = [];

  for (const decision of [...primary, ...secondary]) {
    if (seen.has(decision.id)) {
      continue;
    }

    seen.add(decision.id);
    merged.push(normalizeDecision(decision));
  }

  return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function normalizeDecision(value: DecisionRecord): DecisionRecord {
  return {
    ...value,
    options: value.options ?? "",
    risks: value.risks ?? "",
    focusAreas: value.focusAreas?.length ? value.focusAreas : ["수요", "근거", "리스크", "실행"],
    councilMode: "role_based",
    discussionDepth: "deep",
    banterLevel: "off",
    rebuttalRotations: clampRotations(value.rebuttalRotations),
    topicType: normalizeTopic(value.topicType),
    events: value.events ?? [],
    finalReport: normalizeFinalReport(value.finalReport),
    error: value.error ?? null,
  };
}

function normalizeTopic(value: unknown): TopicType | undefined {
  if (value === "pharma" || value === "business" || value === "people" || value === "tech" || value === "general") {
    return value;
  }

  return undefined;
}

function normalizeFinalReport(value: FinalReport | null | undefined): FinalReport | null {
  if (!value) {
    return null;
  }

  return {
    ...value,
    recommendation: normalizeRecommendation(value.recommendation),
    keyReasons: value.keyReasons ?? [],
    keyRisks: value.keyRisks ?? [],
    conditions: value.conditions ?? [],
    nextActions: value.nextActions ?? [],
    evidenceSources: value.evidenceSources ?? [],
    heading: value.heading ?? "최종 결론",
    sectionLabels: {
      keyReasons: value.sectionLabels?.keyReasons ?? "이유",
      keyRisks: value.sectionLabels?.keyRisks ?? "주의할 점",
      conditions: value.sectionLabels?.conditions ?? "핵심 쟁점",
      nextActions: value.sectionLabels?.nextActions ?? "현실적인 실행 방향",
      evidenceSources: value.sectionLabels?.evidenceSources ?? "근거 자료",
    },
  };
}

function normalizeRecommendation(value: string) {
  if (value === "추천" || value === "조건부 추천" || value === "보류" || value === "비추천") {
    return value;
  }

  if (/비추천|중단/.test(value)) return "비추천";
  if (/보류|추가 검토/.test(value)) return "보류";
  if (/진행|추천/.test(value) && !/조건/.test(value)) return "추천";
  return "조건부 추천";
}

function clampRotations(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 2;
  }

  return Math.min(3, Math.max(1, Math.round(numberValue)));
}
