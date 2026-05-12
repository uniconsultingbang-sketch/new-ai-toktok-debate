"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUp,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  Home,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import {
  DebateEvent,
  DecisionRecord,
  FinalReport,
  SpeakerId,
  TopicType,
  getDecision,
  getDecisionAsync,
  saveDecisionAsync,
} from "@/lib/decision-storage";

type IncomingEvent =
  | (Extract<DebateEvent, { type: "turn" }> & { topicType?: TopicType })
  | Extract<DebateEvent, { type: "thought" }>
  | { type: "final"; finalReport: FinalReport; topicType?: TopicType }
  | { type: "error"; message: string }
  | { type: "done" };

type RevealEvent = Exclude<IncomingEvent, { type: "done" }>;

type AuthMe = {
  configured: boolean;
  authenticated: boolean;
  user: { id: string; name: string } | null;
};

const statusText: Record<DecisionRecord["status"], string> = {
  running: "토론중",
  paused: "중단됨",
  completed: "완료",
  failed: "오류",
};

const speakerMeta: Record<
  SpeakerId,
  {
    title: string;
    role: string;
    icon: ReactNode;
    accent: string;
    panel: string;
  }
> = {
  moderator: {
    title: "사회자",
    role: "",
    icon: <BookOpenCheck className="size-5" />,
    accent: "#6F5734",
    panel: "prof-speaker-moderator",
  },
  claude: {
    title: "Claude",
    role: "",
    icon: <UserRoundCheck className="size-5" />,
    accent: "#7A4A1D",
    panel: "prof-speaker-claude",
  },
  gpt: {
    title: "GPT",
    role: "",
    icon: <ShieldAlert className="size-5" />,
    accent: "#2B5B50",
    panel: "prof-speaker-gpt",
  },
  gemini: {
    title: "Gemini",
    role: "",
    icon: <Scale className="size-5" />,
    accent: "#394E87",
    panel: "prof-speaker-gemini",
  },
};

