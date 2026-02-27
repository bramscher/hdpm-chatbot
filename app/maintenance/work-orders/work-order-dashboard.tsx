"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Wrench,
  RefreshCw,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ============================================
// Types (mirror lib/work-orders.ts)
// ============================================

interface WorkOrder {
  id: string;
  appfolio_id: string;
  property_id: string | null;
  property_name: string;
  property_address: string | null;
  unit_id: string | null;
  unit_name: string | null;
  wo_number: string | null;
  description: string;
  category: string | null;
  priority: string | null;
  status: "open" | "closed" | "done";
  appfolio_status: string | null;
  assigned_to: string | null;
  vendor_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_date: string | null;
  canceled_date: string | null;
  permission_to_enter: boolean;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

interface WorkOrderStats {
  total: number;
  open: number;
  closed: number;
  done: number;
}

interface WorkOrderFilter {
  status?: ("open" | "closed" | "done")[];
  priority?: string[];
  search?: string;
}

// ============================================
// Style maps
// ============================================

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  open: {
    bg: "bg-blue-100/80",
    text: "text-blue-700",
    label: "Open",
  },
  done: {
    bg: "bg-emerald-100/80",
    text: "text-emerald-700",
    label: "Done",
  },
  closed: {
    bg: "bg-gray-100/80",
    text: "text-gray-500",
    label: "Closed",
  },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  Emergency: { bg: "bg-red-100/80", text: "text-red-700" },
  Urgent: { bg: "bg-red-100/80", text: "text-red-700" },
  High: { bg: "bg-orange-100/80", text: "text-orange-700" },
  Normal: { bg: "bg-gray-100/80", text: "text-gray-600" },
  Low: { bg: "bg-gray-50/80", text: "text-gray-400" },
};

// ============================================
// Filter pill component
// ============================================

