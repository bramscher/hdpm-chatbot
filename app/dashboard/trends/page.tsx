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
  ReferenceLine,
} from "recharts";
import {
  ArrowLeft,
  DollarSign,
  Home,
  Wrench,
  FileWarning,
  Shield,
  RefreshCw,
  Users,
  PieChart,
  Timer,
  Repeat,
  Building2,
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
// Shared: Insight Line
// ============================================

function InsightLine({ text }: { text: string }) {
  return (
    <p className="mt-4 text-xs text-charcoal-400 italic leading-relaxed border-t border-sand-100 pt-3">
      {text}
    </p>
  );
}

// ============================================
// KPI 6: Owner Retention Rate
// ============================================

function OwnerRetentionChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="Owner Retention Rate" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    rate: d.value.rate ?? 0,
    cancellations: d.value.cancellationsLast30Days ?? 0,
  }));

  const rates = chartData.map((d) => d.rate);
  const stats = computeStats(rates);

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
          <Users className="w-4 h-4 text-indigo-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">Owner Retention Rate</h4>
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
          <YAxis yAxisId="rate" tick={Y_TICK} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v}%`} domain={[80, 100]} />
          <YAxis yAxisId="cancel" orientation="right" tick={Y_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={((value: number, name: string) => {
              if (name === "rate") return [`${value.toFixed(1)}%`, "Retention Rate"];
              return [`${value}`, "Cancellations (30d)"];
            }) as AnyFormatter}
          />
          <Bar yAxisId="cancel" dataKey="cancellations" fill="#c7d2fe" fillOpacity={0.6} radius={[4, 4, 0, 0]} maxBarSize={24} name="cancellations" />
          <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3, fill: "#4f46e5" }} name="rate" />
        </ComposedChart>
      </ResponsiveContainer>
      <InsightLine text="A rate above 90% is considered healthy for a PM portfolio at this scale." />
    </div>
  );
}

// ============================================
// KPI 7: Maintenance Cost as % of Rent Roll
// ============================================

function MaintenanceCostChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="Maintenance Cost %" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    rate: d.value.rate ?? 0,
    maintenanceDollars: d.value.maintenanceDollars ?? 0,
    grossRentDollars: d.value.grossRentDollars ?? 0,
  }));

  const rates = chartData.map((d) => d.rate);
  const stats = computeStats(rates);

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
          <PieChart className="w-4 h-4 text-orange-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">Maintenance Cost as % of Rent Roll</h4>
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
              if (name === "rate") return [`${value.toFixed(1)}%`, "Cost %"];
              if (name === "maintenanceDollars") return [`$${value.toLocaleString()}`, "Maintenance"];
              return [`$${value.toLocaleString()}`, "Rent Roll"];
            }) as AnyFormatter}
          />
          <Bar yAxisId="dollars" dataKey="grossRentDollars" fill="#e5e7eb" fillOpacity={0.4} radius={[4, 4, 0, 0]} maxBarSize={28} name="grossRentDollars" />
          <Bar yAxisId="dollars" dataKey="maintenanceDollars" fill="#fed7aa" fillOpacity={0.7} radius={[4, 4, 0, 0]} maxBarSize={28} name="maintenanceDollars" />
          <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="#ea580c" strokeWidth={2} dot={{ r: 3, fill: "#ea580c" }} name="rate" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-charcoal-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-gray-200" />
          <span>Rent Roll</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-orange-200" />
          <span>Maintenance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-orange-600 rounded" />
          <span>Cost %</span>
        </div>
      </div>
      <InsightLine text="Industry benchmark is 8–15% for a residential PM portfolio. Spikes often indicate deferred maintenance catching up." />
    </div>
  );
}

// ============================================
// KPI 8: Average Days to Lease
// ============================================

function DaysToLeaseChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="Average Days to Lease" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    avgDays: d.value.avgDays ?? 0,
    fastest: d.value.fastest ?? 0,
    slowest: d.value.slowest ?? 0,
    unitsLeased: d.value.unitsLeased ?? 0,
  }));

  const avgDays = chartData.map((d) => d.avgDays);
  const stats = computeStats(avgDays);
  const lastPoint = chartData[chartData.length - 1];

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
          <Timer className="w-4 h-4 text-cyan-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">Average Days to Lease</h4>
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
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={X_TICK} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
          <YAxis tick={Y_TICK} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${v}d`} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={((value: number, name: string) => {
              if (name === "avgDays") return [`${value.toFixed(1)} days`, "Avg Days"];
              return [`${value}`, name];
            }) as AnyFormatter}
          />
          <Area type="monotone" dataKey="avgDays" stroke="#0891b2" strokeWidth={2} fill="#a5f3fc" fillOpacity={0.3} dot={{ r: 3, fill: "#0891b2" }} />
        </AreaChart>
      </ResponsiveContainer>
      {lastPoint && (
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-xs">
            <span className="text-charcoal-400">Fastest</span>{" "}
            <span className="font-semibold text-cyan-700">{lastPoint.fastest}d</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-xs">
            <span className="text-charcoal-400">Slowest</span>{" "}
            <span className="font-semibold text-cyan-700">{lastPoint.slowest}d</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-xs">
            <span className="text-charcoal-400">Units Leased</span>{" "}
            <span className="font-semibold text-cyan-700">{lastPoint.unitsLeased}</span>
          </div>
        </div>
      )}
      <InsightLine text="Central Oregon market average is typically 14–21 days. Anything over 30 days warrants a pricing or advertising review." />
    </div>
  );
}

