export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SpeakerId = "moderator" | "claude" | "gpt" | "gemini";
type TopicType = "pharma" | "business" | "people" | "tech" | "general";
type DebatePhase = "topic" | "opening" | "discussion" | "issues";
type Recommendation = "추천" | "조건부 추천" | "보류" | "비추천";
type AgendaComplexity = "simple" | "normal" | "complex";

type DebateInput = {
  title?: string;
  content?: string;
  options?: string;
  risks?: string;
  focusAreas?: string[];
  rebuttalRotations?: number;
  devMode?: "quick";
};

type InterpretedAgenda = {
  topic: string;
  coreQuestion: string;
  inferredOptions: string[];
  inferredConcerns: string[];
  focusAreas: string[];
  complexity: AgendaComplexity;
  rotationCount: 1 | 2 | 3;
  discussionFrames: string[];
  summary: string;
};

type NormalizedInput = {
  title: string;
  content: string;
  originalContent: string;
  coreQuestion: string;
  options: string;
  risks: string;
  focusAreas: string[];
  agenda: InterpretedAgenda;
  rebuttalRotations: number;
  devMode?: "quick";
};

type TopicProfile = {
  type: TopicType;
  label: string;
  decisionFrame: string;
  evidenceRule: string;
  defaultSources: string[];
};

type TurnPlan = {
  roundNumber: number;
  roundTitle: string;
  speaker: SpeakerId;
  label: string;
  phase: DebatePhase;
  instruction: string;
};

type GeneratedTurn = {
  message: string;
  status: "live" | "assisted" | "fallback";
};

type FinalReport = {
  recommendation: Recommendation;
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
  sectionLabels?: {
    mainClaims?: string;
    agreements?: string;
    disagreements?: string;
    keyReasons?: string;
    keyRisks?: string;
    conditions?: string;
    nextActions?: string;
    evidenceSources?: string;
  };
};

const speakerMeta: Record<SpeakerId, { speakerName: string; roleName: string; stanceName: string }> = {
  moderator: {
    speakerName: "사회자",
    roleName: "회의 진행자",
    stanceName: "사용자의 진짜 질문을 해석하고 토론 쟁점을 정리하는 중립 진행자",
  },
  claude: {
    speakerName: "Claude",
    roleName: "낙관",
    stanceName: "가능성, 성장성, 기회, 사용자 가치를 검토하는 낙관 관점",
  },
  gpt: {
    speakerName: "GPT",
    roleName: "비관",
    stanceName: "리스크, 실패 가능성, 비용, 실행 난이도를 검토하는 비관 관점",
  },
  gemini: {
    speakerName: "Gemini",
    roleName: "중간",
    stanceName: "양쪽 논리를 정리하고 현실적 균형점과 실행 방향을 제시하는 중간 관점",
  },
};

const finalSectionLabels = {
  mainClaims: "주요 주장 비교",
  agreements: "합의된 부분",
  disagreements: "의견이 갈린 부분",
  keyReasons: "이유",
  keyRisks: "주의할 점",
  conditions: "핵심 쟁점",
  nextActions: "현실적인 실행 방향",
  evidenceSources: "근거 자료",
};

const unstableAiMessage =
  "토론을 정리하는 중 AI 응답이 불안정합니다. 입력하신 안건은 저장되어 있습니다. 잠시 후 다시 시도해 주세요.";

const streamBudgetMs = readPositiveNumber(process.env.DEBATE_STREAM_BUDGET_MS, 45_000);
const providerTimeoutMs = readPositiveNumber(process.env.AI_PROVIDER_TIMEOUT_MS, 12_000);
const maxLiveRotations = readRotationLimit(process.env.DEBATE_MAX_ROTATIONS, 1);

