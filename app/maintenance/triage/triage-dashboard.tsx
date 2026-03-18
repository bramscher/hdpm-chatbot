"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Clock,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

interface TriageWorkOrder {
  id: string;
  wo_number: string | null;
  property_name: string;
  property_address: string | null;
  unit_name: string | null;
  description: string;
  vendor_name: string | null;
  created_at: string;
  updated_at: string;
  triage_recommendation: "close" | "finish" | "migrate" | "pending";
  triage_reason: string | null;
  triage_action_taken: string | null;
}

interface ScoreSummary {
  close: number;
  finish: number;
  migrate: number;
  pending: number;
  skipped: number;
}

type Tab = "close" | "finish" | "migrate";
type Action = "closed" | "kept" | "migrated";

const TAB_CONFIG: Record<Tab, { label: string; icon: typeof XCircle; color: string; badgeClass: string; action: Action; actionLabel: string }> = {
  close: {
    label: "Close",
    icon: XCircle,
    color: "text-red-500",
    badgeClass: "bg-red-100 text-red-700",
    action: "closed",
    actionLabel: "Close",
  },
  finish: {
    label: "Finish in AppFolio",
    icon: CheckCircle2,
    color: "text-amber-500",
    badgeClass: "bg-amber-100 text-amber-700",
    action: "kept",
    actionLabel: "Mark as Kept",
  },
  migrate: {
    label: "Migrate to Meld",
    icon: ArrowRightLeft,
    color: "text-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-700",
    action: "migrated",
    actionLabel: "Flag for Migration",
  },
};

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────

