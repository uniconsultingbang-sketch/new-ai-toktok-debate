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
  keyReasons: "이유",
  keyRisks: "주의할 점",
  conditions: "핵심 쟁점",
  nextActions: "현실적인 실행 방향",
  evidenceSources: "근거 자료",
};

const unstableAiMessage =
  "토론을 정리하는 중 AI 응답이 불안정합니다. 입력하신 안건은 저장되어 있습니다. 잠시 후 다시 시도해 주세요.";

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

      try {
        for (const plan of createTurnPlans(input)) {
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

        emit({
          type: "final",
          finalReport: await generateFinalReport(input, profile, history, evidenceSources),
          topicType: profile.type,
        });
        emit({ type: "done" });
      } catch (error) {
        console.error("[debate-stream] stream failed", error);
        emit({
          type: "error",
          message: unstableAiMessage,
        });
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
  const complexity = inferFallbackComplexity(normalized, profile.type);
  const rotationCount = complexity === "simple" ? 1 : complexity === "complex" ? 3 : 2;
  return {
    topic: readableTopic,
    coreQuestion: `사용자가 묻는 "${readableTopic}" 안건에서 실제로 판단해야 할 핵심 기준은 무엇일까?`,
    inferredOptions: ["진행", "작게 검증", "보류"],
    inferredConcerns: ["수요 불확실성", "비용과 실행 부담", "실패 시 손실"],
    focusAreas: defaultFocusAreas(profile.type),
    complexity,
    rotationCount,
    discussionFrames: defaultDiscussionFrames(readableTopic, profile.type, rotationCount),
    summary: `사용자가 적은 안건은 "${readableTopic}"에 대해 현실적인 판단 기준과 실행 조건을 정리해야 한다는 의미로 해석됩니다.`,
  };
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
  const response = await fetch(url, init);

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
    : `- 2~5문장으로 말합니다.
- 직전 발언이 있으면 첫 문장에서 그 논리나 전제를 직접 받아야 합니다.
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
    return `사회자가 정리한 "${question}"이라는 질문에 동의합니다. 저는 이 안건이 사용자의 불편이나 조직의 비효율을 줄일 가능성은 있다고 봅니다. 다만 가능성은 선언이 아니라 작은 검증에서 확인되어야 하므로, 처음부터 크게 밀기보다 ${focusText} 기준으로 반응을 볼 수 있는 범위를 좁혀야 합니다.`;
  }

  if (plan.phase === "opening" && plan.speaker === "gpt") {
    return `Claude의 가능성 평가는 인정합니다. 다만 "${subject}"에서 가능성이 있다는 것과 실제로 비용을 감당하며 실행할 수 있다는 것은 다른 문제입니다. 지금은 ${input.risks || "수요, 비용, 책임 주체, 실패했을 때의 손실"}을 확인하지 않으면 낙관이 너무 앞설 수 있습니다.`;
  }

  if (plan.phase === "opening" && plan.speaker === "gemini") {
    return `두 의견 모두 타당합니다. 결국 핵심은 "${question}"에 대해 매력만 볼 것이 아니라, 실제 행동 변화나 실행 판단으로 이어질 만큼 근거가 있는지입니다. 그래서 판단 기준은 ${focusText}로 나누고, 각 기준에서 진행과 보류의 조건을 분명히 하는 것이 좋습니다.`;
  }

  if (plan.phase === "discussion" && plan.speaker === "claude") {
    return `${previousName}의 우려는 필요합니다. 다만 "${plan.roundTitle}" 쟁점에서는 "${subject}"를 바로 확대하기보다 가장 작은 범위에서 확인하는 방식이 가능성을 살릴 수 있습니다. 저는 전면 추진보다 제한된 실험으로 전환해 ${focusText}를 확인하는 접근이 현실적이라고 봅니다.`;
  }

  if (plan.phase === "discussion" && plan.speaker === "gpt") {
    return `Claude의 제한된 실험 제안은 이전보다 현실적입니다. 하지만 "${question}"에 대한 성공 기준과 중단 기준이 없으면 시간을 쓰고도 결론을 못 냅니다. 최소한 비용 한도, 검증 기간, 책임자, 실패로 판단할 조건을 먼저 정해야 합니다.`;
  }

  if (plan.phase === "discussion" && plan.speaker === "gemini") {
    return `GPT의 지적까지 반영하면 결론은 단순한 찬반이 아닙니다. "${subject}"는 가능성을 버리지 않되, ${focusText} 기준에서 성공 조건과 중단 조건을 먼저 정해야 합니다. 이 안건의 균형점은 가능성을 확인하면서도 비용과 책임을 통제하는 조건부 검증입니다.`;
  }

  return `두 의견을 종합하면 "${subject}"의 핵심 쟁점은 ${focusText}입니다. 실제 수요와 근거가 충분한지, 기존 방식보다 나은지, 비용과 운영 부담을 감당할 수 있는지, 실패했을 때 멈출 기준이 있는지를 확인해야 합니다. 최종 결론은 이 기준을 확인할 수 있는 작은 실행 계획이 있느냐에 달려 있습니다.`;
}

function shouldUseFallback(message: string, plan: TurnPlan, history: string[], input: NormalizedInput) {
  const normalized = message.trim();

  if (!normalized) return true;
  if (containsForbiddenTone(normalized)) return true;
  if (countSentences(normalized) > 5) return true;
  if (plan.phase !== "topic" && countSentences(normalized) < 2) return true;
  if (plan.phase !== "topic" && !looksCompleteSentence(normalized)) return true;
  if (plan.phase !== "topic" && plan.speaker === "gemini" && normalized.length < 90) return true;
  if (plan.phase !== "topic" && !hasAgendaOverlap(normalized, input)) return true;
  if (plan.phase !== "topic" && history.length && !hasConnectionSignal(normalized)) return true;

  return false;
}

function isSafeFallback(message: string, plan: TurnPlan, input: NormalizedInput) {
  const normalized = message.trim();

  if (!normalized) return false;
  if (containsForbiddenTone(normalized)) return false;

  if (plan.phase !== "topic") {
    if (countSentences(normalized) < 2) return false;
    if (!looksCompleteSentence(normalized)) return false;
  }

  return true;
}

function cleanTurnMessage(message: string) {
  return message
    .replace(/^["“”]+|["“”]+$/g, "")
    .replace(/^(사회자|(Claude|GPT|Gemini)\s*교수)\s*[:：]\s*/i, "")
    .trim();
}

function containsForbiddenTone(value: string) {
  return /(ㅋㅋ|ㅠㅠ|밈|예능|카페형|카페\s*수다|카페\s*토크|매콤|농담|드립|웃기|수다|comic|roleplay|inner thought)/i.test(value);
}

function hasConnectionSignal(value: string) {
  return /(동의|다만|하지만|그 지적|그 우려|그 의견|그 부분|두 의견|두 관점|사회자|Claude|GPT|Gemini|앞선|이전|인정|반대로|보완)/.test(value);
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
- 보고서 말투를 과하게 쓰지 말고, 실제 회의 결론처럼 간결하게 정리합니다.
- 이유, 현실적인 실행 방향, 주의할 점은 구체적으로 씁니다.
- 강한 시장/기술/의료 주장은 근거 자료가 있을 때만 씁니다.
- evidenceSources에는 실제 URL만 넣습니다.

JSON 형식:
{
  "recommendation": "추천 | 조건부 추천 | 보류 | 비추천",
  "summary": "2~4문장",
  "keyReasons": ["이유"],
  "keyRisks": ["주의할 점"],
  "conditions": ["핵심 쟁점"],
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
    throw new Error(unstableAiMessage);
  }

  return fallback;
}

function fallbackFinal(input: NormalizedInput, profile: TopicProfile, sources: string[]): FinalReport {
  const focus = input.focusAreas.length ? input.focusAreas.join(", ") : "수요, 비용, 리스크, 실행";
  const hasRisk = input.risks.trim().length > 0;

  return {
    heading: "최종 결론",
    recommendation: hasRisk ? "조건부 추천" : "보류",
    summary: `"${input.agenda.topic}" 안건은 "${input.agenda.coreQuestion}"라는 질문을 기준으로 가능성과 리스크를 함께 봐야 합니다. 지금 정보만으로 단정하기보다 ${focus}을 같은 기준 위에 놓고 작게 검증하는 편이 안전합니다. 실행한다면 성공 기준과 중단 기준을 먼저 정해야 합니다.`,
    keyReasons: [
      `${profile.decisionFrame}`,
      `"${input.agenda.topic}"은 가능성은 있지만 실제 수요와 실행 여건을 확인해야 합니다.`,
      `작은 검증으로 시작하면 "${input.agenda.coreQuestion}"에 대한 판단 근거를 만들 수 있습니다.`,
    ],
    keyRisks: [
      input.risks || "근거 없이 확대하면 비용과 책임 범위가 커질 수 있습니다.",
      `"${input.agenda.topic}"에서 사용자 행동이나 조직 실행력이 예상보다 약할 수 있습니다.`,
      "중단 기준이 없으면 검증이 아니라 관성적 진행이 될 수 있습니다.",
    ],
    conditions: [
      `${input.agenda.topic}의 실제 수요가 충분히 강한가`,
      `${input.agenda.coreQuestion}에 답할 만큼 기존 방식보다 분명히 나은가`,
      "비용 대비 효과가 나오는가",
      "실패했을 때 멈출 기준이 있는가",
    ],
    nextActions: [
      `"${input.agenda.topic}"의 대상 범위와 검증 기간을 작게 정합니다.`,
      `${focus} 기준으로 성공 기준과 중단 기준을 숫자 또는 관찰 가능한 기준으로 정합니다.`,
      "검증 후 추천, 보류, 비추천 중 하나로 다시 판단합니다.",
    ],
    evidenceSources: normalizeSources(sources),
    sectionLabels: finalSectionLabels,
  };
}

function normalizeGeneratedFinalReport(
  parsed: Partial<FinalReport>,
  input: NormalizedInput,
  evidenceSources: Set<string>,
): FinalReport | null {
  const report: FinalReport = {
    heading: "최종 결론",
    recommendation: normalizeRecommendation(parsed.recommendation),
    summary: cleanText(parsed.summary, ""),
    keyReasons: normalizeList(parsed.keyReasons, []),
    keyRisks: normalizeList(parsed.keyRisks, []),
    conditions: normalizeList(parsed.conditions, []),
    nextActions: normalizeList(parsed.nextActions, []),
    evidenceSources: normalizeSources([...(parsed.evidenceSources ?? []), ...evidenceSources]),
    sectionLabels: finalSectionLabels,
  };

  return isFinalReportUsable(report, input) ? report : null;
}

function isFinalReportUsable(report: FinalReport, input: NormalizedInput) {
  const combined = [
    report.summary,
    ...report.keyReasons,
    ...report.keyRisks,
    ...report.conditions,
    ...report.nextActions,
  ].join("\n");

  if (!report.summary || report.summary.length < 20) return false;
  if (!looksCompleteSentence(report.summary)) return false;
  if (containsForbiddenTone(combined)) return false;
  if (!hasAgendaOverlap(combined, input)) return false;
  if (report.keyReasons.length < 1) return false;
  if (report.keyRisks.length < 1) return false;
  if (report.conditions.length < 1) return false;
  if (report.nextActions.length < 1) return false;

  return true;
}

function isGenericFallbackFinalUsable(report: FinalReport) {
  const combined = [
    report.summary,
    ...report.keyReasons,
    ...report.keyRisks,
    ...report.conditions,
    ...report.nextActions,
  ].join("\n");

  if (!report.summary || report.summary.length < 20) return false;
  if (!looksCompleteSentence(report.summary)) return false;
  if (containsForbiddenTone(combined)) return false;
  if (!report.keyReasons.length) return false;
  if (!report.keyRisks.length) return false;
  if (!report.conditions.length) return false;
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

function normalizeRecommendation(value: unknown): Recommendation {
  if (value === "추천" || value === "조건부 추천" || value === "보류" || value === "비추천") {
    return value;
  }

  const text = String(value ?? "");

  if (/비추천|중단|하지 않는/.test(text)) return "비추천";
  if (/보류|추가 검토|대기/.test(text)) return "보류";
  if (/추천|진행/.test(text) && !/조건/.test(text)) return "추천";
  return "조건부 추천";
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
  if (complexity === "simple") {
    return 1;
  }

  if (complexity === "complex") {
    return 3;
  }

  return 2;
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