export async function POST(request: Request) {
  let rawInput: DebateInput;

  try {
    rawInput = (await request.json()) as DebateInput;
  } catch {
    return json({ error: "입력 형식을 확인해 주세요." }, 400);
  }

  const content = rawInput.content?.trim() ?? "";
  const title = rawInput.title?.trim() || makeTitle(content);
  const devMode = rawInput.devMode === "quick" || new URL(request.url).searchParams.get("dev") === "quick" ? "quick" : undefined;

  if (!content || !title) {
    return json({ error: "토론할 질문이나 안건 내용을 입력해 주세요." }, 400);
  }

  const preliminaryProfile = classifyTopic(`${title}\n${content}\n${rawInput.options ?? ""}\n${rawInput.risks ?? ""}`);
  const interpreted = await interpretAgenda(content, title, preliminaryProfile, devMode);
  const inferredOptions = mergeLimited(interpreted.inferredOptions, splitLooseText(rawInput.options), 4);
  const inferredConcerns = mergeLimited(interpreted.inferredConcerns, splitLooseText(rawInput.risks), 5);
  const profile = classifyTopic([
    interpreted.topic,
    interpreted.coreQuestion,
    inferredOptions.join("\n"),
    inferredConcerns.join("\n"),
    content,
  ].join("\n"));
  const focusAreas = interpreted.focusAreas.length ? interpreted.focusAreas : defaultFocusAreas(profile.type);
  const rotationCount = rotationCountForComplexity(interpreted.complexity, interpreted.rotationCount);
  const agenda: InterpretedAgenda = {
    ...interpreted,
    inferredOptions,
    inferredConcerns,
    focusAreas,
    rotationCount,
    discussionFrames: normalizeDiscussionFrames(interpreted.discussionFrames, interpreted, rotationCount),
  };
  const input: NormalizedInput = {
    title: agenda.topic,
    content: agenda.summary || agenda.coreQuestion || content,
    originalContent: content,
    coreQuestion: agenda.coreQuestion,
    options: inferredOptions.join(" / "),
    risks: inferredConcerns.join(", "),
    focusAreas,
    agenda,
    rebuttalRotations: agenda.rotationCount,
    devMode,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const history: string[] = [];
      const evidenceSources = new Set(profile.defaultSources);
      const startedAt = Date.now();
      const hasBudget = (reserveMs = 0) => Date.now() - startedAt + reserveMs < streamBudgetMs;

      try {
        for (const plan of createTurnPlans(input)) {
          if (!hasBudget(8_000)) {
            break;
          }

          const fallback = fallbackTurn(input, profile, plan, history);
          const result = input.devMode === "quick"
            ? { message: fallback, status: "fallback" as const }
            : await generateTurn(plan.speaker, buildTurnPrompt(input, profile, plan, history), fallback);

          const candidate = cleanTurnMessage(result.message);
          const useFallback = shouldUseFallback(candidate, plan, history, input);

          if (useFallback && !isSafeFallback(fallback, plan, input)) {
            throw new Error(unstableAiMessage);
          }

          const message = useFallback ? fallback : candidate;

          const meta = speakerMeta[plan.speaker];

          emit({
            id: randomId(),
            type: "turn",
            roundNumber: plan.roundNumber,
            roundTitle: plan.roundTitle,
            speaker: plan.speaker,
            speakerName: meta.speakerName,
            roleName: meta.roleName,
            label: plan.label,
            message,
            status: message === fallback ? "fallback" : result.status,
            topicType: profile.type,
            topicSummary: plan.phase === "topic"
              ? {
                  topic: input.agenda.topic,
                  coreQuestion: input.agenda.coreQuestion,
                }
              : undefined,
            createdAt: new Date().toISOString(),
          });

          history.push(`${meta.speakerName}: ${message}`);
          extractUrls(message).forEach((url) => evidenceSources.add(url));
        }

        const finalReport =
          input.devMode === "quick" || hasBudget(12_000)
            ? await generateFinalReport(input, profile, history, evidenceSources)
            : fallbackFinal(input, profile, Array.from(evidenceSources));

        emit({
          type: "final",
          finalReport,
          topicType: profile.type,
        });
        emit({ type: "done" });
      } catch (error) {
        console.error("[debate-stream] stream failed", error);
        try {
          emit({
            type: "final",
            finalReport: fallbackFinal(input, profile, Array.from(evidenceSources)),
            topicType: profile.type,
          });
          emit({ type: "done" });
        } catch (fallbackError) {
          console.error("[debate-stream] fallback final failed", fallbackError);
          emit({
            type: "error",
            message: unstableAiMessage,
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function createTurnPlans(input: NormalizedInput): TurnPlan[] {
  const plans: TurnPlan[] = [
    {
      roundNumber: 1,
      roundTitle: "주제 정리",
      speaker: "moderator",
      label: "STEP 1",
      phase: "topic",
      instruction: "사용자 안건의 진짜 질문, 주제, 핵심 질문을 중립적으로 정리한다. 찬반 의견은 내지 않는다.",
    },
    {
      roundNumber: 2,
      roundTitle: "첫 의견",
      speaker: "claude",
      label: "STEP 2",
      phase: "opening",
      instruction: "낙관 관점에서 가능성, 기회, 사용자 가치를 제시하되 과장하지 않는다.",
    },
    {
      roundNumber: 2,
      roundTitle: "첫 의견",
      speaker: "gpt",
      label: "STEP 2",
      phase: "opening",
      instruction: "직전 낙관 논리를 인정할 부분과 흔들리는 전제, 비용, 실행 리스크를 비관 관점에서 함께 짚는다.",
    },
    {
      roundNumber: 2,
      roundTitle: "첫 의견",
      speaker: "gemini",
      label: "STEP 2",
      phase: "opening",
      instruction: "낙관과 비관 관점을 받아 핵심 판단 기준을 구조화한다.",
    },
  ];

  const frames = input.agenda.discussionFrames.length
    ? input.agenda.discussionFrames
    : ["핵심 판단 기준"];

  for (let index = 0; index < input.rebuttalRotations; index += 1) {
    const frame = frames[index] ?? frames.at(-1) ?? "핵심 판단 기준";

    plans.push(
      {
        roundNumber: 3 + index,
        roundTitle: frame,
        speaker: "claude",
        label: `STEP 3-${index + 1}`,
        phase: "discussion",
        instruction: `직전 중간 관점의 기준을 받아 "${frame}" 쟁점에서 가능성을 유지할 수 있는 현실적 조건을 제시한다.`,
      },
      {
        roundNumber: 3 + index,
        roundTitle: frame,
        speaker: "gpt",
        label: `STEP 3-${index + 1}`,
        phase: "discussion",
        instruction: `직전 낙관 보완안의 빈틈을 "${frame}" 쟁점 안에서 검증하고 필요한 안전장치와 중단 기준을 요구한다.`,
      },
      {
        roundNumber: 3 + index,
        roundTitle: frame,
        speaker: "gemini",
        label: `STEP 3-${index + 1}`,
        phase: "discussion",
        instruction: `두 관점의 충돌을 "${frame}" 쟁점에 맞는 균형점으로 정리한다.`,
      },
    );
  }

  plans.push({
    roundNumber: 3 + input.rebuttalRotations,
    roundTitle: "핵심 쟁점",
    speaker: "moderator",
    label: "STEP 4",
    phase: "issues",
    instruction: "사회자 입장에서 토론에서 나온 핵심 쟁점을 3~4개로 압축하고 최종 결론이 판단해야 할 기준을 분명히 한다.",
  });

  return plans;
}

async function interpretAgenda(
  content: string,
  title: string,
  profile: TopicProfile,
  devMode?: "quick",
): Promise<InterpretedAgenda> {
  const fallback = fallbackInterpretedAgenda(content, title, profile);

  if (devMode === "quick" || !hasAnyModelKey()) {
    return fallback;
  }

  const prompt = `
당신은 사용자가 대충 적은 토론 안건을 실제 회의 안건으로 정리하는 사람입니다.
오타, 줄임말, 뒤죽박죽 문장이 있어도 의미를 추론하되, 원문에 없는 큰 사실을 새로 만들지 마세요.

사용자 원문:
${content}

임시 제목:
${title}

분류 힌트:
${profile.label}

반환 규칙:
- 한국어 JSON만 반환합니다. 마크다운은 쓰지 않습니다.
- topic은 회의에서 바로 쓸 수 있는 명사형 주제로 씁니다.
- coreQuestion은 실제 의사결정 질문으로 씁니다.
- inferredOptions는 가능한 선택지나 방향을 2~4개로 추론합니다.
- inferredConcerns는 사용자가 걱정할 만한 핵심 리스크를 2~5개로 추론합니다.
- focusAreas는 토론이 봐야 할 기준을 4개 이내로 씁니다.
- complexity는 simple, normal, complex 중 하나입니다.
- rotationCount는 simple이면 1, normal이면 2, complex이면 3을 원칙으로 합니다.
- discussionFrames는 이 주제에 맞는 논리 토론 쟁점 제목입니다. 고정 문구를 쓰지 말고 rotationCount 개수만큼 만듭니다.
- summary는 원문 의미를 1~2문장으로 자연스럽게 정리합니다.

JSON 형식:
{
  "topic": "정리된 주제",
  "coreQuestion": "핵심 질문",
  "inferredOptions": ["선택지"],
  "inferredConcerns": ["우려"],
  "focusAreas": ["검토 기준"],
  "complexity": "simple | normal | complex",
  "rotationCount": 1,
  "discussionFrames": ["토론 쟁점"],
  "summary": "원문 의미 정리"
}
`;

  for (const generator of [() => askOpenAI(prompt), () => askGemini(prompt)]) {
    try {
      return normalizeInterpretedAgenda(parseInterpretedAgenda(await generator()), fallback);
    } catch (error) {
      console.error("[debate-stream] agenda interpretation failed", error);
    }
  }

  return fallback;
}

function fallbackInterpretedAgenda(content: string, title: string, profile: TopicProfile): InterpretedAgenda {
  const normalized = content.trim().split(/\s+/).join(" ");
  const readableTopic = makeReadableTopic(title || normalized);
  const coreQuestion = makeFallbackCoreQuestion(readableTopic);
  const complexity = inferFallbackComplexity(normalized, profile.type);
  const rotationCount = complexity === "simple" ? 1 : complexity === "complex" ? 3 : 2;
  return {
    topic: readableTopic,
    coreQuestion,
    inferredOptions: ["진행", "작게 검증", "보류"],
    inferredConcerns: ["수요 불확실성", "비용과 실행 부담", "실패 시 손실"],
    focusAreas: defaultFocusAreas(profile.type),
    complexity,
    rotationCount,
    discussionFrames: defaultDiscussionFrames(readableTopic, profile.type, rotationCount),
    summary: `사용자가 적은 안건은 ${readableTopic}에 대해 현실적인 판단 기준과 실행 조건을 정리해야 한다는 의미로 해석됩니다.`,
  };
}

function makeFallbackCoreQuestion(topic: string) {
  const trimmed = topic.trim().replace(/[.。]+$/, "");
  if (!trimmed) return "이 안건에서 실제로 먼저 판단해야 할 기준은 무엇인가?";
  if (/[?？]$/.test(trimmed) || /(까|나|을까|일까|할까|해야 하나|해야 하는가|필요한가)$/.test(trimmed)) {
    return /[?？]$/.test(trimmed) ? trimmed : `${trimmed}?`;
  }
  return `${trimmed}를 판단하려면 무엇을 먼저 확인해야 하는가?`;
}

function parseInterpretedAgenda(text: string): Partial<InterpretedAgenda> {
  const source = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start < 0 || end < start) return {};

  try {
    return JSON.parse(source.slice(start, end + 1)) as Partial<InterpretedAgenda>;
  } catch {
    return {};
  }
}

function normalizeInterpretedAgenda(value: Partial<InterpretedAgenda>, fallback: InterpretedAgenda): InterpretedAgenda {
  const topic = cleanText(value.topic, fallback.topic);
  const coreQuestion = cleanText(value.coreQuestion, fallback.coreQuestion);
  const inferredOptions = normalizeShortList(value.inferredOptions, fallback.inferredOptions, 4);
  const inferredConcerns = normalizeShortList(value.inferredConcerns, fallback.inferredConcerns, 5);
  const focusAreas = normalizeShortList(value.focusAreas, fallback.focusAreas, 4);
  const complexity = normalizeComplexity(value.complexity, fallback.complexity);
  const rotationCount = rotationCountForComplexity(complexity, value.rotationCount ?? fallback.rotationCount);
  const discussionFrames = normalizeDiscussionFrames(
    normalizeShortList(value.discussionFrames, fallback.discussionFrames, 3),
    { ...fallback, topic, complexity },
    rotationCount,
  );

  return {
    topic,
    coreQuestion,
    inferredOptions,
    inferredConcerns,
    focusAreas,
    complexity,
    rotationCount,
    discussionFrames,
    summary: cleanText(value.summary, fallback.summary),
  };
}

async function generateTurn(speaker: SpeakerId, prompt: string, fallback: string): Promise<GeneratedTurn> {
  try {
    if (speaker === "moderator") return { message: await askOpenAI(prompt), status: "live" };
    if (speaker === "claude") return { message: await askClaude(prompt), status: "live" };
    if (speaker === "gpt") return { message: await askOpenAI(prompt), status: "live" };
    return { message: await askGemini(prompt), status: "live" };
  } catch (error) {
    console.error(`[debate-stream] ${speaker} generator failed`, error);
  }

  if (speaker === "moderator") {
    try {
      return { message: await askGemini(prompt), status: "assisted" };
    } catch (error) {
      console.error("[debate-stream] moderator assisted generator failed", error);
    }
  }

  if (speaker !== "gpt" && speaker !== "moderator") {
    try {
      return { message: await askOpenAI(prompt), status: "assisted" };
    } catch (error) {
      console.error(`[debate-stream] ${speaker} assisted generator failed`, error);
    }
  }

  return { message: fallback, status: "fallback" };
}

async function askOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const data = await fetchJson<{ choices?: Array<{ message?: { content?: string } }> }>(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.35,
      }),
    },
    "OpenAI",
  );

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty text");
  return text;
}

async function askClaude(prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing");

  const data = await fetchJson<{ content?: Array<{ type?: string; text?: string }> }>(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 650,
        temperature: 0.35,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    "Claude",
  );

  const text = data.content?.find((part) => part.type === "text" && part.text)?.text?.trim();
  if (!text) throw new Error("Claude returned empty text");
  return text;
}

async function askGemini(prompt: string) {
  const apiKey =
    process.env.GOOGLE_AI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is missing");

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const data = await fetchJson<{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 650 },
      }),
    },
    "Gemini",
  );

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned empty text");
  return text;
}

