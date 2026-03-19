"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Upload,
  MapPin,
  Search,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Users,
  Calendar,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

interface Inspection {
  id: string;
  property_name: string | null;
  address_1: string | null;
  unit_name: string | null;
  city: string | null;
  inspection_type: string | null;
  due_date: string | null;
  priority: string | null;
  assigned_to: string | null;
  status: string;
  resident_name: string | null;
  created_at: string;
}

interface InspectionStats {
  total: number;
  overdue: number;
  this_week: number;
  completed: number;
  unassigned: number;
  assignees: string[];
}

type InspectionStatus =
  | "imported"
  | "validated"
  | "queued"
  | "planned"
  | "dispatched"
  | "in_progress"
  | "completed";

const STATUS_OPTIONS: { value: InspectionStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "imported", label: "Imported" },
  { value: "validated", label: "Validated" },
  { value: "queued", label: "Queued" },
  { value: "planned", label: "Planned" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const CITY_OPTIONS = [
  "",
  "Bend",
  "Redmond",
  "Sisters",
  "Prineville",
  "La Pine",
  "Madras",
  "Metolius",
];

const STATUS_BADGE: Record<string, string> = {
  imported: "bg-charcoal-100 text-charcoal-700",
  validated: "bg-blue-100 text-blue-700",
  queued: "bg-amber-100 text-amber-700",
  planned: "bg-indigo-100 text-indigo-700",
  dispatched: "bg-purple-100 text-purple-700",
  in_progress: "bg-emerald-100 text-emerald-700",
  completed: "bg-green-100 text-green-700",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-700",
  normal: "bg-charcoal-100 text-charcoal-600",
  low: "bg-charcoal-50 text-charcoal-500",
};

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function dueDateClass(due: string | null): string {
  if (!due) return "text-charcoal-400";
  const now = new Date();
  const d = new Date(due);
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "text-red-600 font-medium";
  if (diffDays <= 7) return "text-amber-600 font-medium";
  return "text-green-600";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────

export function InspectionDashboard() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<InspectionStats | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [geocoding, setGeocoding] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk actions
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkActioning, setBulkActioning] = useState(false);

  // ── Fetch inspections ──
  const fetchInspections = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterCity) params.set("city", filterCity);
      if (filterAssignee) params.set("assigned_to", filterAssignee);
      if (searchQuery) params.set("q", searchQuery);
      const qs = params.toString();
      const res = await fetch(`/api/inspections${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch inspections");
      const data = await res.json();
      setInspections(data.inspections || []);
    } catch (err) {
      console.error("Fetch inspections error:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCity, filterAssignee, searchQuery]);

  // ── Fetch stats ──
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/inspections/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Fetch stats error:", err);
    }
  }, []);

  useEffect(() => {
    fetchInspections();
    fetchStats();
  }, [fetchInspections, fetchStats]);

  // ── Batch geocode ──
  const handleBatchGeocode = async () => {
    setGeocoding(true);
    try {
      const res = await fetch("/api/inspections/geocode", { method: "POST" });
      if (!res.ok) throw new Error("Geocode failed");
      await fetchInspections();
    } catch (err) {
      console.error("Geocode error:", err);
    } finally {
      setGeocoding(false);
    }
  };

  // ── Bulk assign ──
  const handleBulkAssign = async () => {
    if (!bulkAssignee) return;
    setBulkActioning(true);
    try {
      const res = await fetch("/api/inspections/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
          action: "assign",
          value: bulkAssignee,
        }),
      });
      if (!res.ok) throw new Error("Bulk assign failed");
      await fetchInspections();
      await fetchStats();
      setSelected(new Set());
      setBulkAssignee("");
    } catch (err) {
      console.error("Bulk assign error:", err);
    } finally {
      setBulkActioning(false);
    }
  };

  // ── Bulk status change ──
  const handleBulkStatus = async () => {
    if (!bulkStatus) return;
    setBulkActioning(true);
    try {
      const res = await fetch("/api/inspections/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
          action: "status",
          value: bulkStatus,
        }),
      });
      if (!res.ok) throw new Error("Bulk status change failed");
      await fetchInspections();
      await fetchStats();
      setSelected(new Set());
      setBulkStatus("");
    } catch (err) {
      console.error("Bulk status error:", err);
    } finally {
      setBulkActioning(false);
    }
  };

  // ── Bulk add to route ──
  const handleAddToRoute = async () => {
    setBulkActioning(true);
    try {
      const res = await fetch("/api/inspections/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
          action: "add_to_route",
        }),
      });
      if (!res.ok) throw new Error("Add to route failed");
      await fetchInspections();
      setSelected(new Set());
    } catch (err) {
      console.error("Add to route error:", err);
    } finally {
      setBulkActioning(false);
    }
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
    if (selected.size === inspections.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(inspections.map((i) => i.id)));
    }
  };

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 animate-spin text-charcoal-400" />
        <span className="ml-3 text-charcoal-500">Loading inspections...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Inspection Queue</h1>
          <p className="text-charcoal-500 text-sm mt-1">
            {stats?.total ?? inspections.length} inspection{(stats?.total ?? inspections.length) !== 1 ? "s" : ""} in queue
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/maintenance/inspections/import"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              "bg-terra-500 text-white hover:bg-terra-600"
            )}
          >
            <Upload className="w-4 h-4" />
            Import Inspections
          </Link>
          <button
            onClick={handleBatchGeocode}
            disabled={geocoding}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              "border border-charcoal-300 text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-60"
            )}
          >
            <MapPin className={cn("w-4 h-4", geocoding && "animate-pulse")} />
            {geocoding ? "Geocoding..." : "Batch Geocode"}
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-charcoal-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-charcoal-500">Total in Queue</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border border-charcoal-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-charcoal-500">Overdue</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </div>
          <div className="bg-white rounded-lg border border-charcoal-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-charcoal-500">This Week</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.this_week}</p>
          </div>
          <div className="bg-white rounded-lg border border-charcoal-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-charcoal-500">Completed</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-lg border border-charcoal-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-charcoal-500" />
              <span className="text-xs font-medium text-charcoal-500">Unassigned</span>
            </div>
            <p className="text-2xl font-bold text-charcoal-700">{stats.unassigned}</p>
          </div>
        </div>
      )}

      {/* ── Filters Row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none bg-white border border-charcoal-300 rounded-lg px-3 py-2 pr-8 text-sm text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-terra-400 focus:border-transparent"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="appearance-none bg-white border border-charcoal-300 rounded-lg px-3 py-2 pr-8 text-sm text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-terra-400 focus:border-transparent"
          >
            <option value="">All Cities</option>
            {CITY_OPTIONS.filter(Boolean).map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="appearance-none bg-white border border-charcoal-300 rounded-lg px-3 py-2 pr-8 text-sm text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-terra-400 focus:border-transparent"
          >
            <option value="">All Assignees</option>
            {(stats?.assignees ?? []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400 pointer-events-none" />
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
          <input
            type="text"
            placeholder="Search by address, tenant, or property..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-charcoal-300 rounded-lg pl-9 pr-3 py-2 text-sm text-charcoal-700 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-terra-400 focus:border-transparent"
          />
        </div>
      </div>

      {/* ── Bulk Action Bar ── */}
      {selected.size > 0 && (
        <div className="bg-charcoal-900 text-white rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <select
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
                className="appearance-none bg-white/10 border border-white/20 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40"
              >
                <option value="">Assign To...</option>
                {(stats?.assignees ?? []).map((name) => (
                  <option key={name} value={name} className="text-charcoal-900">
                    {name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkAssignee || bulkActioning}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-40"
              >
                Assign
              </button>
            </div>

            <div className="w-px h-5 bg-white/20" />

            <div className="flex items-center gap-2">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="appearance-none bg-white/10 border border-white/20 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40"
              >
                <option value="">Change Status...</option>
                {STATUS_OPTIONS.filter((o) => o.value).map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-charcoal-900">
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkStatus}
                disabled={!bulkStatus || bulkActioning}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-40"
              >
                Update
              </button>
            </div>

            <div className="w-px h-5 bg-white/20" />

            <button
              onClick={handleAddToRoute}
              disabled={bulkActioning}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                "bg-white text-charcoal-900 hover:bg-charcoal-100 disabled:opacity-60"
              )}
            >
              {bulkActioning ? "Processing..." : "Add to Route"}
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {inspections.length === 0 ? (
        <div className="text-center py-16 text-charcoal-400">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-charcoal-300" />
          <p className="font-medium">No inspections yet</p>
          <p className="text-sm mt-1">
            Import a spreadsheet to get started.
          </p>
          <Link
            href="/maintenance/inspections/import"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-terra-500 text-white hover:bg-terra-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Inspections
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-charcoal-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-charcoal-50 border-b border-charcoal-200">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === inspections.length && inspections.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-charcoal-300"
                    />
                  </th>
                  <th className="text-left px-3 py-3 font-semibold text-charcoal-600">Property</th>
                  <th className="text-left px-3 py-3 font-semibold text-charcoal-600 w-20">Unit</th>
                  <th className="text-left px-3 py-3 font-semibold text-charcoal-600">Type</th>
                  <th className="text-left px-3 py-3 font-semibold text-charcoal-600">Due Date</th>
                  <th className="text-left px-3 py-3 font-semibold text-charcoal-600">Priority</th>
                  <th className="text-left px-3 py-3 font-semibold text-charcoal-600 hidden lg:table-cell">Assigned To</th>
                  <th className="text-left px-3 py-3 font-semibold text-charcoal-600">Status</th>
                  <th className="text-left px-3 py-3 font-semibold text-charcoal-600 hidden md:table-cell">City</th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100">
                {inspections.map((insp) => (
                  <tr
                    key={insp.id}
                    className={cn(
                      "hover:bg-charcoal-50 transition-colors",
                      selected.has(insp.id) && "bg-terra-50"
                    )}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(insp.id)}
                        onChange={() => toggleSelect(insp.id)}
                        className="rounded border-charcoal-300"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-charcoal-900 truncate max-w-[200px]">
                        {insp.property_name || insp.address_1 || "\u2014"}
                      </div>
                      {insp.address_1 && insp.property_name && (
                        <div className="text-xs text-charcoal-400 truncate max-w-[200px]">
                          {insp.address_1}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-charcoal-600">
                      {insp.unit_name || "\u2014"}
                    </td>
                    <td className="px-3 py-3">
                      {insp.inspection_type ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          {insp.inspection_type}
                        </span>
                      ) : (
                        <span className="text-charcoal-400">\u2014</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs", dueDateClass(insp.due_date))}>
                        {formatDate(insp.due_date)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {insp.priority ? (
                        <span
                          className={cn(
                            "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                            PRIORITY_BADGE[insp.priority] ?? "bg-charcoal-100 text-charcoal-600"
                          )}
                        >
                          {insp.priority.charAt(0).toUpperCase() + insp.priority.slice(1)}
                        </span>
                      ) : (
                        <span className="text-charcoal-400">\u2014</span>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span className="text-charcoal-600 truncate max-w-[120px] block">
                        {insp.assigned_to || "\u2014"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                          STATUS_BADGE[insp.status] ?? "bg-charcoal-100 text-charcoal-600"
                        )}
                      >
                        {formatStatus(insp.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="text-charcoal-500">{insp.city || "\u2014"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        title="Actions"
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          "text-charcoal-400 hover:text-charcoal-900 hover:bg-charcoal-100"
                        )}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
