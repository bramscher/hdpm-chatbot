"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  ArrowLeft,
  DollarSign,
  Home,
  Wrench,
  FileWarning,
  Shield,
  RefreshCw,
} from "lucide-react";

// Recharts v3 tooltip formatter types are overly strict — cast like CompsChart.tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormatter = any;

// ============================================
// Types
// ============================================

interface TrendPoint {
  date: string;
  value: Record<string, number>;
}

type DateRange = "4w" | "8w" | "12w" | "6m";

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "4w", label: "4 Weeks" },
  { value: "8w", label: "8 Weeks" },
  { value: "12w", label: "12 Weeks" },
  { value: "6m", label: "6 Months" },
];

// ============================================
// Shared chart styling (matches CompsChart.tsx)
// ============================================

const GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: "rgba(0,0,0,0.05)",
  vertical: false as const,
};

const X_TICK = { fontSize: 12, fill: "#6b7280" };
const Y_TICK = { fontSize: 11, fill: "#9ca3af" };

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "12px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  fontSize: "12px",
};

const LABEL_STYLE = { fontWeight: 600, color: "#111827" };

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================
// Stat Pills
// ============================================

function StatPills({ stats }: { stats: Array<{ label: string; value: string }> }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="px-2.5 py-1 rounded-lg bg-sand-50 border border-sand-200 text-xs"
        >
          <span className="text-charcoal-400">{s.label}</span>{" "}
          <span className="font-semibold text-charcoal-700">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function computeStats(values: number[]): { current: number; high: number; low: number; avg: number } {
  if (values.length === 0) return { current: 0, high: 0, low: 0, avg: 0 };
  const current = values[values.length - 1];
  const high = Math.max(...values);
  const low = Math.min(...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return { current, high, low, avg };
}

// ============================================
// Chart Components
// ============================================

function ChartSkeleton() {
  return (
    <div className="glass glass-shine rounded-2xl p-6 animate-pulse">
      <div className="h-4 w-40 bg-charcoal-200 rounded mb-6" />
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 w-20 bg-sand-100 rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-charcoal-100 rounded-xl" />
    </div>
  );
}

function EmptyChart({ name }: { name: string }) {
  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <h4 className="text-sm font-semibold text-charcoal-700 mb-4">{name}</h4>
      <p className="text-center text-charcoal-400 text-sm py-16">
        No historical data yet. Snapshots accumulate daily via cron.
      </p>
    </div>
  );
}

function DelinquencyChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="Delinquency Rate" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    rate: d.value.rate ?? 0,
    dollars: d.value.totalDollars ?? 0,
  }));

  const rates = chartData.map((d) => d.rate);
  const stats = computeStats(rates);

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
          <DollarSign className="w-4 h-4 text-red-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">Delinquency Rate</h4>
      </div>
      <StatPills
        stats={[
          { label: "Current", value: `${stats.current.toFixed(1)}%` },
          { label: "High", value: `${stats.high.toFixed(1)}%` },
          { label: "Low", value: `${stats.low.toFixed(1)}%` },
          { label: "Avg", value: `${stats.avg.toFixed(1)}%` },
        ]}
      />
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={X_TICK} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
          <YAxis yAxisId="rate" tick={Y_TICK} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v}%`} />
          <YAxis yAxisId="dollars" orientation="right" tick={Y_TICK} axisLine={false} tickLine={false} width={65} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={((value: number, name: string) => {
              if (name === "rate") return [`${value.toFixed(1)}%`, "Rate"];
              return [`$${value.toLocaleString()}`, "Outstanding"];
            }) as AnyFormatter}
          />
          <Area yAxisId="dollars" type="monotone" dataKey="dollars" stroke="none" fill="#fecaca" fillOpacity={0.4} />
          <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="#dc2626" strokeWidth={2} dot={{ r: 3, fill: "#dc2626" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function VacancyChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="Vacancy Rate" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    rate: d.value.rate ?? 0,
    vacantCount: d.value.vacantCount ?? 0,
  }));

  const rates = chartData.map((d) => d.rate);
  const stats = computeStats(rates);

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
          <Home className="w-4 h-4 text-amber-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">Vacancy Rate</h4>
      </div>
      <StatPills
        stats={[
          { label: "Current", value: `${stats.current.toFixed(1)}%` },
          { label: "High", value: `${stats.high.toFixed(1)}%` },
          { label: "Low", value: `${stats.low.toFixed(1)}%` },
          { label: "Avg", value: `${stats.avg.toFixed(1)}%` },
        ]}
      />
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={X_TICK} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
          <YAxis tick={Y_TICK} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={((value: number, name: string) => {
              if (name === "rate") return [`${value.toFixed(1)}%`, "Rate"];
              return [`${value}`, "Vacant Units"];
            }) as AnyFormatter}
          />
          <Area type="monotone" dataKey="rate" stroke="#d97706" strokeWidth={2} fill="#fde68a" fillOpacity={0.3} dot={{ r: 3, fill: "#d97706" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function WorkOrderChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="Work Order Cycle Time" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    avgDays: d.value.avgDaysToClose ?? 0,
    openCount: d.value.openCount ?? 0,
  }));

  const avgDays = chartData.map((d) => d.avgDays);
  const stats = computeStats(avgDays);

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <Wrench className="w-4 h-4 text-blue-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">Work Order Cycle Time</h4>
      </div>
      <StatPills
        stats={[
          { label: "Current", value: `${stats.current.toFixed(1)} days` },
          { label: "High", value: `${stats.high.toFixed(1)} days` },
          { label: "Low", value: `${stats.low.toFixed(1)} days` },
          { label: "Avg", value: `${stats.avg.toFixed(1)} days` },
        ]}
      />
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={X_TICK} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
          <YAxis yAxisId="days" tick={Y_TICK} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v}d`} />
          <YAxis yAxisId="count" orientation="right" tick={Y_TICK} axisLine={false} tickLine={false} width={45} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={((value: number, name: string) => {
              if (name === "avgDays") return [`${value.toFixed(1)} days`, "Avg Cycle Time"];
              return [`${value}`, "Open WOs"];
            }) as AnyFormatter}
          />
          <Bar yAxisId="count" dataKey="openCount" fill="#bfdbfe" fillOpacity={0.6} radius={[4, 4, 0, 0]} maxBarSize={24} name="openCount" />
          <Line yAxisId="days" type="monotone" dataKey="avgDays" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: "#2563eb" }} name="avgDays" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-charcoal-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-blue-200" />
          <span>Open Work Orders</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-blue-600 rounded" />
          <span>Avg Cycle Time</span>
        </div>
      </div>
    </div>
  );
}

function NoticeChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="30-Day Notice Volume" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    thisWeek: d.value.thisWeek ?? 0,
    last30Days: d.value.last30Days ?? 0,
  }));

  const volumes = chartData.map((d) => d.last30Days);
  const stats = computeStats(volumes);

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
          <FileWarning className="w-4 h-4 text-purple-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">30-Day Notice Volume</h4>
      </div>
      <StatPills
        stats={[
          { label: "Current", value: `${stats.current}` },
          { label: "High", value: `${stats.high}` },
          { label: "Low", value: `${stats.low}` },
          { label: "Avg", value: `${stats.avg.toFixed(0)}` },
        ]}
      />
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={X_TICK} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
          <YAxis tick={Y_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={((value: number, name: string) => {
              if (name === "last30Days") return [`${value}`, "30-Day Rolling"];
              return [`${value}`, "This Week"];
            }) as AnyFormatter}
          />
          <Bar dataKey="last30Days" fill="#e9d5ff" fillOpacity={0.7} radius={[4, 4, 0, 0]} maxBarSize={28} name="last30Days" />
          <Bar dataKey="thisWeek" fill="#9333ea" radius={[4, 4, 0, 0]} maxBarSize={28} name="thisWeek" />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-charcoal-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-purple-200" />
          <span>30-Day Rolling</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-purple-600" />
          <span>That Week</span>
        </div>
      </div>
    </div>
  );
}

function InsuranceChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="Insurance Compliance" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    rate: d.value.rate ?? 0,
    compliantCount: d.value.compliantCount ?? 0,
  }));

  const rates = chartData.map((d) => d.rate);
  const stats = computeStats(rates);

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
          <Shield className="w-4 h-4 text-green-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">Insurance Compliance</h4>
      </div>
      <StatPills
        stats={[
          { label: "Current", value: `${stats.current.toFixed(1)}%` },
          { label: "High", value: `${stats.high.toFixed(1)}%` },
          { label: "Low", value: `${stats.low.toFixed(1)}%` },
          { label: "Avg", value: `${stats.avg.toFixed(1)}%` },
        ]}
      />
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={X_TICK} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
          <YAxis tick={Y_TICK} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={((value: number, name: string) => {
              if (name === "rate") return [`${value.toFixed(1)}%`, "Compliance Rate"];
              return [`${value}`, "Compliant"];
            }) as AnyFormatter}
          />
          <Area type="monotone" dataKey="rate" stroke="#16a34a" strokeWidth={2} fill="#bbf7d0" fillOpacity={0.3} dot={{ r: 3, fill: "#16a34a" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// Page
// ============================================

export default function TrendsPage() {
  const [range, setRange] = useState<DateRange>("8w");
  const [trends, setTrends] = useState<Record<string, TrendPoint[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchTrends = useCallback(async (r: DateRange) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kpi/trends?range=${r}`);
      if (res.ok) {
        const data = await res.json();
        setTrends(data);
      }
    } catch {
      // Trends will show empty state
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTrends(range);
  }, [range, fetchTrends]);

  return (
    <div className="px-8 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs text-charcoal-400 hover:text-charcoal-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Dashboard
            </Link>
            <p className="text-xs font-semibold text-terra-500 uppercase tracking-widest mb-1">
              KPI Trends
            </p>
            <h1 className="text-2xl font-bold text-charcoal-900 tracking-tight">
              Historical Performance
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Date range toggle */}
            <div className="flex bg-sand-100 rounded-lg p-0.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
                    range === opt.value
                      ? "bg-white text-charcoal-900 shadow-sm"
                      : "text-charcoal-500 hover:text-charcoal-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchTrends(range)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-charcoal-600 bg-white border border-sand-200 rounded-lg hover:bg-sand-50 transition-all duration-150 disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <ChartSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
          <DelinquencyChart data={trends.delinquency || []} />
          <VacancyChart data={trends.vacancy || []} />
          <WorkOrderChart data={trends.work_orders || []} />
          <NoticeChart data={trends.notices || []} />
          <InsuranceChart data={trends.insurance || []} />
        </div>
      )}
    </div>
  );
}
