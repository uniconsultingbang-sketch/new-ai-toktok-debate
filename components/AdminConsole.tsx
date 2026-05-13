"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Coins,
  Database,
  FolderKanban,
  Gauge,
  Layers3,
  LogOut,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import {
  DecisionRecord,
  DecisionStatus,
  deleteDecisionAsync,
  formatDecisionDate,
  getTopicLabel,
  loadDecisionsAsync,
  saveDecisionAsync,
} from "@/lib/decision-storage";
import styles from "./AdminConsole.module.css";

type AdminTab = "dashboard" | "users" | "costs" | "records" | "pricing";

type AuthMe = {
  configured: boolean;
  authenticated: boolean;
  user: { id: string; name: string } | null;
};

type PricingConfig = Record<
  "openai" | "claude" | "gemini",
  {
    provider: string;
    model: string;
    inputUsdPerMillion: number;
    outputUsdPerMillion: number;
  }
>;

type CostBreakdown = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
};

type DecisionUsageSummary = {
  decision: DecisionRecord;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  estimated: boolean;
  modelCosts: CostBreakdown[];
};

type UserUsageSummary = {
  ownerId: string;
  topicCount: number;
  dates: string[];
  totalTokens: number;
  costUsd: number;
  records: DecisionUsageSummary[];
};

const PRICING_STORAGE_KEY = "aiTalkTalkAdminPricingConfig";
const USD_TO_KRW = 1400;
const REGISTERED_USER_COUNT = 3;
const REGISTERED_USERS = ["demo01", "demo02", "demo03"] as const;
const PAGE_SIZE = 5;

type OwnerFilter = "all" | (typeof REGISTERED_USERS)[number];
type PeriodFilter = "all" | "today" | "7d" | "30d";

const defaultPricing: PricingConfig = {
  openai: {
    provider: "OpenAI",
    model: "gpt-4.1-mini",
    inputUsdPerMillion: 0.4,
    outputUsdPerMillion: 1.6,
  },
  claude: {
    provider: "Claude",
    model: "claude-sonnet-4",
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
  },
  gemini: {
    provider: "Gemini",
    model: "gemini-2.5-flash",
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
  },
};

const statusLabels: Record<DecisionStatus, string> = {
  running: "토론 중",
  paused: "중단",
  completed: "완료",
  failed: "오류",
};

const navigationItems: Array<{ id: AdminTab; label: string; helper: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "전체 대시보드", helper: "운영 현황", icon: <Gauge size={16} /> },
  { id: "users", label: "사용자별 사용량", helper: "사용량 확인", icon: <Users size={16} /> },
  { id: "costs", label: "토큰/비용 분석", helper: "비용 분석", icon: <Coins size={16} /> },
  { id: "records", label: "토론 기록 관리", helper: "기록 관리", icon: <FolderKanban size={16} /> },
  { id: "pricing", label: "요금 계산 설정", helper: "요금 기준", icon: <SlidersHorizontal size={16} /> },
];

const tabMeta: Record<AdminTab, { title: string; description: string }> = {
  dashboard: {
    title: "전체 대시보드",
    description: "AI Talk Talk 운영 현황, 사용자 수, 추정 토큰과 비용을 한눈에 봅니다.",
  },
  users: {
    title: "사용자별 사용량",
    description: "사용자별 주제 개수와 입력 일자를 확인합니다. 입력 본문은 표시하지 않습니다.",
  },
  costs: {
    title: "토큰/비용 분석",
    description: "기존 기록은 추정값으로 계산하고, 향후 실제 usage 저장 구조를 받을 수 있게 표시합니다.",
  },
  records: {
    title: "토론 기록 관리",
    description: "토론 기록을 검색하고 상태를 변경합니다. 상세에서도 본문 노출은 최소화합니다.",
  },
  pricing: {
    title: "요금 계산 설정",
    description: "모델별 달러 단가를 입력하면 어드민 비용은 원화 기준으로 환산해 보여줍니다.",
  },
};

