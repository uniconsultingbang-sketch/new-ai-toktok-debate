"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  ChevronDown,
  FileText,
  Landmark,
  Lightbulb,
  Scale,
  Trash2,
} from "lucide-react";
import {
  DecisionRecord,
  TopicType,
  createDecisionId,
  deleteDecision,
  deleteDecisionAsync,
  formatDecisionDate,
  loadDecisions,
  loadDecisionsAsync,
  saveDecisionAsync,
} from "@/lib/decision-storage";

const statusText: Record<DecisionRecord["status"], string> = {
  running: "토론중",
  paused: "중단됨",
  completed: "완료",
  failed: "오류",
};

const statusStyle: Record<DecisionRecord["status"], string> = {
  running: "bg-blue-50 text-blue-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
};

export function DecisionDashboard() {
  const router = useRouter();
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [question, setQuestion] = useState("");
  const [formError, setFormError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    setDecisions(loadDecisions());
    void loadDecisionsAsync().then((items) => {
      if (isMounted) {
        setDecisions(items);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const recentDecisions = useMemo(() => decisions.slice(0, showAll ? 20 : 5), [decisions, showAll]);

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isStarting) {
      return;
    }

    const inputContent = question.trim();
    const inputTitle = makeTitle(inputContent);

    if (!inputContent || !inputTitle) {
      setFormError("토론할 안건을 한 줄 이상 입력해 주세요.");
      return;
    }

    setFormError("");
    setIsStarting(true);

    const now = new Date().toISOString();
    const decision: DecisionRecord = {
      id: createDecisionId(),
      title: inputTitle,
      content: inputContent,
      options: "",
      risks: "",
      focusAreas: ["수요", "근거", "리스크", "실행"],
      councilMode: "role_based",
      discussionDepth: "deep",
      banterLevel: "off",
      rebuttalRotations: 2,
      status: "running",
      createdAt: now,
      updatedAt: now,
      events: [],
      finalReport: null,
      error: null,
    };

    try {
      await saveDecisionAsync(decision);
      const target = `/decisions/${decision.id}`;
      window.location.assign(target);
    } catch {
      setIsStarting(false);
      setFormError("토론방을 여는 중 문제가 생겼습니다. 새로고침 후 다시 눌러 주세요.");
    }
  }

  function removeDecision(id: string) {
    if (!confirm("이 토론 기록을 삭제할까요?")) {
      return;
    }

    deleteDecision(id);
    void deleteDecisionAsync(id);
    setDecisions(loadDecisions());
  }

  function toggleExpandedItem(id: string) {
    setExpandedItems((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  return (
    <main className="prof-home-page">
      <div className="prof-home-shell">
        <section className="prof-hero-panel">
          <div className="prof-hero-copy">
            <p className="prof-eyebrow">new AI 톡톡 토론</p>
            <h1>3관점 논리 토론</h1>
            <p>
              안건을 넣으면 낙관, 회의, 중간 관점의 전문가들이 실제 회의처럼 반박하고 보완합니다.
            </p>
          </div>
          <div className="prof-hero-mark" aria-hidden="true">
            <Landmark className="size-8" />
          </div>
        </section>

        <form onSubmit={submitDecision} className="prof-input-panel">
          <div className="prof-mode-note">
            <BookOpenCheck className="size-4" />
            전문가 회의형 토론
          </div>

          <label className="prof-field">
            <span>토론 안건</span>
            <textarea
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value.slice(0, 200));
                if (formError) {
                  setFormError("");
                }
              }}
              maxLength={200}
              placeholder="예: 박카스 젊은사람들 다시 먹게하려면 어케해야하지 아저씨음료 느낌이 너무강한데"
              className="prof-main-textarea"
            />
            <small>생각나는 대로 200자 안에 적어주세요. AI가 주제와 핵심 질문을 정리합니다. {question.length}/200</small>
          </label>

          {formError ? <p className="prof-form-error">{formError}</p> : null}

          <button type="submit" className="prof-start-button" disabled={isStarting}>
            <Scale className="size-5" />
            {isStarting ? "논리 토론 여는 중..." : "3관점 토론 시작"}
          </button>
        </form>

        <section className="prof-recent-panel">
          <div className="prof-recent-head">
            <div>
              <p className="prof-eyebrow">Archive</p>
              <h2>최근 논리 토론</h2>
            </div>
            <span>{decisions.length ? `${decisions.length}개` : "비어 있음"}</span>
          </div>

          <div className="prof-recent-list">
            {recentDecisions.length ? (
              recentDecisions.map((decision) => {
                const displayQuestion = decision.content || decision.title;
                const isExpanded = expandedItems.has(decision.id);
                const canExpand = displayQuestion.length > 48;

                return (
                  <article
                    key={decision.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/decisions/${decision.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/decisions/${decision.id}`);
                      }
                    }}
                    className="prof-recent-item"
                  >
                    <TopicIcon topicType={decision.topicType} />
                    <div className="min-w-0">
                      <div className="prof-recent-meta">
                        <span className={`prof-status-pill ${statusStyle[decision.status]}`}>{statusText[decision.status]}</span>
                        <span>생성 {formatDecisionDate(decision.createdAt)}</span>
                      </div>
                      <h3 className={isExpanded ? "is-expanded" : ""}>{displayQuestion}</h3>
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpandedItem(decision.id);
                          }}
                          className="prof-inline-expand"
                        >
                          {isExpanded ? "접기" : "전체 보기"}
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeDecision(decision.id);
                      }}
                      className="prof-delete-button"
                      aria-label="토론 삭제"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="prof-empty-state">
                아직 저장된 토론이 없습니다. 첫 안건을 넣고 3관점 토론을 시작해 보세요.
              </div>
            )}
          </div>

          {decisions.length > 5 ? (
            <button type="button" onClick={() => setShowAll((value) => !value)} className="prof-more-button">
              {showAll ? "접기" : "더 보기"}
              <ChevronDown className={`size-4 transition ${showAll ? "rotate-180" : ""}`} />
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function TopicIcon({ topicType }: { topicType?: TopicType }) {
  const icon =
    topicType === "business" ? <FileText className="size-5" /> :
    topicType === "people" ? <Lightbulb className="size-5" /> :
    topicType === "pharma" ? <BookOpenCheck className="size-5" /> :
    <Scale className="size-5" />;

  return <div className="prof-topic-icon">{icon}</div>;
}

function makeTitle(value: string) {
  const normalized = value.trim().split(/\s+/).join(" ");

  if (!normalized) {
    return "";
  }

  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
}
