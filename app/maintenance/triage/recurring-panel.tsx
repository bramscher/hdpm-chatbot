"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Clock,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

interface RecurringInstance {
  id: string;
  wo_number: string | null;
  unit_name: string | null;
  status: string;
  appfolio_status: string | null;
  scheduled_start: string | null;
  created_at: string;
  updated_at: string;
}

interface RecurringGroup {
  property_name: string;
  property_address: string | null;
  description: string;
  vendor_name: string | null;
  category: string | null;
  count: number;
  open_count: number;
  latest_created: string | null;
  frequency: string | null;
  instances: RecurringInstance[];
}

interface RecurringData {
  recurring: RecurringGroup[];
  total_groups: number;
  total_instances: number;
}

const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "semi-annual": "Semi-Annual",
  annual: "Annual",
};

const FREQ_COLORS: Record<string, string> = {
  weekly: "bg-purple-100 text-purple-700",
  monthly: "bg-blue-100 text-blue-700",
  quarterly: "bg-teal-100 text-teal-700",
  "semi-annual": "bg-amber-100 text-amber-700",
  annual: "bg-charcoal-100 text-charcoal-700",
};

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────

export function RecurringPanel() {
  const [data, setData] = useState<RecurringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [actioning, setActioning] = useState(false);

  const fetchRecurring = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/triage/recurring");
      if (!res.ok) throw new Error("Failed to fetch");
      const json: RecurringData = await res.json();
      setData(json);
    } catch (err) {
      console.error("Recurring fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecurring();
  }, []);

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selected.size === data.recurring.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.recurring.map((_, i) => i)));
    }
  };

  const handleMigrateSelected = async () => {
    if (!data) return;
    setActioning(true);
    try {
      // Collect all open work order IDs from selected groups
      const ids: string[] = [];
      for (const idx of selected) {
        const group = data.recurring[idx];
        for (const inst of group.instances) {
          if (inst.status === "open") {
            ids.push(inst.id);
          }
        }
      }

      if (ids.length === 0) {
        alert("No open work orders in the selected groups to migrate.");
        return;
      }

      const res = await fetch("/api/triage/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderIds: ids, action: "migrated", wasOverridden: false }),
      });

      if (!res.ok) throw new Error("Migration action failed");

      // Refresh
      await fetchRecurring();
      setSelected(new Set());
    } catch (err) {
      console.error("Migration error:", err);
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 animate-spin text-charcoal-400" />
        <span className="ml-3 text-charcoal-500">Detecting recurring work orders...</span>
      </div>
    );
  }

  if (!data || data.recurring.length === 0) {
    return (
      <div className="text-center py-16 text-charcoal-400">
        <Repeat className="w-10 h-10 mx-auto mb-3 text-charcoal-300" />
        <p className="font-medium">No recurring work orders detected</p>
        <p className="text-xs mt-1">Work orders with identical descriptions for the same property will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-charcoal-50 rounded-lg p-4 text-sm text-charcoal-600 flex items-center gap-6 flex-wrap">
        <span className="font-medium flex items-center gap-2">
          <Repeat className="w-4 h-4" />
          Recurring patterns:
        </span>
        <span className="text-indigo-600 font-semibold">{data.total_groups} groups</span>
        <span className="text-charcoal-500">{data.total_instances} total instances</span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-charcoal-900 text-white rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium">{selected.size} group{selected.size !== 1 ? "s" : ""} selected</span>
          <button
            onClick={handleMigrateSelected}
            disabled={actioning}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {actioning ? "Processing..." : `Flag for Migration (${selected.size})`}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-charcoal-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-charcoal-50 border-b border-charcoal-200">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === data.recurring.length}
                  onChange={toggleSelectAll}
                  className="rounded border-charcoal-300"
                />
              </th>
              <th className="w-8 px-1 py-3"></th>
              <th className="text-left px-3 py-3 font-semibold text-charcoal-600">Property</th>
              <th className="text-left px-3 py-3 font-semibold text-charcoal-600">Description</th>
              <th className="text-left px-3 py-3 font-semibold text-charcoal-600 hidden md:table-cell">Vendor</th>
              <th className="text-center px-3 py-3 font-semibold text-charcoal-600 w-20">Count</th>
              <th className="text-center px-3 py-3 font-semibold text-charcoal-600 w-20 hidden sm:table-cell">Open</th>
              <th className="text-left px-3 py-3 font-semibold text-charcoal-600 hidden lg:table-cell">Frequency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100">
            {data.recurring.map((group, idx) => (
              <>
                <tr
                  key={`group-${idx}`}
                  className={cn(
                    "hover:bg-charcoal-50 transition-colors cursor-pointer",
                    selected.has(idx) && "bg-terra-50"
                  )}
                  onClick={() => toggleExpand(idx)}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(idx)}
                      onChange={() => toggleSelect(idx)}
                      className="rounded border-charcoal-300"
                    />
                  </td>
                  <td className="px-1 py-3 text-charcoal-400">
                    {expanded.has(idx) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-charcoal-900 truncate max-w-[200px]">
                      {group.property_name}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-charcoal-600 truncate max-w-[300px]">{group.description}</div>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <span className="text-charcoal-500 truncate max-w-[150px] block">
                      {group.vendor_name || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-semibold text-charcoal-700">{group.count}</span>
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    <span className={cn(
                      "font-semibold",
                      group.open_count > 0 ? "text-amber-600" : "text-charcoal-400"
                    )}>
                      {group.open_count}
                    </span>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    {group.frequency ? (
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        FREQ_COLORS[group.frequency] || "bg-charcoal-100 text-charcoal-600"
                      )}>
                        <Clock className="w-3 h-3" />
                        {FREQ_LABELS[group.frequency] || group.frequency}
                      </span>
                    ) : (
                      <span className="text-xs text-charcoal-400">—</span>
                    )}
                  </td>
                </tr>

                {/* Expanded instances */}
                {expanded.has(idx) && (
                  <tr key={`instances-${idx}`}>
                    <td colSpan={8} className="px-0 py-0">
                      <div className="bg-charcoal-50/50 border-t border-charcoal-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-charcoal-400">
                              <th className="text-left px-6 py-2 font-medium">WO #</th>
                              <th className="text-left px-3 py-2 font-medium">Unit</th>
                              <th className="text-left px-3 py-2 font-medium">Status</th>
                              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Scheduled</th>
                              <th className="text-left px-3 py-2 font-medium">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-charcoal-100">
                            {group.instances.map((inst) => (
                              <tr key={inst.id} className="hover:bg-white/50">
                                <td className="px-6 py-2 font-mono text-charcoal-500">
                                  {inst.wo_number || "—"}
                                </td>
                                <td className="px-3 py-2 text-charcoal-500">
                                  {inst.unit_name || "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={cn(
                                    "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                                    inst.status === "open"
                                      ? "bg-green-100 text-green-700"
                                      : inst.status === "done"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-charcoal-100 text-charcoal-600"
                                  )}>
                                    {inst.appfolio_status || inst.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-charcoal-400 hidden sm:table-cell">
                                  {inst.scheduled_start
                                    ? new Date(inst.scheduled_start).toLocaleDateString()
                                    : "—"}
                                </td>
                                <td className="px-3 py-2 text-charcoal-400">
                                  {new Date(inst.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