export function AdminConsole() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("관리자 데이터를 불러오는 중입니다.");
  const [pricing, setPricing] = useState<PricingConfig>(defaultPricing);

  useEffect(() => {
    setPricing(readPricingConfig());
    void refreshAdminData();
  }, []);

  const usageSummaries = useMemo(
    () => decisions.map((decision) => buildUsageSummary(decision, pricing)),
    [decisions, pricing],
  );

  const scopedUsage = useMemo(
    () =>
      usageSummaries.filter(({ decision }) => {
        const ownerId = ownerLabel(decision.ownerId);
        return (ownerFilter === "all" || ownerId === ownerFilter) && isInPeriod(decision.createdAt, periodFilter);
      }),
    [ownerFilter, periodFilter, usageSummaries],
  );

  const dashboard = useMemo(() => {
    const scopedDecisions = scopedUsage.map((item) => item.decision);
    const completed = scopedDecisions.filter((decision) => decision.status === "completed").length;
    const running = scopedDecisions.filter((decision) => decision.status === "running").length;
    const failed = scopedDecisions.filter((decision) => decision.status === "failed").length;
    const paused = scopedDecisions.filter((decision) => decision.status === "paused").length;
    const deleted = scopedDecisions.filter((decision) => decision.deletedAt).length;
    const totalTokens = scopedUsage.reduce((sum, item) => sum + item.totalTokens, 0);
    const totalCost = scopedUsage.reduce((sum, item) => sum + item.costUsd, 0);

    return {
      total: scopedDecisions.length,
      completed,
      running,
      failed,
      paused,
      deleted,
      owners: REGISTERED_USER_COUNT,
      totalTokens,
      totalCost,
    };
  }, [scopedUsage]);

  const filteredUsage = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return scopedUsage.filter(({ decision }) => {
      const searchable = [decision.title, decision.ownerId ?? "", getTopicLabel(decision.topicType)]
        .join(" ")
        .toLowerCase();
      const matchesKeyword = !keyword || searchable.includes(keyword);
      return matchesKeyword;
    });
  }, [query, scopedUsage]);

  const userSummaries = useMemo(() => buildUserSummaries(scopedUsage), [scopedUsage]);
  const filteredUserSummaries = useMemo(() => buildUserSummaries(filteredUsage), [filteredUsage]);

  const providerTotals = useMemo(() => {
    const totals = new Map<string, CostBreakdown>();

    for (const usage of scopedUsage) {
      for (const modelCost of usage.modelCosts) {
        const key = `${modelCost.provider}:${modelCost.model}`;
        const current =
          totals.get(key) ??
          ({
            ...modelCost,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costUsd: 0,
          } satisfies CostBreakdown);

        current.inputTokens += modelCost.inputTokens;
        current.outputTokens += modelCost.outputTokens;
        current.totalTokens += modelCost.totalTokens;
        current.costUsd += modelCost.costUsd;
        totals.set(key, current);
      }
    }

    return Array.from(totals.values()).sort((a, b) => b.costUsd - a.costUsd);
  }, [scopedUsage]);

  const selectedUsage =
    filteredUsage.find((usage) => usage.decision.id === selectedId) ?? filteredUsage[0] ?? null;

  async function refreshAdminData() {
    setIsLoading(true);
    setNotice("최신 운영 데이터를 확인하고 있습니다.");

    const [nextDecisions, authResponse] = await Promise.all([
      loadDecisionsAsync(null, { includeDeleted: true }),
      fetch("/api/auth/me", { cache: "no-store" })
        .then((response) => response.json() as Promise<AuthMe>)
        .catch(() => null),
    ]);

    setDecisions(nextDecisions);
    setAuth(authResponse);
    setSelectedId((current) => current ?? nextDecisions[0]?.id ?? null);
    setNotice(
      nextDecisions.length
        ? `${nextDecisions.length}개의 토론 기록을 확인했습니다.`
        : "아직 관리자 화면에서 볼 토론 기록이 없습니다.",
    );
    setIsLoading(false);
  }

  async function changeDecisionStatus(decision: DecisionRecord, status: DecisionStatus) {
    const updated: DecisionRecord = {
      ...decision,
      status,
      updatedAt: new Date().toISOString(),
    };

    setDecisions((current) => current.map((item) => (item.id === decision.id ? updated : item)));
    setNotice(`"${decision.title}" 상태를 ${statusLabels[status]}(으)로 변경했습니다.`);
    await saveDecisionAsync(updated, decision.ownerId ?? null);
  }

  async function deleteDecision(decision: DecisionRecord) {
    const shouldDelete = window.confirm(`"${decision.title}" 기록을 관리자 목록에서 삭제할까요?`);

    if (!shouldDelete) {
      return;
    }

    setDecisions((current) => current.filter((item) => item.id !== decision.id));
    setSelectedId((current) => (current === decision.id ? null : current));
    setNotice(`"${decision.title}" 기록을 삭제했습니다.`);
    await deleteDecisionAsync(decision.id, decision.ownerId ?? null);
  }

  async function logoutAdmin() {
    setNotice("관리자 계정에서 로그아웃하는 중입니다.");

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login?next=%2Fadmin");
    }
  }

  function updatePricing(providerKey: keyof PricingConfig, field: keyof PricingConfig[keyof PricingConfig], value: string) {
    const next: PricingConfig = {
      ...pricing,
      [providerKey]: {
        ...pricing[providerKey],
        [field]:
          field === "inputUsdPerMillion" || field === "outputUsdPerMillion"
            ? Math.max(0, Number(value) || 0)
            : value,
      },
    };

    setPricing(next);
    savePricingConfig(next);
    setNotice("요금 계산 설정을 이 PC의 어드민 화면에 저장했습니다.");
  }

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <img src="/images/ai-talk-talk-logo-beta.png" alt="AI Talk Talk Beta" />
          <div>
            <strong>AI Talk Talk</strong>
            <small>Admin Console</small>
          </div>
        </div>

        <label className={styles.sidebarSearch}>
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="기록 검색..." />
        </label>

        <div className={styles.menuLabel}>Admin Menu</div>
        <nav className={styles.navList} aria-label="관리자 메뉴">
          {navigationItems.map((item) => (
            <button
              className={`${styles.navItem} ${activeTab === item.id ? styles.navItemActive : ""}`}
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
            >
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
              <small>{item.helper}</small>
              <ChevronRight size={14} />
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.adminIdentity}>
            <ShieldCheck size={16} />
            <div>
              <strong>{auth?.configured ? "관리자 로그인" : "로컬 테스트"}</strong>
              <span>{auth?.user?.id ?? "관리자 화면"}</span>
            </div>
          </div>
          {auth?.configured ? (
            <button className={styles.logoutButton} type="button" onClick={() => void logoutAdmin()}>
              <LogOut size={14} />
              로그아웃
            </button>
          ) : null}
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <h1>{tabMeta[activeTab].title}</h1>
            <p>{tabMeta[activeTab].description}</p>
          </div>
          <div className={styles.topActions}>
            <label className={styles.selectControl}>
              <span>사용자</span>
              <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value as OwnerFilter)}>
                <option value="all">전체</option>
                {REGISTERED_USERS.map((userId) => (
                  <option key={userId} value={userId}>
                    {userId}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.selectControl}>
              <span>기간</span>
              <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}>
                <option value="all">전체 기간</option>
                <option value="today">오늘</option>
                <option value="7d">최근 7일</option>
                <option value="30d">최근 30일</option>
              </select>
              <CalendarDays size={15} />
            </label>
            <button className={styles.primaryButton} type="button" onClick={() => void refreshAdminData()}>
              {isLoading ? <Loader2 className={styles.spinIcon} size={16} /> : <RefreshCw size={16} />}
              새로고침
            </button>
          </div>
        </header>

        <section className={styles.noticeBar} aria-live="polite">
          <Database size={16} />
          <span>{notice}</span>
        </section>

        {activeTab === "dashboard" ? (
          <DashboardView
            dashboard={dashboard}
            providerTotals={providerTotals}
            userSummaries={userSummaries}
          />
        ) : null}

        {activeTab === "users" ? <UsersView userSummaries={filteredUserSummaries} /> : null}

        {activeTab === "costs" ? (
          <CostsView dashboard={dashboard} providerTotals={providerTotals} usageSummaries={filteredUsage} />
        ) : null}

        {activeTab === "records" ? (
          <>
            <section className={styles.recordsSummaryBand}>
              <UserTokenSummaryPanel userSummaries={userSummaries} />
            </section>
            <RecordsView
              filteredUsage={filteredUsage}
              selectedUsage={selectedUsage}
              onSelect={(id) => setSelectedId(id)}
              onStatusChange={(decision, status) => void changeDecisionStatus(decision, status)}
              onDelete={(decision) => void deleteDecision(decision)}
            />
          </>
        ) : null}

        {activeTab === "pricing" ? (
          <PricingView pricing={pricing} onPricingChange={updatePricing} onReset={() => {
            setPricing(defaultPricing);
            savePricingConfig(defaultPricing);
            setNotice("요금 계산 설정을 기본값으로 되돌렸습니다.");
          }} />
        ) : null}
      </section>
    </main>
  );
}

