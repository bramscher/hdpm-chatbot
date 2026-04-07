"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  Home,
  Wrench,
  FileWarning,
  Shield,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
} from "lucide-react";

// ============================================
// Types
// ============================================

interface DelinquencyData {
  rate: number;
  totalDollars: number;
  count: number;
}

interface VacancyData {
  rate: number;
  vacantCount: number;
  totalUnits: number;
}

interface WorkOrderData {
  avgDaysToClose: number;
  openCount: number;
}

interface NoticeData {
  thisWeek: number;
  last30Days: number;
}

interface InsuranceData {
  rate: number;
  compliantCount: number;
  totalCount: number;
}

type KpiData = DelinquencyData | VacancyData | WorkOrderData | NoticeData | InsuranceData;

interface KpiState<T extends KpiData> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

type DeltaDirection = "up" | "down" | "flat";
type DeltaSentiment = "good" | "bad" | "neutral";

interface KpiCardConfig {
  name: string;
  key: string;
  endpoint: string;
  icon: typeof DollarSign;
  color: string;
  bgColor: string;
  iconColor: string;
  formatPrimary: (data: KpiData) => string;
  formatSecondary: (data: KpiData) => string;
  getDelta: (current: KpiData, prior: Record<string, unknown>) => { direction: DeltaDirection; sentiment: DeltaSentiment; label: string } | null;
}

// ============================================
// KPI Card Configurations
// ============================================

const KPI_CARDS: KpiCardConfig[] = [
  {
    name: "Delinquency Rate",
    key: "delinquency",
    endpoint: "/api/kpi/delinquency",
    icon: DollarSign,
    color: "text-red-600",
    bgColor: "bg-red-100",
    iconColor: "text-red-600",
    formatPrimary: (d) => `${(d as DelinquencyData).rate}%`,
    formatSecondary: (d) => {
      const data = d as DelinquencyData;
      return `${data.count} occupancies | $${data.totalDollars.toLocaleString()} outstanding`;
    },
    getDelta: (current, prior) => {
      const curr = (current as DelinquencyData).rate;
      const prev = (prior as { rate?: number }).rate;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
      // Lower is better
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "bad" : "good",
        label: `${Math.abs(diff).toFixed(1)}pp`,
      };
    },
  },
  {
    name: "Vacancy Rate",
    key: "vacancy",
    endpoint: "/api/kpi/vacancy",
    icon: Home,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    iconColor: "text-amber-600",
    formatPrimary: (d) => `${(d as VacancyData).rate}%`,
    formatSecondary: (d) => {
      const data = d as VacancyData;
      return `${data.vacantCount} vacant of ${data.totalUnits} units`;
    },
    getDelta: (current, prior) => {
      const curr = (current as VacancyData).rate;
      const prev = (prior as { rate?: number }).rate;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
      // Lower is better
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "bad" : "good",
        label: `${Math.abs(diff).toFixed(1)}pp`,
      };
    },
  },
  {
    name: "Work Order Cycle Time",
    key: "work_orders",
    endpoint: "/api/kpi/work-orders",
    icon: Wrench,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
    formatPrimary: (d) => `${(d as WorkOrderData).avgDaysToClose} days`,
    formatSecondary: (d) => `${(d as WorkOrderData).openCount} open work orders`,
    getDelta: (current, prior) => {
      const curr = (current as WorkOrderData).avgDaysToClose;
      const prev = (prior as { avgDaysToClose?: number }).avgDaysToClose;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.5) return { direction: "flat", sentiment: "neutral", label: "No change" };
      // Lower is better
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "bad" : "good",
        label: `${Math.abs(diff).toFixed(1)} days`,
      };
    },
  },
  {
    name: "30-Day Notice Volume",
    key: "notices",
    endpoint: "/api/kpi/notices",
    icon: FileWarning,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    iconColor: "text-purple-600",
    formatPrimary: (d) => `${(d as NoticeData).thisWeek}`,
    formatSecondary: (d) => `${(d as NoticeData).last30Days} in last 30 days`,
    getDelta: (current, prior) => {
      const curr = (current as NoticeData).last30Days;
      const prev = (prior as { last30Days?: number }).last30Days;
      if (prev == null) return null;
      const diff = curr - prev;
      if (diff === 0) return { direction: "flat", sentiment: "neutral", label: "No change" };
      // Neutral — no good/bad direction
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: "neutral",
        label: `${Math.abs(diff)}`,
      };
    },
  },
  {
    name: "Insurance Compliance",
    key: "insurance",
    endpoint: "/api/kpi/insurance",
    icon: Shield,
    color: "text-green-600",
    bgColor: "bg-green-100",
    iconColor: "text-green-600",
    formatPrimary: (d) => `${(d as InsuranceData).rate}%`,
    formatSecondary: (d) => {
      const data = d as InsuranceData;
      return `${data.compliantCount} of ${data.totalCount} compliant`;
    },
    getDelta: (current, prior) => {
      const curr = (current as InsuranceData).rate;
      const prev = (prior as { rate?: number }).rate;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
      // Higher is better
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "good" : "bad",
        label: `${Math.abs(diff).toFixed(1)}pp`,
      };
    },
  },
];

