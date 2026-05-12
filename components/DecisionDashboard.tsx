"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  Clock3,
  History,
  LogOut,
  Menu,
  Scale,
  SendHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  DecisionRecord,
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
  paused: "중단",
  completed: "완료",
  failed: "오류",
};

const statusStyle: Record<DecisionRecord["status"], string> = {
  running: "bg-blue-50 text-blue-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
};

type AuthMe = {
  configured: boolean;
  authenticated: boolean;
  user: { id: string; name: string } | null;
};

export function DecisionDashboard() {
  const router = useRouter();
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [question, setQuestion] = useState("");
  const [formError, setFormError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());
  const [auth, setAuth] = useState<AuthMe | null>(null);

  useEffect(() => {
    let isMounted = true;

    void fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: AuthMe) => {
        if (isMounted) {
          setAuth(data);
          const ownerId = getAuthOwnerId(data);
          setDecisions(loadDecisions(ownerId));
          void loadDecisionsAsync(ownerId).then((items) => {
            if (isMounted) {
              setDecisions(items);
            }
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setDecisions(loadDecisions());
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const recentDecisions = useMemo(() => decisions.slice(0, 30), [decisions]);

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isStarting) {
      return;
    }

    const inputContent = question.trim();
    const inputTitle = makeTitle(inputContent);
    const ownerId = getAuthOwnerId(auth);

    if (!auth) {
      setFormError("로그인 상태를 확인하는 중입니다. 잠시 후 다시 눌러 주세요.");
      return;
    }

    if (!inputContent || !inputTitle) {
      setFormError("토론할 안건을 1자 이상 입력해 주세요.");
      return;
    }

    if (auth?.configured && !ownerId) {
      setFormError("로그인 상태를 확인한 뒤 다시 시도해 주세요.");
      return;
    }

    setFormError("");
    setIsStarting(true);

    const now = new Date().toISOString();
    const decision: DecisionRecord = {
      id: createDecisionId(),
      ownerId: ownerId ?? undefined,
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
      await saveDecisionAsync(decision, ownerId);
      window.location.assign(`/decisions/${decision.id}`);
    } catch {
      setIsStarting(false);
      setFormError("토론방을 여는 중 문제가 생겼습니다. 새로고침 후 다시 눌러 주세요.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function removeDecision(id: string) {
    if (!confirm("이 토론 기록을 삭제할까요?")) {
      return;
    }

    const ownerId = getAuthOwnerId(auth);
    deleteDecision(id, ownerId);
    void deleteDecisionAsync(id, ownerId);
    setDecisions(loadDecisions(ownerId));
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
    <main className="simple-home-page">
      <input id="archive-toggle" type="checkbox" className="archive-toggle" aria-hidden="true" />
      <div className="simple-home-shell">
        <header className="simple-topbar">
          <label
            htmlFor="archive-toggle"
            className="simple-icon-button"
            aria-label="이전 토론 기록 열기"
            role="button"
            tabIndex={0}
          >
            <Menu className="size-6" />
          </label>

          <div className="simple-brand">
            <p>AI Talk Talk</p>
            <span>3관점 논리 토론</span>
          </div>

          {auth?.configured ? (
            <button type="button" className="simple-icon-button" onClick={logout} aria-label="로그아웃">
              <LogOut className="size-5" />
            </button>
          ) : (
            <div className="simple-icon-spacer" />
          )}
        </header>

        <section className="simple-input-card">
          <div className="simple-input-head">
            <div>
              <p className="prof-eyebrow">New Debate</p>
              <h1>무엇을 토론할까요?</h1>
            </div>
            <Sparkles className="size-6" />
          </div>

          <p className="simple-guide">생각나는 대로 적어주세요. AI가 주제와 핵심 질문을 먼저 정리합니다.</p>

          <form onSubmit={submitDecision} className="simple-question-form">
            <label className="simple-question-box">
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
                placeholder="예: 신약 개발에 필요한 AI 인재는 어떤 사람이 좋을까?"
              />
              <small>{question.length}/200</small>
            </label>

            {formError ? <p className="prof-form-error">{formError}</p> : null}

            <button type="submit" className="simple-start-button" disabled={isStarting}>
              <SendHorizontal className="size-5" />
              {isStarting ? "토론방 여는 중..." : "토론 시작"}
            </button>
          </form>
        </section>

        <section className="simple-policy-card">
          <Scale className="size-5" />
          <p>낙관, 비관, 중간 관점이 실제 회의처럼 반박하고 보완합니다.</p>
        </section>
      </div>

      <div className="archive-overlay" role="dialog" aria-modal="true" aria-label="이전 토론 기록">
        <label htmlFor="archive-toggle" className="archive-backdrop" aria-label="닫기" />
        <aside className="archive-drawer">
          <div className="archive-head">
            <div>
              <p className="prof-eyebrow">Archive</p>
              <h2>이전 토론 기록</h2>
            </div>
            <label htmlFor="archive-toggle" className="simple-icon-button" aria-label="닫기" role="button" tabIndex={0}>
              <X className="size-5" />
            </label>
          </div>

          {auth?.configured && auth.user ? <p className="archive-user">{auth.user.name}님 로그인 중</p> : null}

          <div className="archive-list">
            {recentDecisions.length ? (
              recentDecisions.map((decision) => {
                const displayQuestion = decision.content || decision.title;
                const isExpanded = expandedItems.has(decision.id);
                const canExpand = displayQuestion.length > 58;

                return (
                  <article key={decision.id} className="archive-item">
                    <button
                      type="button"
                      className="archive-main-button"
                      onClick={() => router.push(`/decisions/${decision.id}`)}
                    >
                      <span className={`prof-status-pill ${statusStyle[decision.status]}`}>{statusText[decision.status]}</span>
                      <strong className={isExpanded ? "is-expanded" : ""}>{displayQuestion}</strong>
                      <span>
                        <Clock3 className="size-3" />
                        {formatDecisionDate(decision.createdAt)}
                      </span>
                    </button>

                    <div className="archive-actions">
                      {canExpand ? (
                        <button type="button" onClick={() => toggleExpandedItem(decision.id)}>
                          {isExpanded ? "접기" : "펼침"}
                        </button>
                      ) : null}
                      <button type="button" onClick={() => removeDecision(decision.id)} aria-label="토론 삭제">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="archive-empty">
                <History className="size-6" />
                <p>아직 저장된 토론이 없습니다.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function makeTitle(value: string) {
  const normalized = value.trim().split(/\s+/).join(" ");

  if (!normalized) {
    return "";
  }

  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
}

function getAuthOwnerId(auth: AuthMe | null) {
  if (!auth?.configured) {
    return null;
  }

  return auth.user?.id ?? null;
}