function DashboardView({
  dashboard,
  providerTotals,
  userSummaries,
}: {
  dashboard: {
    total: number;
    completed: number;
    running: number;
    failed: number;
    paused: number;
    deleted: number;
    owners: number;
    totalTokens: number;
    totalCost: number;
  };
  providerTotals: CostBreakdown[];
  userSummaries: UserUsageSummary[];
}) {
  return (
    <>
      <section className={styles.statGrid}>
        <StatCard icon={<Layers3 size={22} />} label="전체 토론 수" value={`${dashboard.total}`} helper="누적 생성된 토론 기록" />
        <StatCard icon={<Users size={22} />} label="사용자 수" value={`${dashboard.owners}`} helper="등록된 전체 사용자" tone="blue" />
        <StatCard icon={<CheckCircle2 size={22} />} label="완료 수" value={`${dashboard.completed}`} helper="정상 완료된 토론" tone="green" />
        <StatCard icon={<AlertTriangle size={22} />} label="오류 수" value={`${dashboard.failed}`} helper="오류로 종료된 토론" tone="red" />
        <StatCard icon={<BarChart3 size={22} />} label="추정 토큰" value={formatNumber(dashboard.totalTokens)} helper="전체 추정 토큰 수" tone="blue" />
        <StatCard icon={<Coins size={22} />} label="추정 비용" value={formatCost(dashboard.totalCost)} helper="전체 추정 비용" tone="yellow" />
      </section>

      <section className={styles.dashboardTopGrid}>
        <Panel title="최근 토론 상태" label="">
          <div className={styles.legendRow}>
            <span><i className={styles.legendBlue} />완료</span>
            <span><i className={styles.legendSky} />진행중</span>
            <span><i className={styles.legendRed} />오류</span>
            <span><i className={styles.legendGray} />대기</span>
          </div>
          <StatusSummary dashboard={dashboard} />
        </Panel>

        <Panel title="모델별 비용 요약" label="">
          <div className={styles.legendRow}>
            <span><i className={styles.legendBlue} />OpenAI</span>
            <span><i className={styles.legendSky} />Claude</span>
            <span><i className={styles.legendNavy} />Gemini</span>
          </div>
          <ProviderCostSummary providerTotals={providerTotals} />
        </Panel>

        <Panel title="" label="" className={styles.infoPanel}>
          <div className={styles.infoIllustration}>
            <span />
            <span />
            <span />
          </div>
          <h2>서비스 현황을 한눈에</h2>
          <p>AI Talk Talk의 사용 현황과 비용을 보다 쉽게 관리하세요.</p>
          <div className={styles.infoNote}>
            <strong>안내</strong>
            <span>기존 기록은 실제 토큰 데이터가 없어 추정치로 표시됩니다.</span>
            <span>요금 계산 설정은 원화 환산 비용의 기준입니다.</span>
          </div>
        </Panel>
      </section>

      <section className={styles.dashboardMainGrid}>
        <UserTokenSummaryPanel userSummaries={userSummaries} />
        <UsersView userSummaries={userSummaries} />
        <Panel title="운영 주의 항목" label="Attention">
          <div className={styles.attentionGrid}>
            <div>
              <span>오류 기록</span>
              <strong>{dashboard.failed}건</strong>
              <small>오류가 있으면 토론 기록 관리에서 상세를 확인합니다.</small>
            </div>
            <div>
              <span>사용자 삭제 기록</span>
              <strong>{dashboard.deleted}건</strong>
              <small>사용자 화면에서는 숨겨져도 비용 계산에는 포함됩니다.</small>
            </div>
          </div>
        </Panel>
      </section>
    </>
  );
}