// ============================================
// KPI 9: Lease Renewal Rate
// ============================================

function LeaseRenewalChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="Lease Renewal Rate" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    rate: d.value.rate ?? 0,
    renewals: d.value.renewals ?? 0,
    moveOuts: d.value.moveOuts ?? 0,
  }));

  const rates = chartData.map((d) => d.rate);
  const stats = computeStats(rates);

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
          <Repeat className="w-4 h-4 text-teal-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">Lease Renewal Rate</h4>
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
          <YAxis yAxisId="count" orientation="right" tick={Y_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={((value: number, name: string) => {
              if (name === "rate") return [`${value.toFixed(1)}%`, "Renewal Rate"];
              if (name === "renewals") return [`${value}`, "Renewals"];
              return [`${value}`, "Move-Outs"];
            }) as AnyFormatter}
          />
          <Bar yAxisId="count" dataKey="renewals" stackId="leases" fill="#99f6e4" radius={[0, 0, 0, 0]} maxBarSize={28} name="renewals" />
          <Bar yAxisId="count" dataKey="moveOuts" stackId="leases" fill="#fecaca" radius={[4, 4, 0, 0]} maxBarSize={28} name="moveOuts" />
          <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="#0d9488" strokeWidth={2} dot={{ r: 3, fill: "#0d9488" }} name="rate" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-charcoal-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-teal-200" />
          <span>Renewals</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-red-200" />
          <span>Move-Outs</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-teal-600 rounded" />
          <span>Renewal Rate</span>
        </div>
      </div>
      <InsightLine text="A renewal rate above 60% reduces turnover cost significantly. Each avoided turnover saves an estimated $1,500–$3,000 in make-ready and vacancy costs." />
    </div>
  );
}

// ============================================
// KPI 10: Net Doors Added
// ============================================

function computeTargetDate(data: TrendPoint[]): string {
  if (data.length < 3) return "Insufficient data to project target date";

  const lastThree = data.slice(-3);
  const avgNet =
    lastThree.reduce((sum, d) => sum + (d.value.netThisMonth ?? 0), 0) / lastThree.length;

  if (avgNet <= 0) return "Growth rate insufficient to project target date";

  const currentDoors = data[data.length - 1].value.currentDoors ?? 0;
  const remaining = 1500 - currentDoors;

  if (remaining <= 0) return "Goal of 1,500 doors reached!";

  const monthsToGoal = Math.ceil(remaining / avgNet);
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + monthsToGoal);

  return `On track to reach 1,500 doors by ${targetDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Adjust the growth rate assumption if acquisition pace changes.`;
}

function NetDoorsChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return <EmptyChart name="Net Doors Added" />;

  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    currentDoors: d.value.currentDoors ?? 0,
    netThisMonth: d.value.netThisMonth ?? 0,
  }));

  const doors = chartData.map((d) => d.currentDoors);
  const stats = computeStats(doors);
  const projectionText = computeTargetDate(data);

  return (
    <div className="glass glass-shine rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
          <Building2 className="w-4 h-4 text-emerald-600" />
        </div>
        <h4 className="text-sm font-semibold text-charcoal-700">Net Doors Added</h4>
      </div>
      <StatPills
        stats={[
          { label: "Current", value: `${stats.current}` },
          { label: "High", value: `${stats.high}` },
          { label: "Low", value: `${stats.low}` },
          { label: "Goal", value: "1,500" },
        ]}
      />
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={X_TICK} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} tickLine={false} />
          <YAxis yAxisId="doors" tick={Y_TICK} axisLine={false} tickLine={false} width={55} />
          <YAxis yAxisId="net" orientation="right" tick={Y_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={((value: number, name: string) => {
              if (name === "currentDoors") return [`${value}`, "Total Doors"];
              const sign = value >= 0 ? "+" : "";
              return [`${sign}${value}`, "Net This Month"];
            }) as AnyFormatter}
          />
          <ReferenceLine yAxisId="doors" y={1500} stroke="#d97706" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Goal: 1,500", position: "right", fontSize: 10, fill: "#d97706" }} />
          <Bar yAxisId="net" dataKey="netThisMonth" fill="#a7f3d0" fillOpacity={0.6} radius={[4, 4, 0, 0]} maxBarSize={24} name="netThisMonth" />
          <Line yAxisId="doors" type="monotone" dataKey="currentDoors" stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: "#059669" }} name="currentDoors" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-charcoal-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-emerald-200" />
          <span>Monthly Net</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-emerald-600 rounded" />
          <span>Total Doors</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-amber-500 rounded border-dashed" style={{ borderTop: "1px dashed #d97706" }} />
          <span>Goal</span>
        </div>
      </div>
      <InsightLine text={projectionText} />
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
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
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
          <OwnerRetentionChart data={trends.owner_retention || []} />
          <MaintenanceCostChart data={trends.maintenance_cost || []} />
          <DaysToLeaseChart data={trends.days_to_lease || []} />
          <LeaseRenewalChart data={trends.lease_renewal || []} />
          <NetDoorsChart data={trends.net_doors || []} />
        </div>
      )}
    </div>
  );
}