function PillToggle<T extends string>({
  options,
  selected,
  onToggle,
  labelFn,
}: {
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
  labelFn?: (value: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
              isActive
                ? "bg-emerald-100/80 text-emerald-700 ring-1 ring-emerald-300 shadow-sm"
                : "bg-white/50 text-gray-500 hover:bg-white/70 hover:text-gray-700"
            }`}
          >
            {labelFn ? labelFn(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// Sort types
// ============================================

type SortField =
  | "property_name"
  | "status"
  | "priority"
  | "created_at"
  | "completed_date";

// ============================================
// Dashboard Component
// ============================================

interface WorkOrderDashboardProps {
  userEmail: string;
  userName: string;
}

export function WorkOrderDashboard({
  userEmail,
  userName,
}: WorkOrderDashboardProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<WorkOrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filters
  const [filter, setFilter] = useState<WorkOrderFilter>({});
  const [searchInput, setSearchInput] = useState("");

  // Sort
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Build query string
  function buildQuery(f: WorkOrderFilter): string {
    const params = new URLSearchParams();
    if (f.status?.length) params.set("status", f.status.join(","));
    if (f.priority?.length) params.set("priority", f.priority.join(","));
    if (f.search) params.set("search", f.search);
    return params.toString();
  }

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQuery(filter);
      const res = await fetch(`/api/work-orders${qs ? `?${qs}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setWorkOrders(data.workOrders || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error("Failed to fetch work orders:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync handler
  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync/work-orders", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Synced ${data.synced} work orders from AppFolio`);
        fetchData();
      } else {
        setSyncMessage(`Sync error: ${data.error}`);
      }
    } catch (err) {
      setSyncMessage("Sync failed — check console");
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  }

  // Search debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilter((prev) => ({ ...prev, search: searchInput || undefined }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Toggle helpers
  function toggle<T extends string>(arr: T[] | undefined, value: T): T[] {
    const current = arr || [];
    return current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
  }

  // Sort
  const sorted = useMemo(() => {
    const arr = [...workOrders];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "property_name":
          cmp = (a.property_name || "").localeCompare(b.property_name || "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "priority": {
          const order = { Emergency: 0, Urgent: 1, High: 2, Normal: 3, Low: 4 };
          const aP = order[(a.priority || "Normal") as keyof typeof order] ?? 3;
          const bP = order[(b.priority || "Normal") as keyof typeof order] ?? 3;
          cmp = aP - bP;
          break;
        }
        case "created_at":
          cmp = (a.created_at || "").localeCompare(b.created_at || "");
          break;
        case "completed_date":
          cmp = (a.completed_date || "").localeCompare(b.completed_date || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [workOrders, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "created_at" ? "desc" : "asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 text-gray-300" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-emerald-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-600" />
    );
  }

  // CSV export
  function handleExportCsv() {
    const headers = [
      "WO #",
      "Property",
      "Address",
      "Description",
      "Priority",
      "Status",
      "Assigned To",
      "Created",
      "Completed",
    ];
    const rows = sorted.map((wo) => [
      wo.wo_number || wo.appfolio_id,
      wo.property_name,
      wo.property_address || "",
      wo.description,
      wo.priority || "",
      wo.status,
      wo.assigned_to || "",
      wo.created_at ? new Date(wo.created_at).toLocaleDateString() : "",
      wo.completed_date
        ? new Date(wo.completed_date).toLocaleDateString()
        : "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `work-orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  }

  const hasFilters =
    (filter.status && filter.status.length > 0) ||
    (filter.priority && filter.priority.length > 0) ||
    !!filter.search;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Home
            </Button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl flex items-center justify-center shadow-glow">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                Work Orders
              </h2>
              <p className="text-xs text-gray-400">
                Synced from AppFolio
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/maintenance/invoices">
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Invoices
            </Button>
          </Link>
          <Button
            onClick={handleSync}
            disabled={syncing}
            size="sm"
            className="bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white shadow-glow hover:shadow-glow-lg transition-all duration-200"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1.5" />
            )}
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      {/* Sync message */}
      {syncMessage && (
        <div className="glass rounded-xl px-4 py-2.5 text-sm text-emerald-700 bg-emerald-50/60">
          {syncMessage}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Open",
            value: stats?.open ?? 0,
            color: "from-blue-500 to-blue-600",
            textColor: "text-blue-700",
          },
          {
            label: "Done",
            value: stats?.done ?? 0,
            color: "from-emerald-500 to-green-600",
            textColor: "text-emerald-700",
          },
          {
            label: "Closed",
            value: stats?.closed ?? 0,
            color: "from-gray-400 to-gray-500",
            textColor: "text-gray-600",
          },
        ].map((card) => (
          <div key={card.label} className="glass glass-shine rounded-2xl p-5">
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-16 bg-gray-200 rounded" />
                <div className="h-8 w-12 bg-gray-200 rounded" />
              </div>
            ) : (
              <>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  {card.label}
                </p>
                <p className={`text-3xl font-bold ${card.textColor}`}>
                  {card.value}
                </p>
                <p className="text-[10px] text-gray-300 mt-1">
                  of {stats?.total ?? 0} total
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass glass-shine rounded-2xl px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Filters</span>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilter({});
                setSearchInput("");
              }}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              Reset
            </Button>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Status
          </label>
          <PillToggle<"open" | "closed" | "done">
            options={["open", "done", "closed"]}
            selected={filter.status || []}
            onToggle={(s) =>
              setFilter({ ...filter, status: toggle(filter.status, s) })
            }
            labelFn={(s) => STATUS_STYLES[s]?.label || s}
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Priority
          </label>
          <PillToggle<string>
            options={["Emergency", "Urgent", "High", "Normal", "Low"]}
            selected={filter.priority || []}
            onToggle={(p) =>
              setFilter({ ...filter, priority: toggle(filter.priority, p) })
            }
          />
        </div>

        {/* Search */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Search
          </label>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              type="text"
              placeholder="Property, address, WO #..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 h-8 text-xs bg-white/70"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass glass-shine rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/30">
          <span className="text-sm font-semibold text-gray-700">
            {sorted.length} Work Order{sorted.length !== 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCsv}
            disabled={sorted.length === 0}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100/80">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  WO #
                </th>
                <th
                  className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600"
                  onClick={() => handleSort("property_name")}
                >
                  <span className="inline-flex items-center gap-1">
                    Property
                    <SortIcon field="property_name" />
                  </span>
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden lg:table-cell">
                  Description
                </th>
                <th
                  className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600"
                  onClick={() => handleSort("priority")}
                >
                  <span className="inline-flex items-center gap-1">
                    Priority
                    <SortIcon field="priority" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600"
                  onClick={() => handleSort("status")}
                >
                  <span className="inline-flex items-center gap-1">
                    Status
                    <SortIcon field="status" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600 hidden md:table-cell"
                  onClick={() => handleSort("created_at")}
                >
                  <span className="inline-flex items-center gap-1">
                    Created
                    <SortIcon field="created_at" />
                  </span>
                </th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-500 mx-auto" />
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    {hasFilters
                      ? "No work orders match the current filters"
                      : "No work orders yet — click Sync Now to pull from AppFolio"}
                  </td>
                </tr>
              ) : (
                sorted.map((wo) => {
                  const statusStyle = STATUS_STYLES[wo.status] || STATUS_STYLES.open;
                  const priorityStyle =
                    PRIORITY_STYLES[wo.priority || "Normal"] ||
                    PRIORITY_STYLES.Normal;

                  return (
                    <tr
                      key={wo.id}
                      className="border-b border-gray-50/80 hover:bg-white/40 transition-colors"
                    >
                      {/* WO # */}
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {wo.wo_number || wo.appfolio_id.slice(0, 8)}
                      </td>

                      {/* Property */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">
                          {wo.property_name}
                        </span>
                        {wo.property_address && (
                          <span className="block text-[11px] text-gray-400 truncate max-w-[200px]">
                            {wo.property_address}
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[250px] truncate hidden lg:table-cell">
                        {wo.description}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}
                        >
                          {wo.priority || "Normal"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {statusStyle.label}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                        {formatDate(wo.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/maintenance/invoices?from_wo=${wo.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          Create Invoice
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {!loading && sorted.length > 0 && (
        <p className="text-center text-[10px] text-gray-300 pb-8">
          {sorted.length} work orders • Last synced{" "}
          {workOrders[0]?.synced_at
            ? formatDate(workOrders[0].synced_at)
            : "never"}
        </p>
      )}
    </div>
  );
}