export function StreamingDecisionView({ decisionId }: { decisionId: string }) {
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [thinkingSpeaker, setThinkingSpeaker] = useState<SpeakerId | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const streamStartedRef = useRef(false);
  const pendingRef = useRef<RevealEvent[]>([]);
  const isProcessingRef = useRef(false);
  const fastForwardRef = useRef(false);
  const decisionRef = useRef<DecisionRecord | null>(null);
  const ownerIdRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const finalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    decisionRef.current = decision;
  }, [decision]);

  const isBusy = isStreaming || isRevealing || isFinalizing;

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    let isMounted = true;

    function showDecision(nextDecision: DecisionRecord) {
      if (!isMounted) {
        return;
      }

      setNotFound(false);
      setDecision(nextDecision);
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 80);

      if (nextDecision.status === "running" && !nextDecision.finalReport) {
        startStream(nextDecision, nextDecision.events.length > 0);
      }
    }

    async function loadDecisionForCurrentUser() {
      let auth: AuthMe = { configured: false, authenticated: true, user: null };

      try {
        auth = (await fetch("/api/auth/me").then((response) => response.json())) as AuthMe;
      } catch {
        auth = { configured: false, authenticated: true, user: null };
      }

      if (!isMounted) {
        return;
      }

      if (auth.configured && !auth.authenticated) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      const ownerId = getAuthOwnerId(auth);
      ownerIdRef.current = ownerId;
      const saved = getDecision(decisionId, ownerId);

      if (saved) {
        showDecision(saved);
        return;
      }

      void getDecisionAsync(decisionId, ownerId).then((remoteDecision) => {
        if (!isMounted) {
          return;
        }

        if (remoteDecision) {
          showDecision(remoteDecision);
          return;
        }

        setNotFound(true);
      });
    }

    void loadDecisionForCurrentUser();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionId]);

  useEffect(() => {
    if (!isBusy) {
      return;
    }

    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [decision?.events.length, decision?.finalReport, thinkingSpeaker, isFinalizing, isBusy]);

  useEffect(() => {
    function handleScroll() {
      setShowTopButton(window.scrollY > 520);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const groupedEvents = useMemo(() => {
    const groups = new Map<number, DebateEvent[]>();

    for (const event of decision?.events ?? []) {
      const current = groups.get(event.roundNumber) ?? [];
      current.push(event);
      groups.set(event.roundNumber, current);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [decision?.events]);

  async function startStream(baseDecision: DecisionRecord, restart = false) {
    if (streamStartedRef.current) {
      return;
    }

    fastForwardRef.current = false;
    pendingRef.current = [];
    streamStartedRef.current = true;
    setIsStreaming(true);

    const now = new Date().toISOString();
    const ownerId = getDecisionOwnerId(baseDecision, ownerIdRef.current);
    const initial: DecisionRecord = {
      ...baseDecision,
      ownerId: ownerId ?? undefined,
      status: "running",
      updatedAt: now,
      events: restart ? [] : baseDecision.events,
      finalReport: restart ? null : baseDecision.finalReport,
      error: null,
      discussionDepth: "deep",
      councilMode: "role_based",
      banterLevel: "off",
      rebuttalRotations: 2,
    };

    setDecision(initial);
    void saveDecisionAsync(initial, ownerId);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/debate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: initial.title,
          content: initial.content,
          options: initial.options,
          risks: initial.risks,
          focusAreas: initial.focusAreas,
          rebuttalRotations: 2,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("3관점 논리 토론 연결에 실패했습니다.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          enqueueIncoming(JSON.parse(line) as IncomingEvent);
        }
      }

      if (buffer.trim()) {
        enqueueIncoming(JSON.parse(buffer) as IncomingEvent);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const message = error instanceof Error ? error.message : "토론을 이어가는 중 문제가 생겼습니다. 다시 시작해 주세요.";
      enqueueIncoming({ type: "error", message });
    } finally {
      setIsStreaming(false);
      streamStartedRef.current = false;
      abortRef.current = null;
      void processQueue();
    }
  }

  function enqueueIncoming(incoming: IncomingEvent) {
    if (incoming.type === "done") {
      return;
    }

    pendingRef.current.push(incoming);
    void processQueue();
  }

  async function processQueue() {
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    setIsRevealing(true);

    while (pendingRef.current.length) {
      const incoming = pendingRef.current.shift();
      if (!incoming) {
        continue;
      }

      if (incoming.type === "error") {
        setThinkingSpeaker(null);
        setIsFinalizing(false);
        updateDecision((current) => ({
          ...current,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: incoming.message,
        }));
        continue;
      }

      if (incoming.type === "final") {
        setThinkingSpeaker(null);
        setIsFinalizing(true);
        await pacedWait(1200);
        setIsFinalizing(false);
        updateDecision((current) => ({
          ...current,
          topicType: incoming.topicType ?? current.topicType,
          status: "completed",
          updatedAt: new Date().toISOString(),
          finalReport: incoming.finalReport,
          error: null,
        }));
        await pacedWait(300);
        continue;
      }

      if (incoming.type === "turn") {
        setThinkingSpeaker(incoming.speaker);
        await pacedWait(readingDelay(incoming));
        setThinkingSpeaker(null);
        appendVisibleEvent(incoming, incoming.topicType);
        await pacedWait(500);
        continue;
      }

      appendVisibleEvent(incoming);
      await pacedWait(250);
    }

    setThinkingSpeaker(null);
    setIsRevealing(false);
    isProcessingRef.current = false;
  }

  function appendVisibleEvent(event: DebateEvent, topicType?: TopicType) {
    updateDecision((current) => {
      if (current.events.some((item) => item.id === event.id)) {
        return current;
      }

      return {
        ...current,
        topicType: topicType ?? current.topicType,
        status: "running",
        updatedAt: new Date().toISOString(),
        events: [...current.events, event],
        error: null,
      };
    });
  }

  function updateDecision(updater: (current: DecisionRecord) => DecisionRecord) {
    setDecision((current) => {
      if (!current) {
        return current;
      }

      const next = updater(current);
      const ownerId = getDecisionOwnerId(next, ownerIdRef.current);
      void saveDecisionAsync(next, ownerId);
      decisionRef.current = next;
      return next;
    });
  }

  function goHome() {
    window.location.assign("/");
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restartDebate() {
    if (!decision) {
      return;
    }

    startStream(decision, true);
  }

  async function pacedWait(ms: number) {
    const endAt = Date.now() + ms;

    while (!fastForwardRef.current && Date.now() < endAt) {
      await sleep(Math.min(120, endAt - Date.now()));
    }
  }

  if (notFound) {
    return (
      <main className="prof-detail-page">
        <section className="prof-empty-card">
          <h1>접근할 수 없는 토론 기록입니다.</h1>
          <p>현재 로그인한 계정의 기록이 아니거나 삭제된 토론입니다.</p>
          <button type="button" onClick={goHome}>홈으로</button>
        </section>
      </main>
    );
  }

  if (!decision) {
    return (
      <main className="prof-detail-page">
        <section className="prof-empty-card">
          <p>토론을 불러오는 중입니다.</p>
        </section>
      </main>
    );
  }

  const questionText = decision.content || decision.title;
  const canExpandQuestion = questionText.length > 46;
  const topicSummary = getTopicSummary(decision);

  return (
    <main className="prof-detail-page">
      <div className="prof-detail-shell">
        <section className="prof-detail-hero">
          <div className="prof-detail-topbar">
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault();
                goHome();
              }}
              className="prof-back-button"
              aria-label="홈으로"
            >
              <ArrowLeft className="size-5" />
            </a>
            <span className="prof-detail-status">
              <CheckCircle2 className="size-4" />
              {statusText[decision.status]}
            </span>
          </div>

          <p className="prof-eyebrow">3-View Logic Debate</p>
          <h1 className={`prof-detail-title ${isQuestionExpanded ? "is-expanded" : ""}`}>{questionText}</h1>
          {canExpandQuestion ? (
            <button type="button" onClick={() => setIsQuestionExpanded((value) => !value)} className="prof-detail-expand">
              {isQuestionExpanded ? "접기" : "펼쳐보기"}
            </button>
          ) : null}

          <TopicSummaryMini summary={topicSummary} />

          <div className="prof-hero-summary">
            <span>사회자</span>
            <span>Claude</span>
            <span>GPT</span>
            <span>Gemini</span>
          </div>
        </section>

        {decision.status === "paused" || decision.status === "failed" || decision.status === "completed" ? (
          <button type="button" onClick={restartDebate} className="prof-restart-button">
            <RotateCcw className="size-4" />
            {decision.status === "completed" ? "같은 안건으로 다시 토론" : "처음부터 다시 토론"}
          </button>
        ) : null}

        <section className="prof-debate-panel">
          <div className="prof-panel-head">
            <div>
              <p className="prof-eyebrow">Live Meeting</p>
              <h2>3관점 논리 토론</h2>
            </div>
            {isBusy ? <span>발언 정리중</span> : <span>기록됨</span>}
          </div>

          <div className="prof-round-list">
            {groupedEvents.length ? (
              groupedEvents.map(([roundNumber, events]) => (
                <article key={roundNumber} className="prof-round-block">
                  <RoundDivider roundNumber={roundNumber} title={getRoundTitle(events)} />
                  <div className="prof-turn-list">
                    {events.map((event) =>
                      event.type === "turn" ? <DebateTurn key={event.id} event={event} /> : <ThoughtNote key={event.id} event={event} />,
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="prof-waiting-card">
                세 관점의 전문가들이 안건과 핵심 질문을 정리하고 있습니다.
              </div>
            )}

            {thinkingSpeaker ? <ThinkingPanel speaker={thinkingSpeaker} /> : null}
            {isFinalizing ? <FinalizingPanel /> : null}
          </div>

          {decision.error ? <div className="prof-error-card">{decision.error}</div> : null}
          <div ref={endRef} />
        </section>

        {decision.finalReport ? (
          <section ref={finalRef} className="prof-final-wrap">
            <FinalReportBlock report={decision.finalReport} />
          </section>
        ) : null}

        <nav className="prof-bottom-nav">
          <button type="button" onClick={goHome}>
            <Home className="size-4" />
            홈으로 돌아가기
          </button>
        </nav>
      </div>

      {showTopButton ? (
        <button type="button" onClick={scrollToTop} className="prof-top-button" aria-label="맨 위로">
          <ArrowUp className="size-5" />
        </button>
      ) : null}
    </main>
  );
}

function TopicSummaryMini({ summary }: { summary: { topic: string; coreQuestion: string } | null }) {
  return (
    <section className="prof-topic-summary-mini" aria-label="주제 정리">
      <p>주제 정리</p>
      {summary ? (
        <dl>
          <dt>주제:</dt>
          <dd>{summary.topic}</dd>
          <dt>핵심 질문:</dt>
          <dd>{summary.coreQuestion}</dd>
        </dl>
      ) : (
        <span>AI가 사용자가 쓴 안건을 주제와 핵심 질문으로 정리하고 있습니다.</span>
      )}
    </section>
  );
}

function DebateTurn({ event }: { event: Extract<DebateEvent, { type: "turn" }> }) {
  const meta = speakerMeta[event.speaker];

  return (
    <article className={`prof-turn-card ${meta.panel}`}>
      <div className="prof-speaker-head">
        <span className="prof-speaker-icon" style={{ color: meta.accent }}>{meta.icon}</span>
        <div>
          <h3>{meta.title}</h3>
        </div>
        <time>{formatBubbleTime(event.createdAt)}</time>
      </div>
      <div className="prof-turn-message">
        {formatReadableMessage(event.message).map((paragraph, index) => (
          <p key={`${event.id}-paragraph-${index}`}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}

function ThoughtNote({ event }: { event: Extract<DebateEvent, { type: "thought" }> }) {
  return (
    <article className="prof-note-card">
      <span>메모</span>
      <p>{sanitizeDisplayText(event.message)}</p>
    </article>
  );
}

function RoundDivider({ title }: { roundNumber: number; title: string }) {
  return (
    <div className="prof-round-divider">
      <strong>{title}</strong>
    </div>
  );
}

function ThinkingPanel({ speaker }: { speaker: SpeakerId }) {
  const meta = speakerMeta[speaker];

  return (
    <div className="prof-thinking-panel">
      <BookOpenCheck className="size-4 animate-pulse" />
      {meta.title}가 다음 발언을 정리하고 있습니다.
    </div>
  );
}

function FinalizingPanel() {
  return (
    <div className="prof-thinking-panel">
      <FileText className="size-4 animate-pulse" />
      토론을 종합해 최종 결론을 정리하고 있습니다.
    </div>
  );
}

function FinalReportBlock({ report }: { report: FinalReport }) {
  const labels = {
    keyReasons: report.sectionLabels?.keyReasons ?? "이유",
    keyRisks: report.sectionLabels?.keyRisks ?? "주의할 점",
    conditions: report.sectionLabels?.conditions ?? "핵심 쟁점",
    nextActions: report.sectionLabels?.nextActions ?? "현실적인 실행 방향",
    evidenceSources: report.sectionLabels?.evidenceSources ?? "근거 자료",
  };

  return (
    <section className="prof-final-panel">
      <div className="prof-final-head">
        <Sparkles className="size-5" />
        <div>
          <p className="prof-eyebrow">Final Conclusion</p>
          <h2>{report.heading ?? "최종 판단"}</h2>
        </div>
      </div>

      <article className="prof-recommend-card">
        <h3>{report.recommendation}</h3>
        <p>{report.summary}</p>
      </article>

      <div className="prof-summary-grid">
        <SummaryCard title={labels.keyReasons} items={report.keyReasons} tone="blue" />
        <SummaryCard title={labels.keyRisks} items={report.keyRisks} tone="red" />
        <SummaryCard title={labels.conditions} items={report.conditions} tone="gold" />
        <SummaryCard title={labels.nextActions} items={report.nextActions} tone="green" />
      </div>

      {report.evidenceSources?.length ? (
        <div className="prof-source-card">
          <h3>{labels.evidenceSources}</h3>
          <ul>
            {report.evidenceSources.map((source) => (
              <li key={source}>
                <a href={source} target="_blank" rel="noreferrer">{source}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({ title, items, tone }: { title: string; items: string[]; tone: "blue" | "red" | "gold" | "green" }) {
  return (
    <article className={`prof-summary-card ${tone}`}>
      <h3>{title}</h3>
      <ul>
        {(items.length ? items : ["토론 결과가 정리되면 이 항목에 표시됩니다."]).slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function getRoundTitle(events: DebateEvent[]) {
  const firstTurn = events.find((event) => event.type === "turn");

  if (firstTurn?.type === "turn") {
    return firstTurn.roundTitle;
  }

  return "토론 진행";
}

function readingDelay(event: Extract<DebateEvent, { type: "turn" }>) {
  const base = event.roundNumber === 3 ? 1000 : 850;
  const lengthBonus = Math.min(900, event.message.length * 6);

  return base + lengthBonus;
}

function getTopicSummary(decision: DecisionRecord) {
  const topicEvent = decision.events.find(
    (event): event is Extract<DebateEvent, { type: "turn" }> =>
      event.type === "turn" && event.roundNumber === 1,
  );

  if (!topicEvent) {
    return null;
  }

  if (topicEvent.topicSummary?.topic && topicEvent.topicSummary.coreQuestion) {
    return topicEvent.topicSummary;
  }

  return parseTopicSummary(topicEvent.message);
}

function parseTopicSummary(message: string) {
  const normalized = message.replace(/\r/g, "").trim();
  const topicBlock = normalized.match(/주제\s*:\s*([\s\S]*?)(?:\n\s*\n?\s*핵심\s*질문\s*:|$)/);
  const questionBlock = normalized.match(/핵심\s*질문\s*:\s*([\s\S]*)$/);
  const quotedTopic = normalized.match(/주제는\s*["“]?([^"”]+?)["”]?\s*(?:입니다|에 대한|입니다\.)/);
  const quotedQuestion = normalized.match(/핵심\s*질문은\s*["“]?([^"”]+?[?？])["”]?/);

  const topic = cleanSummaryText(topicBlock?.[1] ?? quotedTopic?.[1] ?? "");
  const coreQuestion = cleanSummaryText(questionBlock?.[1] ?? quotedQuestion?.[1] ?? "");

  if (!topic || !coreQuestion) {
    return null;
  }

  return { topic, coreQuestion };
}

function cleanSummaryText(value: string) {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/^["“”]+|["“”]+$/g, "")
    .trim();
}

function sanitizeDisplayText(value: string) {
  return value
    .replace(/방실장님이\s*적은\s*우려는/g, "입력된 우려는")
    .replace(/방실장님/g, "사용자")
    .replace(/Claude\s*교수/g, "Claude")
    .replace(/GPT\s*교수/g, "GPT")
    .replace(/Gemini\s*교수/g, "Gemini");
}

function formatReadableMessage(value: string) {
  const sanitized = sanitizeDisplayText(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!sanitized) {
    return [""];
  }

  const explicitParagraphs = sanitized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (explicitParagraphs.length > 1) {
    return explicitParagraphs;
  }

  const explicitLines = sanitized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (explicitLines.length > 1) {
    return explicitLines;
  }

  const sentences = sanitized.match(/[^.!?。！？]+[.!?。！？]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [
    sanitized,
  ];

  if (sentences.length <= 1) {
    return sentences;
  }

  const paragraphs: string[] = [];
  let buffer = "";

  for (const sentence of sentences) {
    const shouldBreak =
      !buffer ||
      buffer.length >= 90 ||
      /^(다만|하지만|그래서|결국|반면|또한|즉|따라서|현실적으로|이 경우|추가로)/.test(sentence);

    if (shouldBreak) {
      if (buffer) {
        paragraphs.push(buffer.trim());
      }
      buffer = sentence;
    } else {
      buffer = `${buffer} ${sentence}`;
    }
  }

  if (buffer) {
    paragraphs.push(buffer.trim());
  }

  return paragraphs;
}

function formatBubbleTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getAuthOwnerId(auth: AuthMe) {
  if (!auth.configured) {
    return null;
  }

  return auth.user?.id ?? null;
}

function getDecisionOwnerId(decision: DecisionRecord, fallbackOwnerId: string | null) {
  return decision.ownerId ?? fallbackOwnerId;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
