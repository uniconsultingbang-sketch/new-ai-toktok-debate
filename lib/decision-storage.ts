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
  ownerId?: string;
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
  running: "토론중",
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

export function loadDecisions(ownerId?: string | null): DecisionRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const owner = normalizeOwnerId(ownerId);
  const primary = readStorage(storageKey(owner), owner);

  if (owner) {
    return primary;
  }

  if (primary.length) {
    return primary;
  }

  const legacy = readStorage(legacyStorageKey(null), null);
  if (legacy.length) {
    writeStorage(legacy, null);
  }

  return legacy;
}

export async function loadDecisionsAsync(ownerId?: string | null): Promise<DecisionRecord[]> {
  const owner = normalizeOwnerId(ownerId);
  const localDecisions = loadDecisions(owner);

  if (!supabase) {
    return localDecisions;
  }

  const remoteDecisions = await loadRemoteDecisions(owner);
  const merged = mergeDecisions(remoteDecisions, localDecisions, owner);
  writeStorage(merged, owner);
  return merged;
}

export function getDecision(id: string, ownerId?: string | null) {
  const owner = normalizeOwnerId(ownerId);
  return loadDecisions(owner).find((decision) => decision.id === id && belongsToOwner(decision, owner)) ?? null;
}

export async function getDecisionAsync(id: string, ownerId?: string | null) {
  const owner = normalizeOwnerId(ownerId);
  const localDecision = getDecision(id, owner);

  if (localDecision || !supabase) {
    return localDecision;
  }

  const remoteDecision = await loadRemoteDecision(id, owner);

  if (!remoteDecision) {
    return null;
  }

  saveDecision(remoteDecision, owner);
  return remoteDecision;
}

export function saveDecision(decision: DecisionRecord, ownerId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const owner = normalizeOwnerId(ownerId ?? decision.ownerId);
  const normalized = normalizeDecision(decision, owner);
  const decisions = loadDecisions(owner);
  const index = decisions.findIndex((item) => item.id === normalized.id);
  const next =
    index >= 0
      ? decisions.map((item, itemIndex) => (itemIndex === index ? normalized : item))
      : [normalized, ...decisions];

  writeStorage(next, owner);
}

export async function saveDecisionAsync(decision: DecisionRecord, ownerId?: string | null) {
  const owner = normalizeOwnerId(ownerId ?? decision.ownerId);
  const normalized = normalizeDecision(decision, owner);
  saveDecision(normalized, owner);

  if (!supabase) {
    return;
  }

  const payload = {
    id: normalized.id,
    owner_id: normalized.ownerId ?? null,
    title: normalized.title,
    status: normalized.status,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
    payload: normalized,
  };

  const { error } = await supabase.from("decision_records").upsert(payload, { onConflict: "id" });

  if (error && isOwnerColumnError(error)) {
    const { owner_id: _ownerId, ...fallbackPayload } = payload;
    await supabase.from("decision_records").upsert(fallbackPayload, { onConflict: "id" });
  }
}

export function deleteDecision(id: string, ownerId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const owner = normalizeOwnerId(ownerId);
  const next = loadDecisions(owner).filter((decision) => decision.id !== id);
  writeStorage(next, owner);
}