async function fetchJson<T>(url: string, init: RequestInit, provider: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs);

  let response: Response;

  try {
    response = await fetch(url, { ...init, signal: init.signal ?? controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${provider} request timed out after ${providerTimeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${provider} request failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}

function buildTurnPrompt(input: NormalizedInput, profile: TopicProfile, plan: TurnPlan, history: string[]) {
  const meta = speakerMeta[plan.speaker];
  const previous = history.at(-1) ?? "없음";
  const recent = history.slice(-4).map((item) => `- ${item}`).join("\n") || "- 없음";
  const roleRule = plan.speaker === "gemini"
    ? `- Gemini는 Claude와 GPT의 의견을 모두 받아서 균형점, 판단 기준, 현실적 다음 조건을 말합니다.
- Gemini 발언은 짧게 끊기면 안 됩니다. 반드시 2~4문장으로 완결합니다.`
    : "";
  const outputRule = plan.phase === "topic"
    ? `- 아래 형식을 그대로 지킵니다.
주제:
${input.agenda.topic}

핵심 질문:
${input.agenda.coreQuestion}
- 추가 설명은 붙이지 않습니다.`
    : `- 반드시 존댓말/합니다체로 씁니다. "한다", "된다", "필요하다", "판단한다" 같은 보고서식 반말 종결을 쓰지 않습니다.
- 아래 형식을 그대로 지킵니다.
핵심 의견: 핵심 판단 1문장
장점:
- 장점 1
- 장점 2
단점:
- 단점 1
- 단점 2
인사이트:
핵심 인사이트 1문장
- 장점과 단점은 각각 2개 이내로 씁니다.
- 인사이트는 반드시 완결된 존댓말 1문장으로 씁니다.
- 첫 문장을 "동의합니다", "인정합니다", "타당합니다" 같은 맞장구만으로 끝내지 않습니다.
- 직전 발언이 있으면 첫 문장 안에 그 논리나 전제를 받은 뒤, 바로 자신의 핵심 판단을 함께 말합니다.
- 정리된 주제나 핵심 질문 문장을 첫머리에 그대로 반복하지 않습니다. 필요한 경우 "이 안건", "그 전제", "이 판단"처럼 받아서 말합니다.
- "동의합니다", "다만", "하지만", "그 지적은", "그 우려는", "두 의견을 합치면"처럼 연결 신호를 자연스럽게 사용합니다.
- 근거 없는 단정은 피하고 필요한 추가 확인을 말합니다.
- 최종 판단은 마지막 결론에서만 내립니다.`;

  return `
당신은 ${meta.speakerName}입니다.
역할: ${meta.stanceName}

이 서비스의 기준 지침:
- 목표는 새로운 스타일이 아니라 실제 전문가 회의처럼 이어지는 3관점 논리 토론입니다.
- 사회자는 주제 정의와 쟁점 정리만 담당하고 찬반 의견을 내지 않습니다.
- Claude는 낙관 관점, GPT는 비관 관점, Gemini는 중간 관점입니다.
- 보고서, 논문, 역할극, 발표문처럼 쓰지 않습니다.
- 각 발언은 직전 발언의 논리를 받아 인정, 반박, 보완 중 하나를 반드시 수행합니다.
- 과한 캐릭터성, 감정적 싸움, 밈, 농담, 수다체를 쓰지 않습니다.

사용자 안건:
원문: ${input.originalContent}
정리된 주제: ${input.agenda.topic}
핵심 질문: ${input.agenda.coreQuestion}
추론된 선택지: ${input.agenda.inferredOptions.join(" / ")}
추론된 우려: ${input.agenda.inferredConcerns.join(", ")}
검토 기준: ${input.agenda.focusAreas.join(", ")}
주제 분류: ${profile.label}
판단 프레임: ${profile.decisionFrame}
근거 규칙: ${profile.evidenceRule}

현재 단계:
${plan.roundTitle}
이번 발언 지시: ${plan.instruction}

직전 발언:
${previous}

최근 흐름:
${recent}

출력 규칙:
- 한국어만 사용합니다.
- 이름으로 시작하지 않습니다.
- 존댓말/합니다체만 사용합니다.
- 마지막 문장은 반드시 완결된 한국어 문장으로 끝냅니다.
${roleRule}
${outputRule}
`;
}

function fallbackTurn(input: NormalizedInput, profile: TopicProfile, plan: TurnPlan, history: string[]) {
  const previousName = previousSpeakerName(history);
  const subject = input.agenda.topic;
  const question = input.agenda.coreQuestion;
  const focusText = input.agenda.focusAreas.join(", ") || profile.decisionFrame;
  const optionsText = input.options ? ` 선택지는 ${input.options}입니다.` : "";
  const riskText = input.risks ? ` 입력된 우려는 ${input.risks}입니다.` : "";

  if (plan.phase === "topic") {
    return `주제:\n${subject}\n\n핵심 질문:\n${question}${optionsText || riskText ? `\n\n참고:\n${`${optionsText}${riskText}`.trim()}` : ""}`;
  }

  if (plan.phase === "opening" && plan.speaker === "claude") {
    return makeAnalysisTurn(
      "사회자가 정리한 기준을 보면 이 안건은 가능성을 버리기보다 작은 검증으로 먼저 확인하는 쪽이 현실적입니다.",
      [
        `${subject}은 기존 방식의 한계를 보완할 기회가 있습니다`,
        `처음부터 전면 추진하지 않으면 비용과 실패 부담을 줄일 수 있습니다`,
      ],
      [
        "검증 범위가 흐리면 실행 효과를 판단하기 어렵습니다",
        "초기 기대가 과하면 실제 성과보다 조직 부담이 먼저 커질 수 있습니다",
      ],
      "핵심은 크게 선언하는 것이 아니라 작게 증명할 수 있는 첫 범위를 정하는 것입니다.",
    );
  }

  if (plan.phase === "opening" && plan.speaker === "gpt") {
    return makeAnalysisTurn(
      "Claude가 말한 가능성은 인정하지만, 성공 기준과 중단 기준이 없으면 비용 누수가 먼저 생길 수 있습니다.",
      [
        "작게 시작하면 리스크를 조기에 확인할 수 있습니다",
        "성과 기준을 숫자로 잡으면 확대 여부를 판단하기 쉽습니다",
      ],
      [
        `${input.risks || "수요, 비용, 책임 주체, 실패했을 때의 손실"}을 확인하지 않으면 낙관이 앞설 수 있습니다`,
        "책임자와 비용 한도가 없으면 실험이 장기 과제로 늘어질 수 있습니다",
      ],
      "가능성보다 먼저 확인해야 할 것은 돈과 시간, 책임을 어디까지 감당할지입니다.",
    );
  }

  if (plan.phase === "opening" && plan.speaker === "gemini") {
    return makeAnalysisTurn(
      "두 의견을 합치면 핵심은 찬반보다 검증 조건을 먼저 세우는 것입니다.",
      [
        "Claude의 관점처럼 가능성을 완전히 닫을 필요는 없습니다",
        "검토 기준을 나누면 작은 실행으로도 판단 근거를 만들 수 있습니다",
      ],
      [
        "GPT의 지적처럼 실패 기준이 없으면 실행 판단이 흐려집니다",
        "진행과 보류의 조건이 없으면 회의 결론이 실제 행동으로 이어지기 어렵습니다",
      ],
      `${focusText} 기준으로 성공 조건과 중단 조건을 먼저 합의해야 합니다.`,
    );
  }

  if (plan.phase === "discussion" && plan.speaker === "claude") {
    const frame = fallbackFrameContext(input, profile, plan.roundTitle);

    return makeAnalysisTurn(
      `${previousName}의 우려를 반영하더라도, ${plan.roundTitle} 쟁점은 ${frame.opportunity} 쪽으로 초점을 맞추면 가능성이 있습니다.`,
      frame.claudePros,
      frame.claudeCons,
      frame.claudeInsight,
    );
  }

  if (plan.phase === "discussion" && plan.speaker === "gpt") {
    const frame = fallbackFrameContext(input, profile, plan.roundTitle);

    return makeAnalysisTurn(
      `Claude의 제안은 ${frame.opportunity} 측면의 가능성을 살릴 수 있지만, ${frame.mainRisk} 문제가 정리되지 않으면 ${plan.roundTitle}에서 부담이 먼저 커질 수 있습니다.`,
      frame.gptPros,
      frame.gptCons,
      frame.gptInsight,
    );
  }

  if (plan.phase === "discussion" && plan.speaker === "gemini") {
    const frame = fallbackFrameContext(input, profile, plan.roundTitle);

    return makeAnalysisTurn(
      `GPT의 지적까지 반영하면 ${plan.roundTitle}의 균형점은 ${frame.balance}입니다.`,
      frame.geminiPros,
      frame.geminiCons,
      frame.geminiInsight,
    );
  }

  const issueFrames = input.agenda.discussionFrames.length
    ? input.agenda.discussionFrames
    : [focusText];
  const issueContexts = issueFrames.slice(0, 3).map((frame) => fallbackFrameContext(input, profile, frame));

  return makeAnalysisTurn(
    `두 의견을 종합하면 ${subject}의 핵심 쟁점은 ${issueContexts.map((item) => item.shortName).join(", ")}입니다.`,
    issueContexts.map((item) => item.issuePros).slice(0, 2),
    issueContexts.map((item) => item.issueCons).slice(0, 2),
    `최종 판단은 ${focusText} 기준을 실제 의사결정 조건으로 바꿀 수 있는지에 달려 있습니다.`,
  );
}

function fallbackFrameContext(input: NormalizedInput, profile: TopicProfile, frameTitle: string) {
  const subject = input.agenda.topic;
  const frame = frameTitle || "핵심 판단 기준";
  const source = frame;
  const fullSource = `${frame} ${input.agenda.topic} ${input.agenda.coreQuestion}`;
  const match = (pattern: RegExp) => pattern.test(source);

  if (match(/재무|비용|투자|예산|수익|손익|ROI|매출|원가|자금|경제성/i)) {
    return {
      shortName: "재무 영향",
      opportunity: "초기 비용 대비 기대 효과",
      mainRisk: "투자 규모와 회수 기준",
      balance: "전면 투자보다 예산 한도와 성과 게이트를 둔 단계적 투자",
      claudePros: [
        `${subject}이 비용을 쓰더라도 장기 경쟁력이나 생산성 개선으로 이어지는지 확인할 수 있습니다`,
        "작은 예산으로 시작하면 투자 명분과 내부 설득 근거를 동시에 만들 수 있습니다",
      ],
      claudeCons: [
        "초기 비용만 보고 중장기 학습 효과를 놓치면 과소투자될 수 있습니다",
        "성과 지표가 모호하면 좋은 결과도 재무 판단으로 연결되기 어렵습니다",
      ],
      claudeInsight: "재무 관점에서는 큰 예산보다 먼저 측정 가능한 비용 단위와 기대 효과를 정해야 합니다.",
      gptPros: [
        "예산 한도와 평가 시점을 정하면 손실이 커지기 전에 조정할 수 있습니다",
        "단계별 투자 기준이 있으면 실패한 방향을 빠르게 멈출 수 있습니다",
      ],
      gptCons: [
        "회수 기준이 없으면 전략이라는 이름으로 비용이 계속 늘어날 수 있습니다",
        "간접 효과만 강조하면 실제 손익 기여를 설명하기 어렵습니다",
      ],
      gptInsight: "재무 리스크를 줄이려면 투자 전 기대 효과, 비용 상한, 중단 기준이 먼저 필요합니다.",
      geminiPros: [
        "재무성과와 전략적 학습 효과를 나눠 보면 단기 비용 논쟁을 줄일 수 있습니다",
        "작은 예산의 검증 단계는 추천과 보류 사이의 현실적 중간 지점이 될 수 있습니다",
      ],
      geminiCons: [
        "숫자로 잡을 지표가 없으면 다음 투자 판단이 다시 감으로 돌아갈 수 있습니다",
        "비용 책임자가 불분명하면 실행 후 평가가 약해질 수 있습니다",
      ],
      geminiInsight: "균형점은 비용을 막는 것이 아니라 투자 단계를 나누고 다음 의사결정 기준을 선명하게 두는 것입니다.",
      issuePros: "재무 효과는 비용 상한과 성과 지표를 정하면 검증 가능한 쟁점이 됩니다",
      issueCons: "회수 기준이 없으면 가능성이 있어도 비용 부담이 먼저 커질 수 있습니다",
    };
  }

  if (match(/기존|현재|소분자|레거시|포트폴리오|R&D|연구|파이프라인|자원\s*배분/i)) {
    return {
      shortName: "기존 R&D 영향",
      opportunity: "기존 R&D 자산과 새 방향의 연결성",
      mainRisk: "기존 파이프라인과 인력의 자원 잠식",
      balance: "기존 R&D를 버리는 전환이 아니라 선택 기준을 다시 세우는 포트폴리오 조정",
      claudePros: [
        `${subject}은 기존 R&D의 한계를 보완하고 새로운 성장 옵션을 만들 수 있습니다`,
        "기존 과제와 연결되는 영역부터 시작하면 전환 부담을 낮출 수 있습니다",
      ],
      claudeCons: [
        "기존 과제와 분리된 별도 조직처럼 움직이면 현장 적용이 약해질 수 있습니다",
        "전환 메시지가 강하면 기존 연구 인력이 위축될 수 있습니다",
      ],
      claudeInsight: "기존 R&D 관점에서는 대체가 아니라 연결 가능한 파이프라인을 먼저 고르는 것이 중요합니다.",
      gptPros: [
        "기존 과제와 충돌하지 않는 범위를 정하면 내부 저항을 줄일 수 있습니다",
        "포트폴리오 기준을 세우면 어떤 과제를 계속할지 더 명확해집니다",
      ],
      gptCons: [
        "자원이 새 조직으로만 이동하면 기존 R&D 성과가 흔들릴 수 있습니다",
        "기존 방식보다 나은 근거가 없으면 조직 내부에서 명분을 얻기 어렵습니다",
      ],
      gptInsight: "기존 R&D에 미치는 영향은 기회이자 리스크이므로, 자원 배분 원칙부터 공개적으로 정해야 합니다.",
      geminiPros: [
        "기존 R&D와 새 전환 영역을 경쟁 관계가 아니라 역할 분담으로 볼 수 있습니다",
        "공통 데이터와 평가 기준을 쓰면 두 방향의 시너지를 확인할 수 있습니다",
      ],
      geminiCons: [
        "우선순위가 흐리면 기존 과제도 새 과제도 모두 중간 성과에 그칠 수 있습니다",
        "전환 대상 파이프라인을 고르지 않으면 논의가 선언에 머물 수 있습니다",
      ],
      geminiInsight: "균형점은 기존 R&D를 유지하되 새 방향이 붙을 과제와 빠질 과제를 명확히 나누는 것입니다.",
      issuePros: "기존 R&D와 연결되는 과제를 고르면 전환의 내부 명분을 만들 수 있습니다",
      issueCons: "자원 배분 기준이 없으면 기존 파이프라인과 새 조직이 충돌할 수 있습니다",
    };
  }

  if (match(/데이터|AI|기술|플랫폼|모델|시스템|보안|인프라|자동화|품질|운영\s*부담/i)) {
    return {
      shortName: "기술·데이터 기반",
      opportunity: "데이터와 기술의 의사결정 연결성",
      mainRisk: "데이터 품질과 시스템 준비 부족",
      balance: "기술 도입보다 데이터 품질과 사용 장면을 먼저 정하는 방식",
      claudePros: [
        `${subject}은 반복 업무와 의사결정 속도를 개선할 기회를 줄 수 있습니다`,
        "활용 장면을 좁히면 데이터와 기술의 효과를 빠르게 확인할 수 있습니다",
      ],
      claudeCons: [
        "데이터가 흩어져 있으면 모델 성능보다 정리 비용이 먼저 커질 수 있습니다",
        "보안과 품질 기준이 약하면 현장 적용이 제한될 수 있습니다",
      ],
      claudeInsight: "기술 관점의 출발점은 좋은 도구보다 바로 쓸 수 있는 데이터와 업무 장면입니다.",
      gptPros: [
        "데이터 기준을 먼저 잡으면 기술 실패를 조기에 확인할 수 있습니다",
        "보안과 접근 권한을 정하면 운영 리스크를 줄일 수 있습니다",
      ],
      gptCons: [
        "데이터 품질이 낮으면 AI 도입 효과를 설명하기 어렵습니다",
        "시스템 연동이 늦어지면 파일럿이 실제 운영으로 넘어가지 못할 수 있습니다",
      ],
      gptInsight: "기술 리스크를 낮추려면 모델보다 데이터 소유권, 품질, 보안 기준을 먼저 정해야 합니다.",
      geminiPros: [
        "기술 적용 범위를 좁히면 실패 비용을 낮추면서 학습할 수 있습니다",
        "업무 흐름 안에 들어간 데이터 기준은 장기 자산이 될 수 있습니다",
      ],
      geminiCons: [
        "기술 검증과 업무 검증을 분리하면 실제 효과를 놓칠 수 있습니다",
        "운영 기준이 없으면 좋은 기술도 일회성 실험으로 끝날 수 있습니다",
      ],
      geminiInsight: "균형점은 기술 성능만 보지 않고 데이터 품질, 보안, 업무 적용성을 함께 보는 것입니다.",
      issuePros: "데이터와 기술 기반이 갖춰지면 실행 속도와 판단 품질을 높일 수 있습니다",
      issueCons: "데이터 품질과 보안 기준이 약하면 기술 도입 효과가 제한될 수 있습니다",
    };
  }

  if (match(/시장|고객|수요|사용자|환자|판매|브랜드|경쟁|사업|매출/i)) {
    return {
      shortName: "시장·고객 수요",
      opportunity: "실제 수요와 차별성",
      mainRisk: "수요 강도와 구매 전환의 불확실성",
      balance: "시장 전체 전망보다 특정 고객군과 사용 장면을 먼저 검증하는 방식",
      claudePros: [
        `${subject}은 명확한 고객 문제를 잡으면 시장에서 새 선택지가 될 수 있습니다`,
        "초기 고객군을 좁히면 차별성과 반응을 빠르게 확인할 수 있습니다",
      ],
      claudeCons: [
        "시장 전망만으로는 실제 구매나 사용 행동을 설명하기 어렵습니다",
        "고객군이 넓으면 메시지와 제품 기준이 흐려질 수 있습니다",
      ],
      claudeInsight: "시장 관점에서는 전체 규모보다 누가 왜 바꿀지부터 확인해야 합니다.",
      gptPros: [
        "고객 반응을 먼저 보면 불필요한 확대를 막을 수 있습니다",
        "경쟁 대안과 비교하면 실제 전환 이유를 더 분명히 볼 수 있습니다",
      ],
      gptCons: [
        "수요가 약하면 좋은 콘셉트도 반복 구매나 사용으로 이어지기 어렵습니다",
        "차별성이 약하면 가격이나 마케팅 비용 경쟁으로 밀릴 수 있습니다",
      ],
      gptInsight: "시장 리스크는 필요해 보인다는 말과 실제 선택 행동 사이의 차이에서 생깁니다.",
      geminiPros: [
        "고객군과 사용 상황을 좁히면 가능성과 리스크를 동시에 볼 수 있습니다",
        "경쟁 대안 대비 장점을 검증하면 실행 우선순위를 정하기 쉽습니다",
      ],
      geminiCons: [
        "시장 정의가 넓으면 토론 결론이 막연한 전망으로 흐를 수 있습니다",
        "고객 검증 없이 제품이나 조직부터 만들면 실패 비용이 커질 수 있습니다",
      ],
      geminiInsight: "균형점은 시장을 크게 보는 것이 아니라 첫 고객과 첫 사용 장면을 구체화하는 것입니다.",
      issuePros: "고객군과 사용 장면을 좁히면 실제 수요를 검증할 수 있습니다",
      issueCons: "수요 강도가 약하면 실행 명분이 있어도 성과로 이어지기 어렵습니다",
    };
  }

  if (match(/조직|역량|인력|교육|문화|거버넌스|프로세스|현장|채용|권한|협업|조직\s*운영/i)) {
    return {
      shortName: "조직 역량",
      opportunity: "조직 학습과 실행 체계",
      mainRisk: "인력 역량과 권한 구조의 미비",
      balance: "전담 조직 선언보다 현장 참여, 권한, 교육, 평가 기준을 함께 세우는 방식",
      claudePros: [
        `${subject}은 조직 내부에 새 역량을 쌓는 계기가 될 수 있습니다`,
        "작은 성공 사례를 만들면 현장 연구자와 사업 부서의 참여를 끌어낼 수 있습니다",
      ],
      claudeCons: [
        "전담 조직만 만들고 현장 권한이 없으면 실제 변화가 느릴 수 있습니다",
        "교육 없이 도구만 도입하면 사용성이 낮아질 수 있습니다",
      ],
      claudeInsight: "조직 역량은 사람을 새로 뽑는 문제를 넘어 현장이 반복해서 쓰는 구조를 만드는 문제입니다.",
      gptPros: [
        "역할과 책임을 명확히 하면 실행 속도와 평가 책임을 높일 수 있습니다",
        "교육과 파일럿을 묶으면 역량 부족을 단계적으로 줄일 수 있습니다",
      ],
      gptCons: [
        "권한 없는 조직은 조정 회의만 늘리고 실제 의사결정을 바꾸기 어렵습니다",
        "핵심 인력이 부족하면 외부 협력도 내부 자산으로 남기 어렵습니다",
      ],
      gptInsight: "조직 리스크의 핵심은 조직도보다 권한, 인력, 반복 운영 방식이 준비되어 있는지입니다.",
      geminiPros: [
        "전담 조직과 현장 조직의 역할을 나누면 실행 부담을 줄일 수 있습니다",
        "교육, 프로젝트, 평가를 함께 설계하면 역량 강화가 실제 성과로 이어질 수 있습니다",
      ],
      geminiCons: [
        "성과 평가가 없으면 조직 학습이 개인 역량에만 의존할 수 있습니다",
        "현장 부서가 참여하지 않으면 새 조직이 고립될 수 있습니다",
      ],
      geminiInsight: "균형점은 별도 조직을 만드는 것과 동시에 현장 부서가 함께 책임지는 운영 구조를 두는 것입니다.",
      issuePros: "조직 역량은 권한과 교육 체계를 붙이면 실행 가능한 쟁점이 됩니다",
      issueCons: "전담 조직만 만들면 실제 현장 변화 없이 비용 조직으로 보일 수 있습니다",
    };
  }

  if (match(/규제|임상|안전|허가|식약처|FDA|보험|수가|법률|책임|윤리/i) || (profile.type === "pharma" && /규제|임상|안전|허가|근거|환자/.test(fullSource))) {
    return {
      shortName: "규제·안전성",
      opportunity: "공식 근거와 절차 기반의 신뢰성",
      mainRisk: "규제와 안전성 검증 부족",
      balance: "사업성 판단보다 안전성, 허가, 책임 기준을 먼저 확인하는 방식",
      claudePros: [
        `${subject}은 규제 기준을 초기에 반영하면 신뢰 가능한 실행 방향을 만들 수 있습니다`,
        "작은 검증 단계에서도 공식 근거를 쌓으면 이후 의사결정이 쉬워질 수 있습니다",
      ],
      claudeCons: [
        "규제 절차를 늦게 확인하면 개발 방향을 다시 바꿔야 할 수 있습니다",
        "안전성 기준이 약하면 시장성 논의가 의미를 잃을 수 있습니다",
      ],
      claudeInsight: "규제 관점에서는 빠른 실행보다 초기에 확인할 공식 기준을 정하는 것이 핵심입니다.",
      gptPros: [
        "규제 조건을 먼저 확인하면 되돌리기 어려운 비용을 줄일 수 있습니다",
        "안전성과 책임 범위를 정하면 내부 승인 기준이 명확해집니다",
      ],
      gptCons: [
        "근거가 부족하면 출시나 확대 판단이 보류될 가능성이 큽니다",
        "책임 주체가 불명확하면 작은 실험도 조직 리스크가 될 수 있습니다",
      ],
      gptInsight: "이 쟁점은 가능성보다 공식 근거, 안전성, 책임 구조가 먼저입니다.",
      geminiPros: [
        "규제 기준과 사업 기준을 분리하면 무엇을 먼저 검증할지 명확해집니다",
        "초기부터 근거 자료를 쌓으면 보류와 진행의 기준을 객관화할 수 있습니다",
      ],
      geminiCons: [
        "시장성만 보고 움직이면 규제 단계에서 다시 멈출 수 있습니다",
        "근거 수준이 낮으면 토론 결론이 실제 승인으로 이어지기 어렵습니다",
      ],
      geminiInsight: "균형점은 가능성을 닫지 않되 공식 근거와 안전성 검증을 첫 관문으로 두는 것입니다.",
      issuePros: "공식 근거와 규제 기준을 먼저 잡으면 신뢰도 있는 판단이 가능합니다",
      issueCons: "안전성이나 책임 기준이 부족하면 사업성 논의보다 보류 판단이 앞설 수 있습니다",
    };
  }

  return {
    shortName: frame,
    opportunity: "작은 검증을 통한 판단 근거",
    mainRisk: "성공 기준과 중단 기준의 부재",
    balance: "가능성은 살리되 범위, 책임, 평가 기준을 먼저 정하는 조건부 검증",
    claudePros: [
      `${subject}은 제한된 범위에서 시작하면 가능성을 확인할 수 있습니다`,
      "검증 결과가 좋을 때만 확대하면 전략적 선택지를 유지할 수 있습니다",
    ],
    claudeCons: [
      "실험 대상이 너무 넓으면 무엇이 성공 요인인지 알기 어렵습니다",
      "현장 참여가 약하면 결과가 실제 운영 변화로 이어지지 않을 수 있습니다",
    ],
    claudeInsight: `${frame}에서는 먼저 작고 측정 가능한 단위로 쪼개는 것이 중요합니다.`,
    gptPros: [
      "비용 한도와 검증 기간을 정하면 손실을 통제할 수 있습니다",
      "책임자를 정하면 실행 후 평가가 흐려지는 문제를 줄일 수 있습니다",
    ],
    gptCons: [
      "성과 기준이 없으면 시간을 쓰고도 결론을 내기 어렵습니다",
      "중단 조건이 약하면 실패한 실험도 관성적으로 계속될 수 있습니다",
    ],
    gptInsight: `${frame}에서는 시작 여부보다 멈출 수 있는 구조를 먼저 설계해야 안전합니다.`,
    geminiPros: [
      "작은 검증은 가능성을 살리면서 리스크를 낮출 수 있습니다",
      `${input.agenda.focusAreas.join(", ") || profile.decisionFrame} 기준을 쓰면 토론 결과를 실행 판단으로 연결할 수 있습니다`,
    ],
    geminiCons: [
      "성과와 중단 기준이 없으면 조건부 검증이라는 말이 형식에 그칠 수 있습니다",
      "초기 범위가 넓으면 리스크 통제가 어려워집니다",
    ],
    geminiInsight: `${frame}의 균형점은 실행을 미루는 것이 아니라 검증 가능한 실행으로 좁히는 것입니다.`,
    issuePros: `${frame}은 검증 범위와 평가 기준을 정하면 실행 판단으로 연결될 수 있습니다`,
    issueCons: `${frame}의 중단 기준이 없으면 좋은 의도도 관성적 실행으로 흐를 수 있습니다`,
  };
}

function makeAnalysisTurn(headline: string, pros: string[], cons: string[], insight: string) {
  return [
    `핵심 의견: ${headline}`,
    "장점:",
    ...pros.slice(0, 2).map((item) => `- ${item}`),
    "단점:",
    ...cons.slice(0, 2).map((item) => `- ${item}`),
    "인사이트:",
    insight,
  ].join("\n");
}

function shouldUseFallback(message: string, plan: TurnPlan, history: string[], input: NormalizedInput) {
  const normalized = message.trim();

  if (!normalized) return true;
  if (containsForbiddenTone(normalized)) return true;
  if (plan.phase !== "topic" && containsNonPoliteEnding(normalized)) return true;
  if (plan.phase !== "topic" && normalized.length > 850) return true;
  if (plan.phase === "topic" && countSentences(normalized) > 5) return true;
  if (plan.phase !== "topic" && countSentences(normalized) < 2) return true;
  if (plan.phase !== "topic" && !looksCompleteSentence(normalized)) return true;
  if (plan.phase !== "topic" && plan.speaker === "gemini" && normalized.length < 90) return true;
  if (plan.phase !== "topic" && !hasAgendaOverlap(normalized, input)) return true;
  if (plan.phase !== "topic" && history.length && !hasConnectionSignal(normalized)) return true;
  if (plan.phase !== "topic" && startsWithAgendaEcho(normalized, input)) return true;

  return false;
}

function isSafeFallback(message: string, plan: TurnPlan, input: NormalizedInput) {
  const normalized = message.trim();

  if (!normalized) return false;
  if (containsForbiddenTone(normalized)) return false;
  if (containsNonPoliteEnding(normalized)) return false;

  if (plan.phase !== "topic") {
    if (!hasAnalysisSections(normalized)) return false;
    if (countSentences(normalized) < 2) return false;
    if (!looksCompleteSentence(normalized)) return false;
  }

  return true;
}

function cleanTurnMessage(message: string) {
  return normalizeKoreanPoliteTone(message)
    .replace(/^["“”]+|["“”]+$/g, "")
    .replace(/^(사회자|(Claude|GPT|Gemini)\s*교수)\s*[:：]\s*/i, "")
    .trim();
}

function containsForbiddenTone(value: string) {
  return /(ㅋㅋ|ㅠㅠ|밈|예능|카페형|카페\s*수다|카페\s*토크|매콤|농담|드립|웃기|수다|comic|roleplay|inner thought)/i.test(value);
}

function containsNonPoliteEnding(value: string) {
  const sentenceEndings = value
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .filter((line) => /[.!?。！？]$/.test(line));

  return sentenceEndings.some((line) =>
    /(해야 한다|해야한다|되어야 한다|되어야한다|필요하다|판단한다|말한다|본다|크다|작다|높다|낮다|어렵다|가능하다|중요하다|충분하다|부족하다|있다|없다|아니다|된다|한다)[.!?。！？]$/.test(line),
  );
}

function hasAnalysisSections(value: string) {
  return /핵심\s*의견\s*[:：]/.test(value) && /장점\s*[:：]?/.test(value) && /단점\s*[:：]?/.test(value) && /인사이트\s*[:：]?/.test(value);
}

function normalizeKoreanPoliteTone(value: string) {
  return value
    .replace(/해야\s*한다([.!?。！？])/g, "해야 합니다$1")
    .replace(/되어야\s*한다([.!?。！？])/g, "되어야 합니다$1")
    .replace(/필요하다([.!?。！？])/g, "필요합니다$1")
    .replace(/판단한다([.!?。！？])/g, "판단합니다$1")
    .replace(/말한다([.!?。！？])/g, "말합니다$1")
    .replace(/본다([.!?。！？])/g, "봅니다$1")
    .replace(/가능하다([.!?。！？])/g, "가능합니다$1")
    .replace(/중요하다([.!?。！？])/g, "중요합니다$1")
    .replace(/충분하다([.!?。！？])/g, "충분합니다$1")
    .replace(/부족하다([.!?。！？])/g, "부족합니다$1")
    .replace(/어렵다([.!?。！？])/g, "어렵습니다$1")
    .replace(/커진다([.!?。！？])/g, "커집니다$1")
    .replace(/낮아진다([.!?。！？])/g, "낮아집니다$1")
    .replace(/높아진다([.!?。！？])/g, "높아집니다$1")
    .replace(/있다([.!?。！？])/g, "있습니다$1")
    .replace(/없다([.!?。！？])/g, "없습니다$1")
    .replace(/아니다([.!?。！？])/g, "아닙니다$1")
    .replace(/된다([.!?。！？])/g, "됩니다$1")
    .replace(/한다([.!?。！？])/g, "합니다$1");
}

function hasConnectionSignal(value: string) {
  return /(동의|다만|하지만|그 지적|그 우려|그 의견|그 부분|두 의견|두 관점|사회자|Claude|GPT|Gemini|앞선|이전|인정|반대로|보완)/.test(value);
}

function startsWithAgendaEcho(value: string, input: NormalizedInput) {
  const firstChunk = normalizeEchoText(value).slice(0, 140);
  const agendaPhrases = [
    input.agenda.topic,
    input.agenda.coreQuestion,
    input.originalContent,
  ]
    .map((item) => normalizeEchoText(item))
    .filter((item) => item.length >= 18);

  return agendaPhrases.some((phrase) => {
    const sample = phrase.slice(0, Math.min(42, phrase.length));
    return sample.length >= 18 && firstChunk.includes(sample);
  });
}

function normalizeEchoText(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function hasAgendaOverlap(value: string, input: NormalizedInput) {
  const keywords = agendaKeywords(input);

  if (!keywords.length) {
    return true;
  }

  const haystack = normalizeKeywordText(value);
  return keywords.some((keyword) => haystack.includes(keyword));
}

function agendaKeywords(input: NormalizedInput) {
  const source = [
    input.agenda.topic,
    input.agenda.coreQuestion,
    input.originalContent,
    input.options,
    input.risks,
    input.agenda.focusAreas.join(" "),
  ].join(" ");

  const stopwords = new Set([
    "사용자",
    "안건",
    "핵심",
    "질문",
    "판단",
    "기준",
    "무엇",
    "어떻게",
    "있는지",
    "해야",
    "할지",
    "할까",
    "될까",
    "대한",
    "관련",
    "정리",
    "현실적",
    "방향",
    "진행",
    "검토",
    "보류",
    "비용",
    "리스크",
    "실행",
    "수요",
    "근거",
  ]);

  return Array.from(
    new Set(
      source
        .replace(/[^0-9A-Za-z가-힣\s]/g, " ")
        .split(/\s+/)
        .map((token) => normalizeKeywordText(token))
        .map((token) => token.replace(/(에서는|에서|에게|으로|부터|까지|하고|이며|이고|은|는|이|가|을|를|의|와|과|도|만|로)$/u, ""))
        .filter((token) => token.length >= 2 && !stopwords.has(token)),
    ),
  ).slice(0, 12);
}

function normalizeKeywordText(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function isGenericConclusionSummary(summary: string, input: NormalizedInput) {
  const normalized = summary.replace(/\s+/g, " ").trim();
  const genericPatterns = [
    /지금 바로 단정하기보다 검증 가능한 범위부터 확인해야 합니다/,
    /성공 기준과 중단 기준을 먼저 정하는 편이 안전합니다/,
    /검토 기준을 같은 기준 위에 놓고/,
    /전면 실행이 아니라 작은 범위에서 검증/,
  ];
  const hasGenericPattern = genericPatterns.some((pattern) => pattern.test(normalized));

  if (!hasGenericPattern) {
    return false;
  }

  const keywords = agendaKeywords(input).filter((keyword) => keyword.length >= 3);
  const haystack = normalizeKeywordText(normalized);
  const matchingKeywordCount = keywords.filter((keyword) => haystack.includes(keyword)).length;

  return matchingKeywordCount < 2;
}

function countSentences(value: string) {
  return value.split(/[.!?。！？]\s+|[.!?。！？]$/).filter((part) => part.trim()).length;
}

function looksCompleteSentence(value: string) {
  const normalized = value.trim();
  return /[.!?。！？]$/.test(normalized) || /(다|요|니다|습니다|됩니다|입니다)$/.test(normalized);
}

async function generateFinalReport(
  input: NormalizedInput,
  profile: TopicProfile,
  history: string[],
  evidenceSources: Set<string>,
): Promise<FinalReport> {
  const fallback = fallbackFinal(input, profile, Array.from(evidenceSources));
  const prompt = `
당신은 3관점 논리 토론의 최종 정리자입니다.
아래 토론을 바탕으로 한국어 JSON만 반환하세요. 마크다운은 쓰지 마세요.

사용자 안건:
원문: ${input.originalContent}
정리된 주제: ${input.agenda.topic}
핵심 질문: ${input.agenda.coreQuestion}
추론된 선택지: ${input.agenda.inferredOptions.join(" / ")}
추론된 우려: ${input.agenda.inferredConcerns.join(", ")}
검토 기준: ${input.agenda.focusAreas.join(", ")}
주제 분류: ${profile.label}
근거 규칙: ${profile.evidenceRule}

토론 흐름:
${history.map((item) => `- ${item}`).join("\n")}

규칙:
- 판단은 "추천", "조건부 추천", "보류", "비추천" 중 하나만 사용합니다.
- recommendation은 내부 분류값입니다. 화면에서는 별도 제목으로 강조하지 않으므로, summary 첫 문장 안에 실제 판단을 자연스럽게 녹여 씁니다.
- 판단 기준은 아래처럼 구분합니다.
  - 추천: 근거가 충분하고, 리스크가 낮거나 통제 가능하며, 지금 실행해도 손실이 크지 않을 때.
  - 조건부 추천: 가능성은 있지만 불확실성이 있어 작게 검증하거나 조건을 걸고 진행해야 할 때.
  - 보류: 정보가 부족하거나, 지금 결정하면 추측이 너무 많아 먼저 확인이 필요할 때.
  - 비추천: 근거가 약하고 위험이나 손실이 크며, 실패 시 되돌리기 어려울 때.
- "애매함"만으로 조건부 추천을 선택하지 마세요. 애매하지만 작게 해볼 수 있으면 조건부 추천, 애매하고 지금 움직이면 위험하면 보류입니다.
- 보고서 말투를 과하게 쓰지 말고, 실제 회의 결론처럼 간결하게 정리합니다.
- 반드시 존댓말/합니다체로 씁니다. "한다", "된다", "필요하다", "판단한다" 같은 보고서식 반말 종결을 쓰지 않습니다.
- summary는 첫 문장 1개를 핵심 결론으로 쓰고, 이어서 1~2문장만 보충합니다.
- summary 첫 문장에는 recommendation 값을 자연스럽게 포함하되, "검증 가능한 범위부터 확인" 같은 일반론만 쓰지 말고 무엇을 왜 그렇게 판단하는지 드러냅니다.
- summary 첫 문장은 정리된 주제의 핵심 명사를 반드시 포함합니다. "이 안건", "이 주제"처럼 대명사만으로 시작하지 마세요.
- recommendation이 "조건부 추천"이면 어떤 조건이 충족되어야 하는지 첫 문장 또는 둘째 문장에 반드시 씁니다.
- recommendation이 "보류" 또는 "비추천"이면 무엇이 부족하거나 위험해서 그런지 첫 문장에 반드시 씁니다.
- summary와 nextActions는 정리된 주제와 핵심 질문에 직접 답해야 합니다. 어떤 안건에도 붙일 수 있는 문장은 실패입니다.
- nextActions는 "확인한다", "검토한다"만 쓰지 말고 담당 범위, 검증 대상, 중단 기준, 다음 의사결정 중 최소 2가지를 포함합니다.
- mainClaims는 Claude, GPT, Gemini의 주요 주장을 각각 1개씩 비교합니다.
- agreements는 세 관점이 공통으로 인정한 내용을 씁니다.
- disagreements는 의견이 갈린 부분이나 더 검증해야 할 차이를 씁니다.
- nextActions는 현실적인 실행 방향을 구체적으로 씁니다.
- 강한 시장/기술/의료 주장은 근거 자료가 있을 때만 씁니다.
- evidenceSources에는 실제 URL만 넣습니다.

JSON 형식:
{
  "recommendation": "추천 | 조건부 추천 | 보류 | 비추천",
  "summary": "핵심 결론 1문장 + 보충 1~2문장",
  "mainClaims": ["Claude: 주요 주장", "GPT: 주요 주장", "Gemini: 주요 주장"],
  "agreements": ["합의된 부분"],
  "disagreements": ["의견이 갈린 부분"],
  "nextActions": ["현실적인 실행 방향"],
  "evidenceSources": ["https://..."]
}
`;

  for (const generator of [() => askGemini(prompt), () => askOpenAI(prompt)]) {
    try {
      const parsed = parseFinalReport(await generator());
      const report = normalizeGeneratedFinalReport(parsed, input, evidenceSources);

      if (report) {
        return report;
      }

      throw new Error("Final report did not pass agenda validation");
    } catch (error) {
      console.error("[debate-stream] final generator failed", error);
    }
  }

  if (!isGenericFallbackFinalUsable(fallback)) {
    console.error("[debate-stream] generic fallback final did not pass validation; returning it to avoid an unfinished stream");
  }
  return fallback;
}

function fallbackFinal(input: NormalizedInput, profile: TopicProfile, sources: string[]): FinalReport {
  const focusItems = input.focusAreas.length ? input.focusAreas : defaultFocusAreas(profile.type);
  const focus = focusItems.join(", ");
  const riskText = input.agenda.inferredConcerns.length
    ? input.agenda.inferredConcerns.slice(0, 3).join(", ")
    : input.risks || "불확실성, 실행 부담, 실패 시 손실";
  const optionText = input.agenda.inferredOptions.length
    ? input.agenda.inferredOptions.slice(0, 3).join(" / ")
    : input.options || "진행 / 작게 검증 / 보류";
  const finalTone = fallbackDecisionTone(input, profile);
  const subject = input.agenda.topic;
  const mainClaims = [
    `Claude: ${subject}의 가능성은 살리되 처음부터 크게 벌리지 말고 작은 범위에서 확인해야 한다고 봅니다.`,
    `GPT: ${riskText}이 정리되지 않으면 실행보다 손실 관리가 먼저라고 봅니다.`,
    `Gemini: ${focus}을 같은 기준으로 놓고 진행 범위와 중단 기준을 정해야 한다고 봅니다.`,
  ];
  const agreements = [
    `판단 기준은 ${focus}으로 나누어 보는 것이 맞습니다.`,
    `선택지는 ${optionText} 안에서 비교해야 합니다.`,
    "바로 확대하기보다 책임자, 기간, 비용 한도를 먼저 정해야 합니다.",
  ];
  const disagreements = [
    "Claude는 작은 실행으로 가능성을 확인하자는 쪽이고, GPT는 실패 기준이 없으면 실행 자체가 위험하다고 봅니다.",
    "Gemini는 찬반보다 먼저 성공 조건과 중단 조건을 합의해야 한다고 정리합니다.",
  ];

  return {
    heading: "결론",
    recommendation: finalTone.recommendation,
    summary: finalTone.summary,
    mainClaims,
    agreements,
    disagreements,
    keyReasons: mainClaims,
    keyRisks: [
      `${riskText}이 남아 있으면 판단이 흔들릴 수 있습니다.`,
      "근거 없이 확대하면 비용과 책임 범위가 커질 수 있습니다.",
      "중단 기준이 없으면 검증이 아니라 관성적 진행이 될 수 있습니다.",
    ],
    conditions: agreements,
    nextActions: [
      "대상 범위, 담당자, 검증 기간, 비용 한도를 먼저 정합니다.",
      `${focus} 기준으로 성공 기준과 중단 기준을 숫자 또는 관찰 가능한 기준으로 정합니다.`,
      `${optionText} 중 어떤 선택으로 갈지 검증 결과를 보고 다시 판단합니다.`,
    ],
    evidenceSources: normalizeSources(sources),
    sectionLabels: finalSectionLabels,
  };
}

function fallbackDecisionTone(input: NormalizedInput, profile: TopicProfile): { recommendation: Recommendation; summary: string } {
  const focus = (input.focusAreas.length ? input.focusAreas : defaultFocusAreas(profile.type)).slice(0, 2).join(" / ");
  const risks = input.agenda.inferredConcerns.length
    ? input.agenda.inferredConcerns.slice(0, 2).join(" / ")
    : input.risks || "불확실성";
  const subject = input.agenda.topic;
  const question = input.agenda.coreQuestion.replace(/[?？]\s*$/, "");
  const hasStrongRisk = /(규제|임상|안전|부작용|법률|개인정보|보안|책임|손실|큰 비용|환자|투자)/.test(
    `${input.originalContent} ${risks}`,
  );
  const hasClearLowRiskCue = input.agenda.complexity === "simple" && !hasStrongRisk;

  if (hasClearLowRiskCue && profile.type === "general") {
    return {
      recommendation: "추천",
      summary: `결론은 ${subject}에 대해 확인 비용이 작고 되돌리기 쉬운 선택이라면 추천입니다. ${question}라는 질문에는 얻는 편익이 불편이나 실패 비용보다 큰지로 답해야 합니다. 정보가 부족하면 손실이 작은 선택을 우선하는 편이 안전합니다.`,
    };
  }

  if ((input.agenda.complexity === "complex" || profile.type === "pharma") && hasStrongRisk) {
    return {
      recommendation: "보류",
      summary: `결론은 ${subject}에 대해 ${risks}이 아직 크기 때문에 보류에 가깝습니다. ${question}라는 질문에는 ${focus || "근거"} 기준을 먼저 확인해야 답할 수 있습니다. 이 근거 없이 진행하면 실행 판단이 추측에 가까워집니다.`,
    };
  }

  return {
    recommendation: "조건부 추천",
    summary: `결론은 ${subject}에 대해 ${focus || "핵심 기준"}를 작은 범위에서 먼저 확인한다는 조건부 추천입니다. ${question}라는 질문에는 전면 실행보다 검증 대상과 멈출 기준을 정한 단계적 추진이 더 현실적입니다. 남아 있는 리스크는 ${risks}입니다.`,
  };
}

function normalizeGeneratedFinalReport(
  parsed: Partial<FinalReport>,
  input: NormalizedInput,
  evidenceSources: Set<string>,
): FinalReport | null {
  const recommendation = normalizeRecommendation(parsed.recommendation);

  if (!recommendation) {
    return null;
  }

  const mainClaims = normalizeList(parsed.mainClaims ?? parsed.keyReasons, []);
  const agreements = normalizeList(parsed.agreements ?? parsed.conditions, []);
  const disagreements = normalizeList(parsed.disagreements ?? parsed.keyRisks, []);

  const report: FinalReport = {
    heading: "결론",
    recommendation,
    summary: normalizeKoreanPoliteTone(cleanText(parsed.summary, "")),
    mainClaims,
    agreements,
    disagreements,
    keyReasons: mainClaims,
    keyRisks: disagreements,
    conditions: agreements,
    nextActions: normalizeList(parsed.nextActions, []),
    evidenceSources: normalizeSources([...(parsed.evidenceSources ?? []), ...evidenceSources]),
    sectionLabels: finalSectionLabels,
  };

  return isFinalReportUsable(report, input) ? report : null;
}

function isFinalReportUsable(report: FinalReport, input: NormalizedInput) {
  const combined = [
    report.summary,
    ...(report.mainClaims ?? report.keyReasons),
    ...(report.agreements ?? report.conditions),
    ...(report.disagreements ?? report.keyRisks),
    ...report.nextActions,
  ].join("\n");

  if (!report.summary || report.summary.length < 20) return false;
  if (!looksCompleteSentence(report.summary)) return false;
  if (isGenericConclusionSummary(report.summary, input)) return false;
  if (containsForbiddenTone(combined)) return false;
  if (containsNonPoliteEnding(combined)) return false;
  if (!hasAgendaOverlap(combined, input)) return false;
  if ((report.mainClaims ?? report.keyReasons).length < 1) return false;
  if ((report.agreements ?? report.conditions).length < 1) return false;
  if ((report.disagreements ?? report.keyRisks).length < 1) return false;
  if (report.nextActions.length < 1) return false;

  return true;
}

function isGenericFallbackFinalUsable(report: FinalReport) {
  const combined = [
    report.summary,
    ...(report.mainClaims ?? report.keyReasons),
    ...(report.agreements ?? report.conditions),
    ...(report.disagreements ?? report.keyRisks),
    ...report.nextActions,
  ].join("\n");

  if (!report.summary || report.summary.length < 20) return false;
  if (!looksCompleteSentence(report.summary)) return false;
  if (containsForbiddenTone(combined)) return false;
  if (!(report.mainClaims ?? report.keyReasons).length) return false;
  if (!(report.agreements ?? report.conditions).length) return false;
  if (!(report.disagreements ?? report.keyRisks).length) return false;
  if (!report.nextActions.length) return false;

  return true;
}

function classifyTopic(text: string): TopicProfile {
  const normalized = text.toLowerCase();
  const hasAny = (keywords: string[]) => keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));

  const medicalProductPattern =
    /(?:의약|약품|약물|치료제|약효|부작용|임상|제약|otc|처방|환자|fda|mfds|식약처|의료|치료|헬스케어|바이오|복용|투약)/i;
  const possibleMedicineLaunch =
    /[가-힣]{2,}약/.test(normalized) && /(출시|개발|검토|콘셉트|효능|안전|부작용|복용|투약)/.test(normalized);

  if (medicalProductPattern.test(normalized) || possibleMedicineLaunch) {
    return {
      type: "pharma",
      label: "제약·의료 의사결정",
      decisionFrame: "효능, 안전성, 규제 가능성, 실제 환자 수요를 분리해서 판단해야 합니다.",
      evidenceRule: "FDA, MFDS, PubMed, 연구기관, 제약사 공식 발표 같은 공식 근거를 우선합니다.",
      defaultSources: [
        "https://www.fda.gov/drugs",
        "https://www.mfds.go.kr/",
        "https://pubmed.ncbi.nlm.nih.gov/",
      ],
    };
  }

  if (hasAny(["채용", "직원", "인사", "조직", "팀", "평가", "연봉", "퇴사", "경력자", "신입", "리더", "교육"])) {
    return {
      type: "people",
      label: "인사·조직 의사결정",
      decisionFrame: "성과 가능성, 적응 기간, 교육 비용, 조직 부담, 책임 범위를 기준으로 판단해야 합니다.",
      evidenceRule: "채용 비용, 생산성, 교육 기간, 조직 운영 데이터를 우선하고 없으면 확인할 데이터를 분명히 말합니다.",
      defaultSources: [
        "https://www.bls.gov/ooh/",
        "https://www.oecd.org/employment/",
      ],
    };
  }

  if (hasAny(["ai", "인공지능", "챗봇", "llm", "프롬프트", "자동화", "시스템", "기술", "데이터", "보안"])) {
    return {
      type: "tech",
      label: "AI·기술 의사결정",
      decisionFrame: "실제 사용 수요, 기술 한계, 운영 책임, 보안, 비용, 확장 가능성을 함께 봐야 합니다.",
      evidenceRule: "기업 공식 발표, 연구기관, 공공기관, 신뢰 가능한 산업 보고서를 우선합니다.",
      defaultSources: [
        "https://www.nist.gov/artificial-intelligence",
        "https://openai.com/enterprise/",
        "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",
      ],
    };
  }

  if (hasAny(["사업", "제품", "출시", "시장", "고객", "매출", "투자", "계약", "파트너", "브랜드", "마케팅", "서비스", "가격", "수익", "음료", "소비", "편의점", "패키지", "리브랜딩", "서브라인"])) {
    return {
      type: "business",
      label: "사업·시장 의사결정",
      decisionFrame: "실제 수요, 사용자 행동, 경쟁 상황, 수익 모델, 운영 비용, 차별성을 기준으로 판단해야 합니다.",
      evidenceRule: "공식 발표, 산업 보고서, 기업 자료, 신뢰 가능한 언론과 연구기관 자료를 우선합니다.",
      defaultSources: [
        "https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights",
        "https://www.gartner.com/en/insights",
      ],
    };
  }

  return {
    type: "general",
    label: "일반 의사결정",
    decisionFrame: "핵심 질문, 찬성 이유, 반대 이유, 비용과 실행 가능성을 같은 기준으로 놓고 판단해야 합니다.",
    evidenceRule: "출처가 부족한 주제는 강한 단정을 피하고 추가로 확인할 사실을 분명히 합니다.",
    defaultSources: [],
  };
}

function defaultFocusAreas(topic: TopicType) {
  if (topic === "pharma") return ["효능", "안전성", "규제", "시장"];
  if (topic === "people") return ["성과", "적응", "조직", "리스크"];
  if (topic === "business") return ["고객", "시장", "비용", "리스크"];
  if (topic === "tech") return ["수요", "한계", "보안", "운영"];
  return ["수요", "근거", "리스크", "실행"];
}

function parseFinalReport(text: string): Partial<FinalReport> {
  const source = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start < 0 || end < start) return {};

  try {
    return JSON.parse(source.slice(start, end + 1)) as Partial<FinalReport>;
  } catch {
    return {};
  }
}

function normalizeRecommendation(value: unknown): Recommendation | null {
  if (value === "추천" || value === "조건부 추천" || value === "보류" || value === "비추천") {
    return value;
  }

  const text = String(value ?? "");

  if (!text.trim()) return null;
  if (/비추천|중단|하지 않는|진행하지|철회/.test(text)) return "비추천";
  if (/보류|추가 검토|대기|판단 유보|결정 유보/.test(text)) return "보류";
  if (/(조건부|파일럿|시범|작게|제한적|단계적|검증)/.test(text) && /(추천|진행|실행|도입|검토)/.test(text)) {
    return "조건부 추천";
  }
  if (/(추천|진행|실행|도입)/.test(text) && !/(조건|파일럿|시범|작게|검증|보류|추가)/.test(text)) {
    return "추천";
  }

  return null;
}

function normalizeList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 4);

  return normalized.length ? normalized : fallback;
}

