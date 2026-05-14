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
    avatarClass?: string;
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
    avatarClass: "prof-avatar-claude",
  },
  gpt: {
    title: "GPT",
    role: "",
    icon: <ShieldAlert className="size-5" />,
    accent: "#2B5B50",
    panel: "prof-speaker-gpt",
    avatarClass: "prof-avatar-gpt",
  },
  gemini: {
    title: "Gemini",
    role: "",
    icon: <Scale className="size-5" />,
    accent: "#394E87",
    panel: "prof-speaker-gemini",
    avatarClass: "prof-avatar-gemini",
  },
};

const speakerAvatarSrc: Partial<Record<SpeakerId, string>> = {
  claude: "/images/avatar-claude-new.png",
  gpt: "/images/avatar-gpt-new.png",
  gemini: "/images/avatar-gemini-new.png",
};

export function StreamingDecisionView({ decisionId }: { decisionId: string }) {
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [thinkingSpeaker, setThinkingSpeaker] = useState<SpeakerId | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [notFound, setNotFound] = useState(false);
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

  function scrollToFinalReport() {
    finalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const topicSummary = getTopicSummary(decision);
  const discussionFrames = getDiscussionFrames(decision.events);
  const topicPurpose = getTopicPurpose(decision);
  const perspectiveText = discussionFrames.length
    ? discussionFrames.join(", ")
    : "낙관 관점, 비관 관점, 중간 관점";

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
            <img
              src="/images/ai-talk-login-logo.png"
              alt="AI Talk Talk Beta"
              className="prof-detail-logo"
              draggable={false}
            />
            <span className="prof-topbar-spacer" aria-hidden="true" />
          </div>

          <div className="prof-topic-kicker-row">
            <p className="prof-section-kicker">
              <span className="prof-mini-icon prof-topic-kicker-icon">
                <img src="/images/icon-topic.png" alt="" />
              </span>
              주제 정리
            </p>
            <span className="prof-detail-status">
              <CheckCircle2 className="size-4" />
              {statusText[decision.status]}
            </span>
          </div>
          <h1 className="prof-detail-title">{questionText}</h1>

          <p className="prof-topic-subtitle">사회자가 안건을 정리하고, 주제에 맞는 3개 관점으로 토론합니다.</p>

          <TopicSummaryMini summary={topicSummary} purpose={topicPurpose} perspectives={perspectiveText} />

          <div className="prof-hero-summary">
            <img
              src="/images/ai-talk-speaker-pills.png"
              alt="사회자, Claude, GPT, Gemini"
              className="prof-speaker-pills-image"
              draggable={false}
            />
          </div>

          {decision.status === "paused" || decision.status === "failed" || decision.status === "completed" ? (
            <button type="button" onClick={restartDebate} className="prof-restart-button">
              <RotateCcw className="size-4" />
              {decision.status === "completed" ? "같은 안건으로 다시 토론" : "처음부터 다시 토론"}
            </button>
          ) : null}
        </section>

        <section className="prof-debate-panel">
          <div className="prof-panel-head">
            <h2 className="prof-panel-title">
              <span className="prof-mini-icon">
                <img src="/images/icon-perspective.png" alt="" />
              </span>
              3 관점 토론
            </h2>
            <button type="button" onClick={scrollToFinalReport} className="prof-result-link">
              토론 결과
            </button>
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
          {decision.finalReport ? (
            <button type="button" onClick={scrollToFinalReport} className="prof-result-button">
              <FileText className="size-4" />
              결과 바로 보기
            </button>
          ) : null}
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

function TopicSummaryMini({
  summary,
  purpose,
  perspectives,
}: {
  summary: { topic: string; coreQuestion: string } | null;
  purpose: string;
  perspectives: string;
}) {
  return (
    <section className="prof-topic-summary-mini" aria-label="주제 정리">
      <article className="prof-topic-cell">
        <span className="prof-mini-icon">
          <img src="/images/icon-insight.png" alt="" />
        </span>
        <div>
          <h2>핵심 질문</h2>
          <p>{summary?.coreQuestion ?? "AI가 사용자가 쓴 안건을 핵심 질문으로 정리하고 있습니다."}</p>
        </div>
      </article>
      <article className="prof-topic-cell">
        <span className="prof-mini-icon">
          <img src="/images/icon-purpose.png" alt="" />
        </span>
        <div>
          <h2>토론 목적</h2>
          <p>{purpose}</p>
        </div>
      </article>
      <article className="prof-topic-cell">
        <span className="prof-mini-icon">
          <img src="/images/icon-perspective.png" alt="" />
        </span>
        <div>
          <h2>토론 관점</h2>
          <p>{perspectives}</p>
        </div>
      </article>
    </section>
  );
}

function DebateTurn({ event }: { event: Extract<DebateEvent, { type: "turn" }> }) {
  if (event.speaker === "moderator") {
    return event.roundNumber === 1 || event.roundTitle === "주제 정리" ? (
      <ModeratorTurn event={event} />
    ) : (
      <IssueSummaryTurn event={event} />
    );
  }

  const meta = speakerMeta[event.speaker];
  const analysis = event.roundNumber === 1 ? null : formatAnalysisMessage(event.message);
  const avatarSrc = speakerAvatarSrc[event.speaker];
  const isRight = event.speaker === "gpt";

  return (
    <article className={`prof-turn-card prof-ai-turn ${isRight ? "is-right" : "is-left"} ${meta.panel}`}>
      <div className="prof-speaker-head">
        {!isRight && avatarSrc ? (
          <span className="prof-speaker-avatar is-ai">
            <img src={avatarSrc} alt="" />
          </span>
        ) : null}
        <div>
          <h3>{meta.title}</h3>
        </div>
        {isRight && avatarSrc ? (
          <span className="prof-speaker-avatar is-ai">
            <img src={avatarSrc} alt="" />
          </span>
        ) : null}
      </div>
      <div className="prof-analysis-card">
        <h3 className="prof-analysis-title">{event.roundTitle}</h3>
        {analysis ? (
          <div className="prof-analysis-body">
            <div className="prof-analysis-points">
              <AnalysisList title="장점" items={analysis.pros} />
              <AnalysisList title="단점" items={analysis.cons} />
            </div>
            <aside className="prof-insight-card">
              <h4>인사이트</h4>
              <p>{analysis.insight}</p>
            </aside>
          </div>
        ) : (
          <div className="prof-turn-message">
            {formatReadableMessage(event.message).map((paragraph, index) => (
              <p key={`${event.id}-paragraph-${index}`}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {(items.length ? items : ["토론 내용이 정리되면 표시됩니다."]).slice(0, 3).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ModeratorTurn({ event }: { event: Extract<DebateEvent, { type: "turn" }> }) {
  const summary = event.topicSummary ?? parseTopicSummary(event.message);
  const message = summary
    ? `주제는 "${summary.topic}"입니다. 핵심 질문은 "${summary.coreQuestion}"입니다. 세 관점에서 현실적으로 토론해 보겠습니다.`
    : formatReadableMessage(event.message).join(" ");

  return (
    <article className="prof-moderator-card">
      <div className="prof-moderator-content">
        <div className="prof-moderator-portrait">
          <img src="/images/moderator-host.png" alt="" />
        </div>
        <div>
          <p className="prof-moderator-title">사회자</p>
          <p className="prof-moderator-copy">{message}</p>
        </div>
      </div>
    </article>
  );
}

function IssueSummaryTurn({ event }: { event: Extract<DebateEvent, { type: "turn" }> }) {
  const analysis = formatAnalysisMessage(event.message);
  const issueItems = [...analysis.pros, ...analysis.cons]
    .map((item) => item.replace(/^(장점|단점|인사이트|핵심\s*의견)\s*[:：]\s*/i, "").trim())
    .filter(Boolean);
  const fallbackItems = formatReadableMessage(event.message)
    .flatMap((paragraph) => splitSentences(paragraph))
    .map((item) => item.replace(/^(장점|단점|인사이트|핵심\s*의견)\s*[:：]\s*/i, "").trim())
    .filter(Boolean);
  const items = (issueItems.length ? issueItems : fallbackItems).slice(0, 4);

  return (
    <article className="prof-issue-card">
      <h3>{event.roundTitle || "핵심 쟁점"}</h3>
      <ul>
        {(items.length ? items : ["토론에서 갈린 기준과 확인할 조건을 정리하고 있습니다."]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {analysis.insight ? <p className="prof-issue-insight">{analysis.insight}</p> : null}
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
  const conclusion = formatConclusion(report.summary, report.recommendation);
  const conclusionText = [conclusion.headline, ...conclusion.paragraphs].join(" ");
  const labels = {
    mainClaims: report.sectionLabels?.mainClaims ?? "주요 주장 비교",
    agreements: report.sectionLabels?.agreements ?? "합의된 부분",
    disagreements: report.sectionLabels?.disagreements ?? "의견이 갈린 부분",
    keyReasons: report.sectionLabels?.keyReasons ?? "이유",
    keyRisks: report.sectionLabels?.keyRisks ?? "주의할 점",
    conditions: report.sectionLabels?.conditions ?? "핵심 쟁점",
    nextActions: report.sectionLabels?.nextActions ?? "현실적인 실행 방향",
    evidenceSources: report.sectionLabels?.evidenceSources ?? "근거 자료",
  };
  const mainClaims = report.mainClaims?.length ? report.mainClaims : report.keyReasons;
  const agreements = report.agreements?.length ? report.agreements : report.conditions;
  const disagreements = report.disagreements?.length ? report.disagreements : report.keyRisks;

  return (
    <section className="prof-final-panel">
      <div className="prof-final-head">
        <span className="prof-mini-icon">
          <img src="/images/icon-final.png" alt="" />
        </span>
        <div>
          <h2>{report.heading ?? "결론"}</h2>
        </div>
      </div>

      <article className="prof-recommend-card prof-conclusion-block is-primary">
        <h3>한 줄 정리</h3>
        <p>{conclusionText}</p>
      </article>

      <div className="prof-summary-grid">
        <SummaryCard title={labels.mainClaims} items={mainClaims} tone="blue" />
        <SummaryCard title={labels.agreements} items={agreements} tone="gold" />
        <SummaryCard title={labels.disagreements} items={disagreements} tone="red" />
        <SummaryCard title={labels.nextActions} items={report.nextActions} tone="green" />
      </div>

      <div className="prof-source-card">
        <h3>{labels.evidenceSources}</h3>
        <ul>
          {(report.evidenceSources?.length ? report.evidenceSources : ["추가 확인 필요"]).map((source) => (
            <li key={source}>
              {/^https?:\/\//i.test(source) ? (
                <a href={source} target="_blank" rel="noreferrer">{source}</a>
              ) : (
                source
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SummaryCard({ title, items, tone }: { title: string; items: string[]; tone: "blue" | "red" | "gold" | "green" }) {
  return (
    <article className={`prof-summary-card ${tone}`}>
      <h3>{title}</h3>
      <ul>
        {(items.length ? items : ["토론 결과가 정리되면 이 항목에 표시됩니다."]).slice(0, 4).map((item) => (
          <SummaryItem key={item} value={item} />
        ))}
      </ul>
    </article>
  );
}

function SummaryItem({ value }: { value: string }) {
  const match = value.match(/^(Claude|GPT|Gemini|사회자)\s*:\s*(.+)$/);

  if (!match) {
    return <li>{value}</li>;
  }

  return (
    <li>
      <strong>{match[1]}:</strong> {match[2]}
    </li>
  );
}

function getDiscussionFrames(events: DebateEvent[]) {
  const excluded = new Set(["주제 정리", "첫 의견", "핵심 쟁점"]);
  const frames = events
    .filter(
      (event): event is Extract<DebateEvent, { type: "turn" }> =>
        event.type === "turn" && event.speaker !== "moderator" && Boolean(event.roundTitle),
    )
    .map((event) => event.roundTitle.replace(/^논리\s*토론\s*[-:]?\s*/i, "").trim())
    .filter((title) => title && !excluded.has(title));

  return Array.from(new Set(frames)).slice(0, 3);
}

function getTopicPurpose(decision: DecisionRecord) {
  const frames = getDiscussionFrames(decision.events);

  if (frames.length) {
    return `${frames.join(", ")}을 비교해 현실적인 판단과 실행 방향을 도출`;
  }

  return "가능성, 리스크, 실행 조건을 함께 비교해 현실적인 판단 도출";
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

function formatStructuredMessage(value: string) {
  const sanitized = sanitizeDisplayText(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  const lines = sanitized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines
    .filter((line) => /^[-•*]\s+/.test(line))
    .map((line) => line.replace(/^[-•*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
  const prose = lines.length
    ? lines.filter((line) => !/^[-•*]\s+/.test(line)).join(" ")
    : sanitized;
  const sentences = splitSentences(prose);
  const headlineIndex = sentences.findIndex((sentence) => !isConnectionOnlySentence(sentence));
  const resolvedHeadlineIndex = headlineIndex >= 0 ? headlineIndex : 0;
  const headline = sentences[resolvedHeadlineIndex] || prose || "핵심 의견을 정리하고 있습니다.";
  const paragraphs = sentences
    .filter((sentence, index) => index !== resolvedHeadlineIndex && !isConnectionOnlySentence(sentence))
    .slice(0, 3);

  return {
    headline,
    paragraphs,
    bullets,
  };
}

function formatAnalysisMessage(value: string) {
  const sanitized = sanitizeDisplayText(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  const sections = parseAnalysisSections(sanitized);

  if (sections.pros.length || sections.cons.length || sections.insight) {
    return {
      pros: sections.pros,
      cons: sections.cons,
      insight: sections.insight || sections.headline || "핵심 판단 기준을 더 구체화해야 합니다.",
    };
  }

  const fallback = formatStructuredMessage(sanitized);
  const riskSentences = fallback.paragraphs.filter((paragraph) => /(다만|하지만|리스크|위험|부담|비용|기준|없으면|부족|어렵)/.test(paragraph));
  const positiveSentences = fallback.paragraphs.filter((paragraph) => !riskSentences.includes(paragraph));

  return {
    pros: [...fallback.bullets, ...positiveSentences].slice(0, 3),
    cons: (riskSentences.length ? riskSentences : fallback.paragraphs.slice(1)).slice(0, 3),
    insight: fallback.headline,
  };
}

function parseAnalysisSections(value: string) {
  const result = {
    headline: "",
    pros: [] as string[],
    cons: [] as string[],
    insight: "",
  };
  let current: "headline" | "pros" | "cons" | "insight" = "headline";

  for (const rawLine of value.split(/\n+/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const normalized = line.replace(/\s/g, "");

    if (/^(핵심의견|핵심|의견)[:：]/.test(normalized)) {
      result.headline = cleanAnalysisLine(line.replace(/^(핵심\s*의견|핵심|의견)\s*[:：]\s*/i, ""));
      current = "headline";
      continue;
    }

    if (/^장점[:：]?$/.test(normalized)) {
      current = "pros";
      continue;
    }

    if (/^단점[:：]?$/.test(normalized)) {
      current = "cons";
      continue;
    }

    if (/^인사이트[:：]?$/.test(normalized)) {
      current = "insight";
      continue;
    }

    if (/^장점[:：]/.test(line)) {
      result.pros.push(cleanAnalysisLine(line.replace(/^장점\s*[:：]\s*/i, "")));
      current = "pros";
      continue;
    }

    if (/^단점[:：]/.test(line)) {
      result.cons.push(cleanAnalysisLine(line.replace(/^단점\s*[:：]\s*/i, "")));
      current = "cons";
      continue;
    }

    if (/^인사이트[:：]/.test(line)) {
      result.insight = cleanAnalysisLine(line.replace(/^인사이트\s*[:：]\s*/i, ""));
      current = "insight";
      continue;
    }

    const clean = cleanAnalysisLine(line);

    if (!clean) {
      continue;
    }

    if (current === "pros") {
      result.pros.push(clean);
    } else if (current === "cons") {
      result.cons.push(clean);
    } else if (current === "insight") {
      result.insight = result.insight ? `${result.insight} ${clean}` : clean;
    } else if (!result.headline) {
      result.headline = clean;
    }
  }

  result.pros = result.pros.filter(Boolean).slice(0, 3);
  result.cons = result.cons.filter(Boolean).slice(0, 3);
  result.insight = result.insight.trim();
  return result;
}

function cleanAnalysisLine(value: string) {
  return value.replace(/^[-•*]\s*/, "").trim();
}

function isConnectionOnlySentence(value: string) {
  const normalized = value
    .replace(/[.!?。！？"“”'‘’\s]/g, "")
    .trim();

  if (!normalized) return false;

  if (
    [
      "사회자가정리한판단기준에동의합니다",
      "Claude의가능성평가는인정합니다",
      "두의견모두타당합니다",
      "Gemini의우려는필요합니다",
      "Claude의제한된실험제안은이전보다현실적입니다",
      "GPT의지적까지반영하면결론은단순한찬반이아닙니다",
    ].includes(normalized)
  ) {
    return true;
  }

  return (
    normalized.length <= 28 &&
    /(동의합니다|인정합니다|타당합니다|필요합니다|현실적입니다|맞습니다)$/.test(normalized)
  );
}

function formatConclusion(summary: string, recommendation: string) {
  const sanitized = sanitizeDisplayText(summary)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  const sentences = splitSentences(sanitized);
  const headline = sentences[0] || `${recommendation}으로 보는 것이 현실적입니다.`;
  const paragraphs = sentences.slice(1, 3);

  return {
    headline,
    paragraphs,
  };
}

function splitSentences(value: string) {
  return value
    .match(/[^.!?。！？]+[.!?。！？]?/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
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
