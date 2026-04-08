"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
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
  ArrowUpRight,
  Users,
  PieChart,
  Timer,
  Repeat,
  Building2,
  UserPlus,
  Filter,
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

interface OwnerRetentionData {
  rate: number;
  cancellationsLast30Days: number;
  totalOwners: number;
}

interface MaintenanceCostData {
  rate: number;
  maintenanceDollars: number;
  grossRentDollars: number;
}

interface DaysToLeaseData {
  avgDays: number;
  fastest: number;
  slowest: number;
  unitsLeased: number;
}

interface LeaseRenewalData {
  rate: number;
  renewals: number;
  moveOuts: number;
}

interface NetDoorsData {
  currentDoors: number;
  currentProperties: number;
  netThisMonth: number;
}

interface GuestCardData {
  today: number;
  thisWeek: number;
  thisMonth: number;
  lastWeek: number;
  lastMonth: number;
  weekOverWeekDelta: number;
  monthOverMonthDelta: number;
  sourceBreakdownWeek: Array<{ source: string; count: number }>;
  sourceBreakdownMonth: Array<{ source: string; count: number }>;
}

interface LeasingFunnelData {
  period: string;
  funnel: {
    guestCards: number;
    applications: number;
    approvals: number;
    moveIns: number;
  };
  conversionRates: {
    guestCardToApplication: number;
    applicationToApproval: number;
    approvalToMoveIn: number;
    overallConversion: number;
  };
  avgDaysLeadToLease: number;
  timeToFirstContact: {
    avgHoursToFirstContact: number | null;
    pctContactedUnder1Hour: number | null;
    pctContactedUnder24Hours: number | null;
    pctNeverContacted: number | null;
    dataSource: string;
  };
}

type KpiData = DelinquencyData | VacancyData | WorkOrderData | NoticeData | InsuranceData
  | OwnerRetentionData | MaintenanceCostData | DaysToLeaseData | LeaseRenewalData | NetDoorsData
  | GuestCardData | LeasingFunnelData;

interface KpiState<T extends KpiData> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

type DeltaDirection = "up" | "down" | "flat";
type DeltaSentiment = "good" | "bad" | "neutral";

interface SparklinePoint {
  value: number;
}

