"use client";

import React from "react";
import { DollarSign, TrendingUp, BarChart3, Hash } from "lucide-react";
import type { CompsStats, MarketBaseline } from "@/types/comps";

interface CompsStatsCardsProps {
  stats: CompsStats | null;
  baselines: MarketBaseline[];
  loading?: boolean;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
}

function StatCard({ icon, label, value, subtitle, highlight }: StatCardProps) {
  return (
    <div className="glass glass-shine rounded-2xl p-5 flex items-start gap-4">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          highlight
            ? "bg-gradient-to-br from-emerald-500 to-green-700 shadow-glow"
            : "bg-gray-100"
        }`}
      >
        <div className={highlight ? "text-white" : "text-gray-500"}>
          {icon}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gray-200" />
        <div className="flex-1">
          <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
          <div className="h-7 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export function CompsStatsCards({ stats, baselines, loading }: CompsStatsCardsProps) {
  if (loading || !stats) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // Find the most common FMR baseline (3BR is standard reference)
  const fmr3br = baselines.find((b) => b.bedrooms === 3 && b.fmr_rent);
  const fmrLabel = fmr3br
    ? `HUD FMR (3BR ${fmr3br.area_name}): $${Number(fmr3br.fmr_rent).toLocaleString()}`
    : undefined;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<DollarSign className="h-5 w-5" />}
        label="Avg Rent"
        value={stats.count > 0 ? `$${stats.avg_rent.toLocaleString()}` : "—"}
        subtitle={stats.count > 0 ? `/mo` : "No data"}
        highlight
      />
      <StatCard
        icon={<TrendingUp className="h-5 w-5" />}
        label="Median Rent"
        value={stats.count > 0 ? `$${stats.median_rent.toLocaleString()}` : "—"}
        subtitle={fmrLabel}
      />
      <StatCard
        icon={<BarChart3 className="h-5 w-5" />}
        label="Range"
        value={
          stats.count > 0
            ? `$${stats.min_rent.toLocaleString()} – $${stats.max_rent.toLocaleString()}`
            : "—"
        }
        subtitle={
          stats.avg_rent_per_sqft
            ? `Avg $${stats.avg_rent_per_sqft}/sqft`
            : undefined
        }
      />
      <StatCard
        icon={<Hash className="h-5 w-5" />}
        label="Sample Size"
        value={stats.count.toLocaleString()}
        subtitle={
          stats.avg_sqft ? `Avg ${stats.avg_sqft.toLocaleString()} sqft` : "comps"
        }
      />
    </div>
  );
}