function normalizeShortList(value: unknown, fallback: string[], maxItems: number) {
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .map((item) => cleanText(item, ""))
    .filter(Boolean)
    .slice(0, maxItems);

  return normalized.length ? normalized : fallback;
}

function normalizeComplexity(value: unknown, fallback: AgendaComplexity): AgendaComplexity {
  return value === "simple" || value === "normal" || value === "complex" ? value : fallback;
}

function rotationCountForComplexity(complexity: AgendaComplexity, value: unknown): 1 | 2 | 3 {
  const requested = complexity === "simple" ? 1 : complexity === "complex" ? 3 : 2;
  const normalizedRequested = clampRotations(typeof value === "number" ? Math.min(value, requested) : requested);
  const capped = Math.min(normalizedRequested, maxLiveRotations);
  return capped === 1 ? 1 : capped === 3 ? 3 : 2;
}

function normalizeDiscussionFrames(value: unknown, agenda: Pick<InterpretedAgenda, "topic" | "complexity" | "discussionFrames">, rotationCount: 1 | 2 | 3) {
  const source = Array.isArray(value) ? value : agenda.discussionFrames;
  const frames = normalizeShortList(source, [], rotationCount)
    .map((item) => item.replace(/^논리\s*토론\s*[-:]?\s*/i, "").replace(/\s*\d+회차\s*/g, "").trim())
    .filter(Boolean);

  const defaults = defaultDiscussionFrames(agenda.topic, "general", rotationCount);

  while (frames.length < rotationCount) {
    frames.push(defaults[frames.length] ?? `핵심 쟁점 ${frames.length + 1}`);
  }

  return frames.slice(0, rotationCount);
}