export function TriageDashboard() {
  const [workOrders, setWorkOrders] = useState<TriageWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("close");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastScored, setLastScored] = useState<string | null>(null);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [completionStats, setCompletionStats] = useState<{ closed: number; kept: number; migrated: number } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // ── Sync all work orders from AppFolio ──
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/triage/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      console.log("Sync complete:", data);
      // Re-fetch and re-score after sync
      await handleScore();
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  // ── Fetch work orders (no row limit) ──
  const fetchWorkOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/triage/work-orders");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const orders: TriageWorkOrder[] = data.workOrders || [];
      setWorkOrders(orders);

      // Auto-select first tab that has unactioned items
      const unact = orders.filter((wo) => !wo.triage_action_taken);
      const tabs: Tab[] = ["close", "finish", "migrate"];
      const firstWithItems = tabs.find((t) => unact.some((wo) => wo.triage_recommendation === t));
      if (firstWithItems) setActiveTab(firstWithItems);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // ── Score all work orders ──
  const handleScore = async () => {
    setScoring(true);
    try {
      const res = await fetch("/api/triage/score", { method: "POST" });
      if (!res.ok) throw new Error("Scoring failed");
      const summary: ScoreSummary = await res.json();
      setScoreSummary(summary);
      setLastScored(new Date().toLocaleTimeString());
      // Refresh work orders
      await fetchWorkOrders();
      setSelected(new Set());
    } catch (err) {
      console.error("Score error:", err);
    } finally {
      setScoring(false);
    }
  };

  // ── Apply action ──
  const handleAction = async (ids: string[], action: Action, wasOverridden = false) => {
    setActioning(true);
    try {
      const res = await fetch("/api/triage/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderIds: ids, action, wasOverridden }),
      });
      if (!res.ok) throw new Error("Action failed");
      // Track completion stats
      setCompletionStats((prev) => ({
        closed: (prev?.closed ?? 0) + (action === "closed" ? ids.length : 0),
        kept: (prev?.kept ?? 0) + (action === "kept" ? ids.length : 0),
        migrated: (prev?.migrated ?? 0) + (action === "migrated" ? ids.length : 0),
      }));
      await fetchWorkOrders();
      setSelected(new Set());
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActioning(false);
      setOverrideOpen(false);
    }
  };

  // ── Computed ──
  const unactioned = workOrders.filter((wo) => !wo.triage_action_taken);
  const tabOrders = (tab: Tab) => unactioned.filter((wo) => wo.triage_recommendation === tab);
  const currentOrders = tabOrders(activeTab);
  const needsReview = unactioned.length;
  const allDone = needsReview === 0 && !loading && workOrders.length > 0;

  const daysSince = (dateStr: string) => {
    const d = new Date(dateStr);
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  // ── Select helpers ──
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === currentOrders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(currentOrders.map((wo) => wo.id)));
    }
  };

  // Clear selection when changing tabs
  useEffect(() => {
    setSelected(new Set());
    setOverrideOpen(false);
  }, [activeTab]);

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 animate-spin text-charcoal-400" />
        <span className="ml-3 text-charcoal-500">Loading work orders...</span>
      </div>
    );
  }

  // All done state
  if (allDone) {
    const total = (completionStats?.closed ?? 0) + (completionStats?.kept ?? 0) + (completionStats?.migrated ?? 0);
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-charcoal-900 mb-2">Backlog triage complete</h2>
        <p className="text-charcoal-500 mb-6">
          All {total > 0 ? total : workOrders.length} work orders have been reviewed.
        </p>
        {completionStats && (
          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{completionStats.closed}</p>
              <p className="text-charcoal-500">Closed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{completionStats.kept}</p>
              <p className="text-charcoal-500">Kept</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{completionStats.migrated}</p>
              <p className="text-charcoal-500">Migrated</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const tabConfig = TAB_CONFIG[activeTab];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">AppFolio Backlog Triage</h1>
          <p className="text-charcoal-500 text-sm mt-1">
            {needsReview} work order{needsReview !== 1 ? "s" : ""} need review
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastScored && (
            <span className="text-xs text-charcoal-400">Last scored: {lastScored}</span>
          )}
          <button
            onClick={handleSyncAll}
            disabled={syncing || scoring}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              "border border-charcoal-300 text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-60"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync All from AppFolio"}
          </button>
          <button
            onClick={handleScore}
            disabled={scoring || syncing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              "bg-terra-500 text-white hover:bg-terra-600 disabled:opacity-60"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", scoring && "animate-spin")} />
            {scoring ? "Scoring..." : "Re-score"}
          </button>
        </div>
      </div>

      {/* ── Score Summary (after scoring) ── */}
      {scoreSummary && (
        <div className="bg-charcoal-50 rounded-lg p-4 text-sm text-charcoal-600 flex items-center gap-6 flex-wrap">
          <span className="font-medium">Score results:</span>
          <span className="text-red-600">{scoreSummary.close} to close</span>
          <span className="text-amber-600">{scoreSummary.finish} to finish</span>
          <span className="text-emerald-600">{scoreSummary.migrate} to migrate</span>
          {scoreSummary.pending > 0 && <span className="text-charcoal-500">{scoreSummary.pending} pending</span>}
          {scoreSummary.skipped > 0 && <span className="text-charcoal-400">{scoreSummary.skipped} already actioned</span>}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="border-b border-charcoal-200">
        <nav className="flex gap-1 -mb-px">
          {(Object.keys(TAB_CONFIG) as Tab[]).map((tab) => {
            const cfg = TAB_CONFIG[tab];
            const Icon = cfg.icon;
            const count = tabOrders(tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab
                    ? "border-charcoal-900 text-charcoal-900"
                    : "border-transparent text-charcoal-500 hover:text-charcoal-700 hover:border-charcoal-300"
                )}
              >
                <Icon className={cn("w-4 h-4", cfg.color)} />
                {cfg.label}
                <span className={cn("ml-1 px-2 py-0.5 rounded-full text-xs font-semibold", cfg.badgeClass)}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Bulk Action Bar ── */}
      {selected.size > 0 && (
        <div className="bg-charcoal-900 text-white rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            {/* Override dropdown */}
            <div className="relative">
              <button
                onClick={() => setOverrideOpen(!overrideOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors"
              >
                Override
                <ChevronDown className="w-3 h-3" />
              </button>
              {overrideOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-charcoal-200 py-1 z-10 min-w-[160px]">
                  {(Object.keys(TAB_CONFIG) as Tab[])
                    .filter((t) => t !== activeTab)
                    .map((t) => {
                      const cfg = TAB_CONFIG[t];
                      return (
                        <button
                          key={t}
                          onClick={() => handleAction(Array.from(selected), cfg.action, true)}
                          disabled={actioning}
                          className="w-full text-left px-3 py-2 text-sm text-charcoal-700 hover:bg-charcoal-50 transition-colors"
                        >
                          {cfg.actionLabel} ({selected.size})
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Primary action */}
            <button
              onClick={() => handleAction(Array.from(selected), tabConfig.action)}
              disabled={actioning}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                "bg-white text-charcoal-900 hover:bg-charcoal-100 disabled:opacity-60"
              )}
            >
              {actioning ? "Processing..." : `${tabConfig.actionLabel} (${selected.size})`}
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {currentOrders.length === 0 ? (
        <div className="text-center py-16 text-charcoal-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-charcoal-300" />
          <p className="font-medium">All done — nothing left in this category</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-charcoal-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-charcoal-50 border-b border-charcoal-200">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === currentOrders.length && currentOrders.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-charcoal-300"
                  />
                </th>
                <th className="text-left px-3 py-3 font-semibold text-charcoal-600">WO #</th>
                <th className="text-left px-3 py-3 font-semibold text-charcoal-600">Property / Unit</th>
                <th className="text-left px-3 py-3 font-semibold text-charcoal-600 hidden lg:table-cell">Description</th>
                <th className="text-left px-3 py-3 font-semibold text-charcoal-600 w-20">Age</th>
                <th className="text-left px-3 py-3 font-semibold text-charcoal-600 hidden md:table-cell">Vendor</th>
                <th className="text-left px-3 py-3 font-semibold text-charcoal-600 hidden xl:table-cell">Reason</th>
                <th className="w-10 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-100">
              {currentOrders.map((wo) => {
                const age = daysSince(wo.created_at);
                return (
                  <tr
                    key={wo.id}
                    className={cn(
                      "hover:bg-charcoal-50 transition-colors",
                      selected.has(wo.id) && "bg-terra-50"
                    )}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(wo.id)}
                        onChange={() => toggleSelect(wo.id)}
                        className="rounded border-charcoal-300"
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-charcoal-500">
                      {wo.wo_number || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-charcoal-900 truncate max-w-[200px]">
                        {wo.property_name}
                      </div>
                      {wo.unit_name && (
                        <div className="text-xs text-charcoal-400">{wo.unit_name}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <div className="text-charcoal-600 truncate max-w-[300px]">{wo.description}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          age > 90 ? "text-red-600" : age > 30 ? "text-amber-600" : "text-charcoal-500"
                        )}
                      >
                        {age}d
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="text-charcoal-500 truncate max-w-[150px] block">
                        {wo.vendor_name || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden xl:table-cell">
                      <span className="text-xs text-charcoal-400">{wo.triage_reason || "—"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleAction([wo.id], tabConfig.action)}
                        disabled={actioning}
                        title={tabConfig.actionLabel}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          "text-charcoal-400 hover:text-charcoal-900 hover:bg-charcoal-100 disabled:opacity-40"
                        )}
                      >
                        <tabConfig.icon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pending / Manual Review notice ── */}
      {tabOrders("close").length === 0 &&
        tabOrders("finish").length === 0 &&
        tabOrders("migrate").length === 0 &&
        unactioned.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {unactioned.length} work order{unactioned.length !== 1 ? "s" : ""} need manual review
              </p>
              <p className="text-xs text-amber-600 mt-1">
                These don&apos;t fit the standard triage categories. Click &ldquo;Re-score&rdquo; after reviewing or action them individually from the work orders page.
              </p>
            </div>
          </div>
        )}
    </div>
  );
}