export async function deleteDecisionAsync(id: string, ownerId?: string | null) {
  const owner = normalizeOwnerId(ownerId);
  deleteDecision(id, owner);

  if (!supabase) {
    return;
  }

  if (!owner) {
    await supabase.from("decision_records").delete().eq("id", id);
    return;
  }

  const { error } = await supabase.from("decision_records").delete().eq("id", id).eq("owner_id", owner);

  if (!error) {
    return;
  }

  const remoteDecision = await loadRemoteDecision(id, owner);
  if (remoteDecision?.ownerId === owner) {
    await supabase.from("decision_records").delete().eq("id", id);
  }
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

async function loadRemoteDecisions(ownerId: string | null) {
  if (!supabase) {
    return [];
  }

  let query = supabase.from("decision_records").select("payload").order("updated_at", { ascending: false });

  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  const { data, error } = await query;

  if (!error && data) {
    const primary = normalizeRemoteRows(data, ownerId);

    if (!ownerId) {
      return primary;
    }

    const fallback = await supabase.from("decision_records").select("payload").order("updated_at", { ascending: false });

    if (fallback.error || !fallback.data) {
      return primary;
    }

    return mergeDecisions(primary, normalizeRemoteRows(fallback.data, ownerId), ownerId);
  }

  if (!ownerId) {
    return [];
  }

  const fallback = await supabase.from("decision_records").select("payload").order("updated_at", { ascending: false });

  if (fallback.error || !fallback.data) {
    return [];
  }

  return normalizeRemoteRows(fallback.data, ownerId);
}

async function loadRemoteDecision(id: string, ownerId: string | null) {
  if (!supabase) {
    return null;
  }

  let query = supabase.from("decision_records").select("payload").eq("id", id);

  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  const { data, error } = await query.maybeSingle();

  if (!error && data?.payload) {
    const decision = normalizeDecision(data.payload as DecisionRecord, undefined);
    return belongsToOwner(decision, ownerId) ? decision : null;
  }

  if (!ownerId) {
    return null;
  }

  const fallback = await supabase.from("decision_records").select("payload").eq("id", id).maybeSingle();

  if (fallback.error || !fallback.data?.payload) {
    return null;
  }

  const decision = normalizeDecision(fallback.data.payload as DecisionRecord, undefined);
  return belongsToOwner(decision, ownerId) ? decision : null;
}

function normalizeRemoteRows(rows: Array<{ payload: unknown }>, ownerId: string | null) {
  return rows
    .map((row) => normalizeDecision(row.payload as DecisionRecord, undefined))
    .filter((decision) => belongsToOwner(decision, ownerId));
}

function readStorage(key: string, ownerId: string | null): DecisionRecord[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((value) => normalizeDecision(value as DecisionRecord, ownerId)).filter((value) => belongsToOwner(value, ownerId))
      : [];
  } catch {
    return [];
  }
}

function writeStorage(decisions: DecisionRecord[], ownerId: string | null) {
  const normalized = decisions
    .map((decision) => normalizeDecision(decision, ownerId))
    .filter((decision) => belongsToOwner(decision, ownerId));
  const value = JSON.stringify(normalized);
  window.localStorage.setItem(storageKey(ownerId), value);

  if (!ownerId) {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, value);
  }
}

function storageKey(ownerId: string | null) {
  return ownerId ? `${STORAGE_KEY}:${ownerId}` : STORAGE_KEY;
}

function legacyStorageKey(ownerId: string | null) {
  return ownerId ? `${LEGACY_STORAGE_KEY}:${ownerId}` : LEGACY_STORAGE_KEY;
}

function mergeDecisions(primary: DecisionRecord[], secondary: DecisionRecord[], ownerId: string | null) {
  const seen = new Set<string>();
  const merged: DecisionRecord[] = [];

  for (const decision of [...primary, ...secondary]) {
    const normalized = normalizeDecision(decision, ownerId);

    if (seen.has(normalized.id) || !belongsToOwner(normalized, ownerId)) {
      continue;
    }

    seen.add(normalized.id);
    merged.push(normalized);
  }

  return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function normalizeDecision(value: DecisionRecord, ownerId?: string | null): DecisionRecord {
  const owner = normalizeOwnerId(ownerId ?? value.ownerId);

  return {
    ...value,
    ownerId: owner ?? undefined,
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

function belongsToOwner(decision: DecisionRecord, ownerId: string | null) {
  if (!ownerId) {
    return true;
  }

  return normalizeOwnerId(decision.ownerId) === ownerId;
}

function normalizeOwnerId(value: unknown) {
  const owner = typeof value === "string" ? value.trim() : "";
  return owner || null;
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

function isOwnerColumnError(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
  return message.includes("owner_id") || message.includes("column");
}

function clampRotations(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 2;
  }

  return Math.min(3, Math.max(1, Math.round(numberValue)));
}