function inferFallbackComplexity(text: string, topic: TopicType): AgendaComplexity {
  if (
    topic === "pharma" ||
    /(임상|규제|투자|정책|보험|수가|환자|법률|보안|개인정보|인수|합병|큰 비용|수억|수천|출시)/.test(text)
  ) {
    return "complex";
  }

  if (
    text.length <= 60 &&
    /(옷|점심|저녁|메뉴|갈까|살까|먹을까|입을까|가져갈까|챙길까)/.test(text)
  ) {
    return "simple";
  }

  return "normal";
}

function defaultDiscussionFrames(topic: string, type: TopicType, rotationCount: 1 | 2 | 3) {
  const frames =
    type === "pharma"
      ? ["효능·안전성 근거", "규제와 임상 현실성", "시장성과 출시 조건"]
      : type === "people"
        ? ["즉시 성과와 교육 비용", "조직 적응과 장기 성장", "채용 실패 리스크"]
        : type === "tech"
          ? ["실제 사용 수요", "품질·보안·운영 부담", "확장 가능성과 비용"]
          : type === "business"
            ? ["실제 수요와 브랜드 반응", "제품 경험과 구매 전환", "비용 대비 실행 조건"]
            : [`${topic}의 실제 필요성`, "불편과 대안의 균형", "실행 후 손실 가능성"];

  return frames.slice(0, rotationCount);
}