// ============================================
// Components
// ============================================

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-sand-200 p-6 shadow-card animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 bg-sand-100 rounded-xl" />
        <div className="w-16 h-4 bg-sand-100 rounded" />
      </div>
      <div className="w-24 h-8 bg-sand-100 rounded mb-2" />
      <div className="w-40 h-4 bg-sand-100 rounded" />
    </div>
  );
}

function DeltaArrow({
  direction,
  sentiment,
  label,
}: {
  direction: DeltaDirection;
  sentiment: DeltaSentiment;
  label: string;
}) {
  const colorMap = {
    good: "text-green-600",
    bad: "text-red-500",
    neutral: "text-charcoal-400",
  };

  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${colorMap[sentiment]}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

function KpiCard({
  config,
  state,
  priorSnapshot,
}: {
  config: KpiCardConfig;
  state: KpiState<KpiData>;
  priorSnapshot: Record<string, unknown> | undefined;
}) {
  const Icon = config.icon;

  if (state.loading) return <SkeletonCard />;

  if (state.error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 shadow-card">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-11 h-11 ${config.bgColor} rounded-xl flex items-center justify-center opacity-50`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <AlertCircle className="w-4 h-4 text-red-400" />
        </div>
        <h3 className="text-sm font-medium text-charcoal-500 mb-1">{config.name}</h3>
        <p className="text-xs text-red-400">{state.error}</p>
      </div>
    );
  }

  if (!state.data) return <SkeletonCard />;

  const delta = priorSnapshot ? config.getDelta(state.data, priorSnapshot) : null;

  return (
    <div className="bg-white rounded-xl border border-sand-200 p-6 shadow-card hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 ${config.bgColor} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>
        {delta && (
          <DeltaArrow
            direction={delta.direction}
            sentiment={delta.sentiment}
            label={delta.label}
          />
        )}
      </div>
      <p className={`text-2xl font-bold ${config.color} mb-1 tracking-tight`}>
        {config.formatPrimary(state.data)}
      </p>
      <h3 className="text-sm font-medium text-charcoal-900 mb-1">{config.name}</h3>
      <p className="text-xs text-charcoal-400">{config.formatSecondary(state.data)}</p>
    </div>
  );
}

// ============================================
// Page
// ============================================

export default function DashboardPage() {
  const [kpis, setKpis] = useState<Record<string, KpiState<KpiData>>>(() => {
    const initial: Record<string, KpiState<KpiData>> = {};
    for (const card of KPI_CARDS) {
      initial[card.key] = { data: null, loading: true, error: null };
    }
    return initial;
  });
  const [priorSnapshots, setPriorSnapshots] = useState<Record<string, Record<string, unknown>>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAllKpis = useCallback(async () => {
    setRefreshing(true);

    // Set all to loading
    setKpis((prev) => {
      const next = { ...prev };
      for (const card of KPI_CARDS) {
        next[card.key] = { ...next[card.key], loading: true, error: null };
      }
      return next;
    });

    // Fetch each KPI independently
    await Promise.allSettled(
      KPI_CARDS.map(async (card) => {
        try {
          const res = await fetch(card.endpoint);
          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          setKpis((prev) => ({
            ...prev,
            [card.key]: { data, loading: false, error: null },
          }));
        } catch (err) {
          setKpis((prev) => ({
            ...prev,
            [card.key]: {
              data: prev[card.key].data,
              loading: false,
              error: err instanceof Error ? err.message : "Unknown error",
            },
          }));
        }
      })
    );

    // Fetch prior snapshots for deltas
    try {
      const res = await fetch("/api/kpi/snapshots");
      if (res.ok) {
        const data = await res.json();
        setPriorSnapshots(data);
      }
    } catch {
      // Non-critical — deltas just won't show
    }

    setLastUpdated(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAllKpis();
  }, [fetchAllKpis]);

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-terra-500 uppercase tracking-widest mb-1">
              KPI Dashboard
            </p>
            <h1 className="text-2xl font-bold text-charcoal-900 tracking-tight">
              Weekly Metrics
            </h1>
            {lastUpdated && (
              <p className="text-xs text-charcoal-400 mt-1">
                Last updated {lastUpdated.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/Los_Angeles",
                })} PT
              </p>
            )}
          </div>
          <button
            onClick={fetchAllKpis}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-charcoal-600 bg-white border border-sand-200 rounded-lg hover:bg-sand-50 hover:border-sand-300 transition-all duration-150 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
        {KPI_CARDS.map((card) => (
          <KpiCard
            key={card.key}
            config={card}
            state={kpis[card.key]}
            priorSnapshot={priorSnapshots[card.key]}
          />
        ))}
      </div>

      {/* Footer note for mock data */}
      <div className="mt-8 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="bg-white rounded-xl border border-sand-200 p-4 shadow-card">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-charcoal-300 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-charcoal-400 leading-relaxed">
              <strong className="text-charcoal-500">Data sources:</strong>{" "}
              Delinquency, Vacancy, Work Orders, and Notices pull live from AppFolio v0 API.
              Insurance Compliance shows placeholder data — the v0 API does not expose insurance status.
              Week-over-week deltas appear once snapshot history accumulates.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