function StatusSummary({
  dashboard,
}: {
  dashboard: { total: number; completed: number; running: number; failed: number; paused: number };
}) {
  if (!dashboard.total) {
    return <DonutEmpty title="아직 데이터가 없습니다." description="토론 기록이 생성되면 상태 분포가 표시됩니다." />;
  }

  const completed = Math.max(0, Math.round((dashboard.completed / dashboard.total) * 100));
  const running = Math.max(0, Math.round((dashboard.running / dashboard.total) * 100));
  const failed = Math.max(0, Math.round((dashboard.failed / dashboard.total) * 100));
  const paused = Math.max(0, 100 - completed - running - failed);

  return (
    <div className={styles.statusSummary}>
      <div
        className={styles.statusDonut}
        style={{
          background: `conic-gradient(#3b72e7 0 ${completed}%, #7aa7ff ${completed}% ${
            completed + running
          }%, #e45454 ${completed + running}% ${completed + running + failed}%, #c8d0dd ${
            completed + running + failed
          }% 100%)`,
        }}
        aria-label={`완료 ${dashboard.completed}건, 진행중 ${dashboard.running}건, 오류 ${dashboard.failed}건, 대기 ${dashboard.paused}건`}
      >
        <strong>{dashboard.total}</strong>
        <span>건</span>
      </div>
      <div className={styles.statusMetricGrid}>
        <span>완료 <strong>{dashboard.completed}</strong></span>
        <span>진행중 <strong>{dashboard.running}</strong></span>
        <span>오류 <strong>{dashboard.failed}</strong></span>
        <span>대기 <strong>{dashboard.paused}</strong></span>
      </div>
    </div>
  );
}

function ProviderCostSummary({ providerTotals }: { providerTotals: CostBreakdown[] }) {
  if (!providerTotals.length) {
    return <BarEmpty title="아직 데이터가 없습니다." description="비용 데이터가 쌓이면 모델별 요약이 표시됩니다." />;
  }

  const maxCost = Math.max(...providerTotals.map((item) => item.costUsd), 0.000001);

  return (
    <div className={styles.providerSummary}>
      {providerTotals.map((item) => (
        <div className={styles.providerBarRow} key={`${item.provider}-${item.model}`}>
          <div>
            <strong>{item.provider}</strong>
            <span>{formatNumber(item.totalTokens)} tokens</span>
          </div>
          <div className={styles.providerBarTrack}>
            <span style={{ width: `${Math.max(8, (item.costUsd / maxCost) * 100)}%` }} />
          </div>
          <em>{formatCost(item.costUsd)}</em>
        </div>
      ))}
    </div>
  );
}

function UserTokenSummaryPanel({ userSummaries }: { userSummaries: UserUsageSummary[] }) {
  return (
    <Panel title="사용자별 토큰/비용" label="User Tokens" count={`${userSummaries.length}명`}>
      <div className={styles.userTokenTable}>
        <div className={styles.userTokenHead}>
          <span>사용자</span>
          <span>토론 수</span>
          <span>추정 토큰</span>
          <span>추정 비용</span>
          <span>최근 입력일</span>
        </div>
        {userSummaries.map((user) => (
          <div className={styles.userTokenRow} key={user.ownerId}>
            <strong>{user.ownerId}</strong>
            <span>{user.topicCount}건</span>
            <span>{formatNumber(user.totalTokens)} tokens</span>
            <em>{formatCost(user.costUsd)}</em>
            <span>{user.dates[0] ?? "-"}</span>
          </div>
        ))}
        {!userSummaries.length ? (
          <TableEmptyRow
            columns={5}
            title="아직 사용자별 토큰 기록이 없습니다."
            description="토론 기록이 생성되면 사용자별 추정 토큰과 비용이 여기에 표시됩니다."
          />
        ) : null}
      </div>
    </Panel>
  );
}