function mergeLimited(primary: string[], secondary: string[], maxItems: number) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const item of [...primary, ...secondary]) {
    const clean = cleanText(item, "");
    const key = clean.replace(/\s+/g, "").toLowerCase();

    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(clean);

    if (merged.length >= maxItems) {
      break;
    }
  }

  return merged;
}

function splitLooseText(value: unknown) {
  const text = String(value ?? "").trim();

  if (!text) {
    return [];
  }

  return text
    .split(/[,\n/·ㆍ|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanText(value: unknown, fallback: string) {
  const text = String(value ?? "")
    .replace(/^["“”']+|["“”']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || fallback;
}

function normalizeSources(value: Iterable<string> | undefined) {
  return Array.from(
    new Set(
      Array.from(value ?? [])
        .map((item) => item.trim().replace(/[),.]+$/g, ""))
        .filter((item) => /^https?:\/\/[^\s]+$/i.test(item)),
    ),
  ).slice(0, 6);
}

function extractUrls(text: string) {
  return text.match(/https?:\/\/[^\s)\]"]+/g) ?? [];
}

function previousSpeakerName(history: string[]) {
  return history.at(-1)?.split(":")[0]?.trim() ?? "앞선 의견";
}

function clampRotations(value: unknown): 1 | 2 | 3 {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 2;
  }

  const rounded = Math.min(3, Math.max(1, Math.round(numberValue)));
  return rounded === 1 ? 1 : rounded === 3 ? 3 : 2;
}

function readRotationLimit(value: unknown, fallback: 1 | 2 | 3): 1 | 2 | 3 {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return clampRotations(value);
}

function readPositiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return numberValue;
}

function hasAnyModelKey() {
  return Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY,
  );
}

function makeReadableTopic(content: string) {
  const normalized = content.trim().split(/\s+/).join(" ").replace(/[?？!！]+$/g, "");

  if (!normalized) {
    return "입력한 안건의 현실적 판단";
  }

  return normalized.length > 54 ? `${normalized.slice(0, 54)}...` : normalized;
}

function makeTitle(content: string) {
  const normalized = content.trim().split(/\s+/).join(" ");

  if (!normalized) {
    return "";
  }

  return normalized.length > 40 ? `${normalized.slice(0, 40)}...` : normalized;
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