interface KpiCardConfig {
  name: string;
  key: string;
  endpoint: string;
  icon: typeof DollarSign;
  color: string;
  bgColor: string;
  iconColor: string;
  sparkColor: string;
  sparkFill: string;
  dataTag: "live" | "mock" | "estimated";
  formatPrimary: (data: KpiData) => string;
  formatSecondary: (data: KpiData) => string;
  getSparklineValue: (snapshot: Record<string, unknown>) => number;
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
    sparkColor: "#dc2626",
    sparkFill: "#fecaca",
    dataTag: "live",
    formatPrimary: (d) => `${(d as DelinquencyData).rate}%`,
    formatSecondary: (d) => {
      const data = d as DelinquencyData;
      return `${data.count} occupancies | $${data.totalDollars.toLocaleString()} outstanding`;
    },
    getSparklineValue: (s) => (s.rate as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as DelinquencyData).rate;
      const prev = (prior as { rate?: number }).rate;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
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
    sparkColor: "#d97706",
    sparkFill: "#fde68a",
    dataTag: "live",
    formatPrimary: (d) => `${(d as VacancyData).rate}%`,
    formatSecondary: (d) => {
      const data = d as VacancyData;
      return `${data.vacantCount} vacant of ${data.totalUnits} units`;
    },
    getSparklineValue: (s) => (s.rate as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as VacancyData).rate;
      const prev = (prior as { rate?: number }).rate;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
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
    sparkColor: "#2563eb",
    sparkFill: "#bfdbfe",
    dataTag: "live",
    formatPrimary: (d) => `${(d as WorkOrderData).avgDaysToClose} days`,
    formatSecondary: (d) => `${(d as WorkOrderData).openCount} open work orders`,
    getSparklineValue: (s) => (s.avgDaysToClose as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as WorkOrderData).avgDaysToClose;
      const prev = (prior as { avgDaysToClose?: number }).avgDaysToClose;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.5) return { direction: "flat", sentiment: "neutral", label: "No change" };
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
    sparkColor: "#9333ea",
    sparkFill: "#e9d5ff",
    dataTag: "live",
    formatPrimary: (d) => `${(d as NoticeData).thisWeek}`,
    formatSecondary: (d) => `${(d as NoticeData).last30Days} in last 30 days`,
    getSparklineValue: (s) => (s.last30Days as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as NoticeData).last30Days;
      const prev = (prior as { last30Days?: number }).last30Days;
      if (prev == null) return null;
      const diff = curr - prev;
      if (diff === 0) return { direction: "flat", sentiment: "neutral", label: "No change" };
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
    sparkColor: "#16a34a",
    sparkFill: "#bbf7d0",
    dataTag: "mock",
    formatPrimary: (d) => `${(d as InsuranceData).rate}%`,
    formatSecondary: (d) => {
      const data = d as InsuranceData;
      return `${data.compliantCount} of ${data.totalCount} compliant`;
    },
    getSparklineValue: (s) => (s.rate as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as InsuranceData).rate;
      const prev = (prior as { rate?: number }).rate;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "good" : "bad",
        label: `${Math.abs(diff).toFixed(1)}pp`,
      };
    },
  },
  {
    name: "Owner Retention",
    key: "owner_retention",
    endpoint: "/api/kpi/owner-retention",
    icon: Users,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
    iconColor: "text-indigo-600",
    sparkColor: "#4f46e5",
    sparkFill: "#c7d2fe",
    dataTag: "live",
    formatPrimary: (d) => `${(d as OwnerRetentionData).rate}%`,
    formatSecondary: (d) => {
      const data = d as OwnerRetentionData;
      return `${data.cancellationsLast30Days} cancellations (30d) | ${data.totalOwners} owners`;
    },
    getSparklineValue: (s) => (s.rate as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as OwnerRetentionData).rate;
      const prev = (prior as { rate?: number }).rate;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "good" : "bad",
        label: `${Math.abs(diff).toFixed(1)}pp`,
      };
    },
  },
  {
    name: "Maintenance Cost %",
    key: "maintenance_cost",
    endpoint: "/api/kpi/maintenance-cost",
    icon: PieChart,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    iconColor: "text-orange-600",
    sparkColor: "#ea580c",
    sparkFill: "#fed7aa",
    dataTag: "estimated",
    formatPrimary: (d) => `${(d as MaintenanceCostData).rate}%`,
    formatSecondary: (d) => {
      const data = d as MaintenanceCostData;
      return `$${data.maintenanceDollars.toLocaleString()} of $${data.grossRentDollars.toLocaleString()} rent roll`;
    },
    getSparklineValue: (s) => (s.rate as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as MaintenanceCostData).rate;
      const prev = (prior as { rate?: number }).rate;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "bad" : "good",
        label: `${Math.abs(diff).toFixed(1)}pp`,
      };
    },
  },
  {
    name: "Avg Days to Lease",
    key: "days_to_lease",
    endpoint: "/api/kpi/days-to-lease",
    icon: Timer,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
    iconColor: "text-cyan-600",
    sparkColor: "#0891b2",
    sparkFill: "#a5f3fc",
    dataTag: "mock",
    formatPrimary: (d) => `${(d as DaysToLeaseData).avgDays} days`,
    formatSecondary: (d) => {
      const data = d as DaysToLeaseData;
      return `${data.unitsLeased} leased | fastest ${data.fastest}d, slowest ${data.slowest}d`;
    },
    getSparklineValue: (s) => (s.avgDays as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as DaysToLeaseData).avgDays;
      const prev = (prior as { avgDays?: number }).avgDays;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.5) return { direction: "flat", sentiment: "neutral", label: "No change" };
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "bad" : "good",
        label: `${Math.abs(diff).toFixed(1)} days`,
      };
    },
  },
  {
    name: "Lease Renewal Rate",
    key: "lease_renewal",
    endpoint: "/api/kpi/lease-renewal",
    icon: Repeat,
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    iconColor: "text-teal-600",
    sparkColor: "#0d9488",
    sparkFill: "#99f6e4",
    dataTag: "live",
    formatPrimary: (d) => `${(d as LeaseRenewalData).rate}%`,
    formatSecondary: (d) => {
      const data = d as LeaseRenewalData;
      return `${data.renewals} renewals | ${data.moveOuts} move-outs`;
    },
    getSparklineValue: (s) => (s.rate as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as LeaseRenewalData).rate;
      const prev = (prior as { rate?: number }).rate;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "good" : "bad",
        label: `${Math.abs(diff).toFixed(1)}pp`,
      };
    },
  },
  {
    name: "Properties / Doors",
    key: "net_doors",
    endpoint: "/api/kpi/net-doors",
    icon: Building2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    iconColor: "text-emerald-600",
    sparkColor: "#059669",
    sparkFill: "#a7f3d0",
    dataTag: "live",
    formatPrimary: (d) => {
      const data = d as NetDoorsData;
      return `${data.currentProperties} / ${data.currentDoors}`;
    },
    formatSecondary: (d) => {
      const data = d as NetDoorsData;
      const net = data.netThisMonth;
      const sign = net >= 0 ? "+" : "";
      return `${sign}${net} this month | Goal: 1,500 doors`;
    },
    getSparklineValue: (s) => (s.currentDoors as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as NetDoorsData).currentDoors;
      const prev = (prior as { currentDoors?: number }).currentDoors;
      if (prev == null) return null;
      const diff = curr - prev;
      if (diff === 0) return { direction: "flat", sentiment: "neutral", label: "No change" };
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "good" : "bad",
        label: `${Math.abs(diff)} doors`,
      };
    },
  },
  {
    name: "Guest Card Volume",
    key: "guest_cards",
    endpoint: "/api/kpi/guest-cards",
    icon: UserPlus,
    color: "text-sky-600",
    bgColor: "bg-sky-100",
    iconColor: "text-sky-600",
    sparkColor: "#0284c7",
    sparkFill: "#bae6fd",
    dataTag: "live",
    formatPrimary: (d) => `${(d as GuestCardData).thisWeek}`,
    formatSecondary: (d) => {
      const data = d as GuestCardData;
      const delta = data.weekOverWeekDelta;
      const sign = delta >= 0 ? "+" : "";
      const top3 = data.sourceBreakdownWeek.slice(0, 3).map((s) => `${s.source}: ${s.count}`).join("  |  ");
      return `Today: ${data.today}  |  Month: ${data.thisMonth}  |  ${sign}${delta} vs last week${top3 ? `\n${top3}` : ""}`;
    },
    getSparklineValue: (s) => (s.thisWeek as number) ?? 0,
    getDelta: (current, prior) => {
      const curr = (current as GuestCardData).thisWeek;
      const prev = (prior as { thisWeek?: number }).thisWeek;
      if (prev == null) return null;
      const diff = curr - prev;
      if (diff === 0) return { direction: "flat", sentiment: "neutral", label: "No change" };
      return {
        direction: diff > 0 ? "up" : "down",
        sentiment: diff > 0 ? "good" : "bad",
        label: `${Math.abs(diff)} leads`,
      };
    },
  },
  {
    name: "Leasing Funnel",
    key: "leasing_funnel",
    endpoint: "/api/kpi/leasing-funnel",
    icon: Filter,
    color: "text-rose-600",
    bgColor: "bg-rose-100",
    iconColor: "text-rose-600",
    sparkColor: "#e11d48",
    sparkFill: "#fecdd3",
    dataTag: "live",
    formatPrimary: (d) => `${(d as LeasingFunnelData).conversionRates.overallConversion}%`,
    formatSecondary: (d) => {
      const data = d as LeasingFunnelData;
      const f = data.funnel;
      const contact = data.timeToFirstContact;
      const responseLine = contact.dataSource !== "unavailable" && contact.avgHoursToFirstContact != null
        ? `Avg response: ${contact.avgHoursToFirstContact.toFixed(0)}h  |  ${contact.pctContactedUnder1Hour?.toFixed(0)}% <1hr`
        : "Response time: data pending";
      return `${f.guestCards} leads → ${f.applications} apps → ${f.approvals} approved → ${f.moveIns} move-ins\n${responseLine}`;
    },
    getSparklineValue: (s) => {
      const rates = s.conversionRates as Record<string, number> | undefined;
      return rates?.overallConversion ?? 0;
    },
    getDelta: (current, prior) => {
      const curr = (current as LeasingFunnelData).conversionRates.overallConversion;
      const priorRates = (prior as { conversionRates?: { overallConversion?: number } }).conversionRates;
      const prev = priorRates?.overallConversion;
      if (prev == null) return null;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.1) return { direction: "flat", sentiment: "neutral", label: "No change" };
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
      <div className="w-40 h-4 bg-sand-100 rounded mb-4" />
      <div className="h-10 bg-sand-50 rounded" />
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

function Sparkline({
  data,
  color,
  fill,
}: {
  data: SparklinePoint[];
  color: string;
  fill: string;
}) {
  if (data.length < 2) return null;

  return (
    <div className="mt-3 -mx-1">
      <ResponsiveContainer width="100%" height={40}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={fill}
            fillOpacity={0.3}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({
  config,
  state,
  priorSnapshot,
  sparklineData,
}: {
  config: KpiCardConfig;
  state: KpiState<KpiData>;
  priorSnapshot: Record<string, unknown> | undefined;
  sparklineData: SparklinePoint[];
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
    <Link
      href="/dashboard/trends"
      className="bg-white rounded-xl border border-sand-200 p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 block cursor-pointer"
    >
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
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-medium text-charcoal-900">{config.name}</h3>
        {config.dataTag !== "live" && (
          <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
            config.dataTag === "mock"
              ? "bg-charcoal-100 text-charcoal-400"
              : "bg-amber-100 text-amber-600"
          }`}>
            {config.dataTag === "mock" ? "Mock Data" : "Estimated"}
          </span>
        )}
      </div>
      <p className="text-xs text-charcoal-400">{config.formatSecondary(state.data)}</p>
      <Sparkline data={sparklineData} color={config.sparkColor} fill={config.sparkFill} />
    </Link>
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
  const [sparklines, setSparklines] = useState<Record<string, SparklinePoint[]>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAllKpis = useCallback(async () => {
    setRefreshing(true);

    setKpis((prev) => {
      const next = { ...prev };
      for (const card of KPI_CARDS) {
        next[card.key] = { ...next[card.key], loading: true, error: null };
      }
      return next;
    });

    // Fetch KPIs in batches of 3 to avoid AppFolio 429 rate limits.
    // Each KPI route may paginate through hundreds of API calls internally.
    const BATCH_SIZE = 3;
    const fetchCard = async (card: KpiCardConfig) => {
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
    };

    for (let i = 0; i < KPI_CARDS.length; i += BATCH_SIZE) {
      const batch = KPI_CARDS.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(fetchCard));
    }

    // Fetch prior snapshots for deltas
    try {
      const res = await fetch("/api/kpi/snapshots");
      if (res.ok) {
        const data = await res.json();
        setPriorSnapshots(data);
      }
    } catch {
      // Non-critical
    }

    // Fetch sparkline history
    try {
      const res = await fetch("/api/kpi/snapshots?history=14");
      if (res.ok) {
        const data: Record<string, Array<{ date: string; value: Record<string, unknown> }>> = await res.json();
        const sparkData: Record<string, SparklinePoint[]> = {};
        for (const card of KPI_CARDS) {
          const history = data[card.key] || [];
          sparkData[card.key] = history.map((h) => ({
            value: card.getSparklineValue(h.value),
          }));
        }
        setSparklines(sparkData);
      }
    } catch {
      // Non-critical
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
                Last updated{" "}
                {lastUpdated.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/Los_Angeles",
                })}{" "}
                PT
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/trends"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-terra-600 bg-terra-50 border border-terra-200 rounded-lg hover:bg-terra-100 transition-all duration-150 shadow-sm"
            >
              View Trends
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
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
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
        {KPI_CARDS.map((card) => (
          <KpiCard
            key={card.key}
            config={card}
            state={kpis[card.key]}
            priorSnapshot={priorSnapshots[card.key]}
            sparklineData={sparklines[card.key] || []}
          />
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-8 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="bg-white rounded-xl border border-sand-200 p-4 shadow-card">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-charcoal-300 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-charcoal-400 leading-relaxed">
              <strong className="text-charcoal-500">Data sources:</strong>{" "}
              Delinquency, Vacancy, Work Orders, Notices, and Net Doors pull live from AppFolio v0 API.
              Insurance, Owner Retention, Maintenance Cost, Days to Lease, and Lease Renewal show
              placeholder data pending API integration.
              Sparklines and trend charts populate as daily snapshots accumulate.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