function UsersView({ userSummaries }: { userSummaries: UserUsageSummary[] }) {
  return (
    <Panel title="사용자별 사용량" label="Users" count={`${userSummaries.length}명`}>
      <div className={styles.table}>
        <div className={styles.tableHead}>
          <span>사용자</span>
          <span>주제 수</span>
          <span>입력 일자</span>
          <span>제목</span>
          <span>추정 비용</span>
        </div>
        {userSummaries.map((user) => (
          <div className={styles.userGroup} key={user.ownerId}>
            <div className={styles.tableRow}>
              <strong>{user.ownerId}</strong>
              <span>{user.topicCount}건</span>
              <span>{user.dates.join(", ") || "-"}</span>
              <span className={styles.muted}>본문 내용 미표시</span>
              <em>{formatCost(user.costUsd)}</em>
            </div>
            <div className={styles.titleList}>
              {user.records.slice(0, PAGE_SIZE).map(({ decision, costUsd }) => (
                <span key={decision.id}>
                  {decision.title || "제목 없는 토론"} · {formatDecisionDate(decision.createdAt)} ·{" "}
                  {recordStatusLabel(decision)} · {formatCost(costUsd)}
                </span>
              ))}
              {user.records.length > PAGE_SIZE ? <span>외 {user.records.length - PAGE_SIZE}건</span> : null}
            </div>
          </div>
        ))}
        {!userSummaries.length ? (
          <TableEmptyRow
            columns={5}
            title="아직 사용자별 사용량 기록이 없습니다."
            description="토론이 생성되면 사용자, 주제 수, 입력 일자, 제목, 추정 비용이 이 테이블에 표시됩니다."
          />
        ) : null}
      </div>
    </Panel>
  );
}

function CostsView({
  dashboard,
  providerTotals,
  usageSummaries,
  compact = false,
}: {
  dashboard: { totalTokens: number; totalCost: number };
  providerTotals: CostBreakdown[];
  usageSummaries: DecisionUsageSummary[];
  compact?: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageInfo = getPageInfo(usageSummaries.length, page);
  const pagedUsage = usageSummaries.slice(pageInfo.start, pageInfo.end);

  useEffect(() => {
    setPage(1);
  }, [usageSummaries.length]);

  return (
    <section className={compact ? styles.embeddedPanel : styles.twoColumn}>
      <Panel title="토큰/비용 분석" label="Analysis">
        <div className={styles.analysisNotice}>기존 기록은 실제 토큰 데이터가 없어 추정치로 표시됩니다.</div>
        <div className={styles.costHero}>
          <div>
            <span>전체 추정 토큰</span>
            <strong>{formatNumber(dashboard.totalTokens)}</strong>
          </div>
          <div>
            <span>전체 추정 비용</span>
            <strong>{formatCost(dashboard.totalCost)}</strong>
          </div>
        </div>
        <p className={styles.helperText}>
          기존 기록은 글자 수와 토론 응답 길이를 기준으로 추정합니다. 실제 usage가 저장되는 기록은 같은 화면에서 실제값으로
          확장할 수 있습니다.
        </p>
      </Panel>

      <UserTokenSummaryPanel userSummaries={buildUserSummaries(usageSummaries)} />

      <Panel title="모델별 합계" label="Models">
        <div className={styles.compactRows}>
          {providerTotals.map((item) => (
            <div className={styles.compactRow} key={`${item.provider}-${item.model}`}>
              <span className={styles.iconChip}>{item.provider.slice(0, 1)}</span>
              <div>
                <strong>{item.provider}</strong>
                <small>
                  입력 {formatNumber(item.inputTokens)} · 출력 {formatNumber(item.outputTokens)}
                </small>
              </div>
              <em>{formatCost(item.costUsd)}</em>
            </div>
          ))}
          {!providerTotals.length ? (
            <DecorativeEmptyState
              title="아직 모델별 비용 합계가 없습니다."
              description="OpenAI, Claude, Gemini 사용량이 저장되면 비용 합계가 자동으로 계산됩니다."
            />
          ) : null}
        </div>
      </Panel>

      <Panel title="기록별 비용" label="Records" wide>
        <div className={styles.costTableHead}>
          <span>기록</span>
          <span>사용자</span>
          <span>토큰</span>
          <span>비용</span>
        </div>
        <div className={styles.recordCostGrid}>
          {pagedUsage.map((item) => (
            <article className={styles.costCard} key={item.decision.id}>
              <div>
                <span className={styles.estimateBadge}>{item.estimated ? "추정" : "실제"}</span>
                <strong>{item.decision.title || "제목 없는 토론"}</strong>
                <small>{ownerLabel(item.decision.ownerId)} · {formatDecisionDate(item.decision.createdAt)}</small>
              </div>
              <dl>
                <div>
                  <dt>토큰</dt>
                  <dd>{formatNumber(item.totalTokens)}</dd>
                </div>
                <div>
                  <dt>비용</dt>
                  <dd>{formatCost(item.costUsd)}</dd>
                </div>
              </dl>
            </article>
          ))}
          {!usageSummaries.length ? (
            <DecorativeEmptyState
              title="분석할 토론 기록이 없습니다."
              description="기록별 추정 토큰과 비용은 토론이 저장된 뒤 이 표에 나타납니다."
            />
          ) : null}
        </div>
        <PaginationControls total={usageSummaries.length} page={pageInfo.page} totalPages={pageInfo.totalPages} onPageChange={setPage} />
      </Panel>
    </section>
  );
}

function RecordsView({
  filteredUsage,
  selectedUsage,
  onSelect,
  onStatusChange,
  onDelete,
  readOnly = false,
}: {
  filteredUsage: DecisionUsageSummary[];
  selectedUsage: DecisionUsageSummary | null;
  onSelect: (id: string) => void;
  onStatusChange: (decision: DecisionRecord, status: DecisionStatus) => void;
  onDelete: (decision: DecisionRecord) => void;
  readOnly?: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageInfo = getPageInfo(filteredUsage.length, page);
  const pagedUsage = filteredUsage.slice(pageInfo.start, pageInfo.end);

  useEffect(() => {
    setPage(1);
  }, [filteredUsage.length]);

  useEffect(() => {
    if (!pagedUsage.length) {
      return;
    }

    const selectedOnPage = pagedUsage.some((usage) => usage.decision.id === selectedUsage?.decision.id);
    if (!selectedOnPage) {
      onSelect(pagedUsage[0].decision.id);
    }
  }, [onSelect, pagedUsage, selectedUsage?.decision.id]);

  return (
    <section className={readOnly ? styles.embeddedPanel : styles.recordsLayout}>
      <Panel title="토론 기록 관리" label="Manage" count={`${filteredUsage.length}건`}>
        <p className={styles.sectionHint}>목록을 선택하면 오른쪽 상세가 바뀝니다. 상태는 상세 영역에서 확인하고 변경합니다.</p>

        <div className={styles.recordList}>
          {pagedUsage.map(({ decision, costUsd, totalTokens }) => (
            <article
              className={`${styles.recordItem} ${selectedUsage?.decision.id === decision.id ? styles.recordItemActive : ""}`}
              key={decision.id}
              onClick={() => onSelect(decision.id)}
            >
              <button type="button" onClick={() => onSelect(decision.id)}>
                <span className={`${styles.statusBadge} ${styles[decision.deletedAt ? "deleted" : decision.status]}`}>
                  {recordStatusLabel(decision)}
                </span>
                <strong>{decision.title || "제목 없는 토론"}</strong>
                <small>
                  {ownerLabel(decision.ownerId)} · {formatDecisionDate(decision.updatedAt)} · {formatNumber(totalTokens)} tokens ·{" "}
                  {formatCost(costUsd)}
                </small>
              </button>

              {!readOnly ? (
                <div className={styles.recordActions}>
                  <select
                    value={decision.status}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => onStatusChange(decision, event.target.value as DecisionStatus)}
                    aria-label="토론 상태 변경"
                  >
                    <option value="running">토론 중</option>
                    <option value="completed">완료</option>
                    <option value="failed">오류</option>
                    <option value="paused">중단</option>
                  </select>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(decision);
                    }}
                    aria-label="토론 기록 삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {!filteredUsage.length ? (
            <DecorativeEmptyState
              title="조건에 맞는 토론 기록이 없습니다."
              description="검색어나 상태 필터를 바꾸거나, 새 토론이 생성되면 이곳에 기록이 표시됩니다."
            />
          ) : null}
        </div>
        <PaginationControls total={filteredUsage.length} page={pageInfo.page} totalPages={pageInfo.totalPages} onPageChange={setPage} />
      </Panel>

      <Panel title="선택 기록 상세" label="Detail">
        {selectedUsage ? (
          <div className={styles.detailBox}>
            <span className={`${styles.statusBadge} ${styles[selectedUsage.decision.deletedAt ? "deleted" : selectedUsage.decision.status]}`}>
              {recordStatusLabel(selectedUsage.decision)}
            </span>
            <h3>{selectedUsage.decision.title || "제목 없는 토론"}</h3>
            <dl>
              <div>
                <dt>사용자</dt>
                <dd>{ownerLabel(selectedUsage.decision.ownerId)}</dd>
              </div>
              <div>
                <dt>입력 일자</dt>
                <dd>{formatDecisionDate(selectedUsage.decision.createdAt)}</dd>
              </div>
              <div>
                <dt>주제</dt>
                <dd>{getTopicLabel(selectedUsage.decision.topicType)}</dd>
              </div>
              <div>
                <dt>본문</dt>
                <dd>관리자 화면 정책상 표시하지 않음</dd>
              </div>
              <div>
                <dt>삭제 상태</dt>
                <dd>
                  {selectedUsage.decision.deletedAt
                    ? `사용자 화면에서 삭제됨 · ${formatDecisionDate(selectedUsage.decision.deletedAt)}`
                    : "사용자 화면에 표시 중"}
                </dd>
              </div>
              <div>
                <dt>토큰/비용</dt>
                <dd>
                  {formatNumber(selectedUsage.totalTokens)} tokens · {formatCost(selectedUsage.costUsd)}
                </dd>
              </div>
            </dl>
            <h4>최종 결론</h4>
            <p>
              {selectedUsage.decision.finalReport
                ? `${selectedUsage.decision.finalReport.recommendation} · ${selectedUsage.decision.finalReport.summary}`
                : "아직 최종 결론이 없습니다."}
            </p>
            {selectedUsage.decision.error ? (
              <div className={styles.errorBox}>
                <strong>오류 내용</strong>
                <span>{selectedUsage.decision.error}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <DecorativeEmptyState
            title="상세 확인할 기록을 선택해 주세요."
            description="토론 기록을 선택하면 제목, 사용자, 입력 일자, 상태, 비용 정보가 표시됩니다."
          />
        )}
      </Panel>
    </section>
  );
}

function PricingView({
  pricing,
  onPricingChange,
  onReset,
  compact = false,
}: {
  pricing: PricingConfig;
  onPricingChange: (providerKey: keyof PricingConfig, field: keyof PricingConfig[keyof PricingConfig], value: string) => void;
  onReset: () => void;
  compact?: boolean;
}) {
  return (
    <Panel title="요금 계산 설정" label="Pricing" wide={!compact}>
      <div className={styles.pricingIntro}>
        <Settings size={18} />
        <p>AI 업체 단가는 달러로 입력하고, 어드민 비용은 원화로 환산해 보여줍니다. 지금 바꾼 단가는 이 PC의 어드민 화면에 저장되는 운영 참고용 설정입니다.</p>
        <button type="button" onClick={onReset}>기본값 복원</button>
      </div>

      <div className={styles.pricingGrid}>
        {(Object.keys(pricing) as Array<keyof PricingConfig>).map((key) => (
          <article className={styles.pricingCard} key={key}>
            <h3>{pricing[key].provider}</h3>
            <label>
              <span>모델명</span>
              <input value={pricing[key].model} onChange={(event) => onPricingChange(key, "model", event.target.value)} />
            </label>
            <label>
              <span>입력 100만 토큰당 달러</span>
              <input
                inputMode="decimal"
                min="0"
                type="text"
                value={pricing[key].inputUsdPerMillion}
                onChange={(event) => onPricingChange(key, "inputUsdPerMillion", event.target.value)}
              />
            </label>
            <label>
              <span>출력 100만 토큰당 달러</span>
              <input
                inputMode="decimal"
                min="0"
                type="text"
                value={pricing[key].outputUsdPerMillion}
                onChange={(event) => onPricingChange(key, "outputUsdPerMillion", event.target.value)}
              />
            </label>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  label,
  count,
  wide = false,
  className = "",
  children,
}: {
  title: string;
  label: string;
  count?: string;
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${styles.panel} ${wide ? styles.panelWide : ""} ${className}`}>
      {title || label || count ? (
        <div className={styles.panelHead}>
          <div>
            {label ? <p>{label}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {count ? <span>{count}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
  tone?: "neutral" | "blue" | "green" | "red" | "yellow";
}) {
  return (
    <article className={`${styles.statCard} ${styles[tone]}`}>
      <div>{icon}</div>
      <section>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </section>
    </article>
  );
}

function DonutEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.donutEmpty}>
      <div className={styles.donutShape} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function BarEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.barEmpty}>
      <div className={styles.barShape}>
        <span />
        <span />
        <span />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function DecorativeEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.emptyState}>
      <CalendarDays size={20} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function TableEmptyRow({
  columns,
  title,
  description,
}: {
  columns: number;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.tableEmptyRow} style={{ gridColumn: `1 / span ${columns}` }}>
      <DecorativeEmptyState title={title} description={description} />
    </div>
  );
}

function PaginationControls({
  total,
  page,
  totalPages,
  onPageChange,
}: {
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) {
    return total ? <div className={styles.paginationMeta}>전체 {total}건</div> : null;
  }

  return (
    <div className={styles.pagination}>
      <span>
        전체 {total}건 · {page}/{totalPages}페이지
      </span>
      <div>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          이전
        </button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button
            className={pageNumber === page ? styles.paginationActive : ""}
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          다음
        </button>
      </div>
    </div>
  );
}

function getPageInfo(total: number, requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  return {
    page,
    totalPages,
    start,
    end: start + PAGE_SIZE,
  };
}

function buildUsageSummary(decision: DecisionRecord, pricing: PricingConfig): DecisionUsageSummary {
  if (decision.usage?.modelCosts?.length) {
    const modelCosts = decision.usage.modelCosts.map((item) => ({
      provider: item.provider,
      model: item.model,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      totalTokens: item.inputTokens + item.outputTokens,
      costUsd: item.costUsd,
    }));
    const inputTokens = modelCosts.reduce((sum, item) => sum + item.inputTokens, 0);
    const outputTokens = modelCosts.reduce((sum, item) => sum + item.outputTokens, 0);
    return {
      decision,
      inputTokens,
      outputTokens,
      totalTokens: decision.usage.totalTokens ?? inputTokens + outputTokens,
      costUsd: modelCosts.reduce((sum, item) => sum + item.costUsd, 0),
      estimated: decision.usage.estimated ?? false,
      modelCosts,
    };
  }

  const inputTokens = estimateTokens([decision.title, decision.content, decision.options, decision.risks].join("\n"));
  const outputByProvider = {
    openai: 0,
    claude: 0,
    gemini: 0,
  };

  for (const event of decision.events) {
    if (event.type !== "turn") {
      continue;
    }

    const tokens = estimateTokens(event.message);

    if (event.speaker === "claude") {
      outputByProvider.claude += tokens;
    } else if (event.speaker === "gemini") {
      outputByProvider.gemini += tokens;
    } else {
      outputByProvider.openai += tokens;
    }
  }

  if (decision.finalReport) {
    outputByProvider.gemini += estimateTokens(
      [
        decision.finalReport.summary,
        decision.finalReport.keyReasons.join(" "),
        decision.finalReport.keyRisks.join(" "),
        decision.finalReport.conditions.join(" "),
        decision.finalReport.nextActions.join(" "),
      ].join("\n"),
    );
  }

  const providerKeys = Object.keys(outputByProvider) as Array<keyof PricingConfig>;
  const modelCosts = providerKeys.map((key) => {
    const providerInput = Math.max(1, Math.round(inputTokens / providerKeys.length));
    const providerOutput = outputByProvider[key];
    const config = pricing[key];
    const costUsd =
      (providerInput / 1_000_000) * config.inputUsdPerMillion +
      (providerOutput / 1_000_000) * config.outputUsdPerMillion;

    return {
      provider: config.provider,
      model: config.model,
      inputTokens: providerInput,
      outputTokens: providerOutput,
      totalTokens: providerInput + providerOutput,
      costUsd,
    };
  });
  const outputTokens = modelCosts.reduce((sum, item) => sum + item.outputTokens, 0);

  return {
    decision,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: modelCosts.reduce((sum, item) => sum + item.costUsd, 0),
    estimated: true,
    modelCosts,
  };
}

function buildUserSummaries(usageSummaries: DecisionUsageSummary[]): UserUsageSummary[] {
  const users = new Map<string, UserUsageSummary>();

  for (const usage of usageSummaries) {
    const ownerId = ownerLabel(usage.decision.ownerId);
    const current =
      users.get(ownerId) ??
      ({
        ownerId,
        topicCount: 0,
        dates: [],
        totalTokens: 0,
        costUsd: 0,
        records: [],
      } satisfies UserUsageSummary);

    const date = formatShortDate(usage.decision.createdAt);
    current.topicCount += 1;
    current.totalTokens += usage.totalTokens;
    current.costUsd += usage.costUsd;
    current.records.push(usage);

    if (date && !current.dates.includes(date)) {
      current.dates.push(date);
    }

    users.set(ownerId, current);
  }

  return Array.from(users.values()).sort((a, b) => b.topicCount - a.topicCount);
}

function estimateTokens(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  const koreanChars = normalized.match(/[가-힣]/g)?.length ?? 0;
  const otherChars = Math.max(0, normalized.length - koreanChars);
  return Math.max(1, Math.ceil(koreanChars / 1.7 + otherChars / 4));
}

function readPricingConfig(): PricingConfig {
  if (typeof window === "undefined") {
    return defaultPricing;
  }

  try {
    const raw = window.localStorage.getItem(PRICING_STORAGE_KEY);
    if (!raw) return defaultPricing;
    const parsed = JSON.parse(raw) as Partial<PricingConfig>;
    return {
      openai: { ...defaultPricing.openai, ...parsed.openai },
      claude: { ...defaultPricing.claude, ...parsed.claude },
      gemini: { ...defaultPricing.gemini, ...parsed.gemini },
    };
  } catch {
    return defaultPricing;
  }
}

function savePricingConfig(config: PricingConfig) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(config));
}

function ownerLabel(ownerId?: string | null) {
  return ownerId?.trim() || "공용 기록";
}

function isInPeriod(value: string, period: PeriodFilter) {
  if (period === "all") {
    return true;
  }

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const now = new Date();

  if (period === "today") {
    return (
      createdAt.getFullYear() === now.getFullYear() &&
      createdAt.getMonth() === now.getMonth() &&
      createdAt.getDate() === now.getDate()
    );
  }

  const days = period === "7d" ? 7 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return createdAt >= start;
}

function recordStatusLabel(decision: DecisionRecord) {
  return decision.deletedAt ? "사용자 삭제됨" : statusLabels[decision.status];
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

function formatCost(valueUsd: number) {
  const krw = Math.round(valueUsd * USD_TO_KRW);
  const usd = valueUsd.toFixed(valueUsd < 1 ? 4 : 2);
  return `₩${new Intl.NumberFormat("ko-KR").format(krw)} ($${usd})`;
}


