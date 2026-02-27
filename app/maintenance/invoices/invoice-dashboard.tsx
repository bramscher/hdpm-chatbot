"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Receipt,
  RefreshCw,
  Search,
  Wrench,
  FileText,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WorkOrderRow, HdmsInvoice } from "@/lib/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CsvUploader } from "./csv-uploader";
import { WorkOrderTable } from "./work-order-table";
import { InvoiceForm } from "./invoice-form";
import { InvoiceList } from "./invoice-list";

// ============================================
// Work Order Types (mirrors lib/work-orders.ts)
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

// ============================================
// Style maps
// ============================================

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-blue-100/80", text: "text-blue-700", label: "Open" },
  done: { bg: "bg-emerald-100/80", text: "text-emerald-700", label: "Done" },
  closed: { bg: "bg-gray-100/80", text: "text-gray-500", label: "Closed" },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  Emergency: { bg: "bg-red-100/80", text: "text-red-700" },
  Urgent: { bg: "bg-red-100/80", text: "text-red-700" },
  High: { bg: "bg-orange-100/80", text: "text-orange-700" },
  Normal: { bg: "bg-gray-100/80", text: "text-gray-600" },
  Low: { bg: "bg-gray-50/80", text: "text-gray-400" },
};

// ============================================
// Sort types
// ============================================

type SortField = "property_name" | "status" | "priority" | "created_at" | "completed_date";

// ============================================
// Pill toggle
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
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isActive = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-all duration-200 ${
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
// Main Dashboard
// ============================================

type View = "upload" | "table" | "form";

interface InvoiceDashboardProps {
  userEmail: string;
  userName: string;
}

export function InvoiceDashboard({ userEmail, userName }: InvoiceDashboardProps) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("upload");
  const [parsedRows, setParsedRows] = useState<WorkOrderRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<WorkOrderRow | null>(null);
  const [editInvoice, setEditInvoice] = useState<HdmsInvoice | null>(null);
  const [fromPdfScan, setFromPdfScan] = useState(false);
  const [fromWorkOrder, setFromWorkOrder] = useState(false);
  const [invoices, setInvoices] = useState<HdmsInvoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);

  // Work orders state
  const [woExpanded, setWoExpanded] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [woStats, setWoStats] = useState<WorkOrderStats | null>(null);
  const [woLoading, setWoLoading] = useState(true);
  const [woSyncing, setWoSyncing] = useState(false);
  const [woSyncMessage, setWoSyncMessage] = useState<string | null>(null);
  const [woStatusFilter, setWoStatusFilter] = useState<("open" | "closed" | "done")[]>([]);
  const [woPriorityFilter, setWoPriorityFilter] = useState<string[]>([]);
  const [woSearchInput, setWoSearchInput] = useState("");
  const [woSearch, setWoSearch] = useState("");
  const [woSortField, setWoSortField] = useState<SortField>("created_at");
  const [woSortDir, setWoSortDir] = useState<"asc" | "desc">("desc");

  // ============================================
  // Invoice fetching
  // ============================================

  const fetchInvoices = useCallback(async () => {
    setIsLoadingInvoices(true);
    try {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      if (res.ok) {
        setInvoices(data.invoices);
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // ============================================
  // Work order fetching
  // ============================================

  const fetchWorkOrders = useCallback(async () => {
    setWoLoading(true);
    try {
      const params = new URLSearchParams();
      if (woStatusFilter.length) params.set("status", woStatusFilter.join(","));
      if (woPriorityFilter.length) params.set("priority", woPriorityFilter.join(","));
      if (woSearch) params.set("search", woSearch);
      const qs = params.toString();
      const res = await fetch(`/api/work-orders${qs ? `?${qs}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setWorkOrders(data.workOrders || []);
        setWoStats(data.stats || null);
      }
    } catch (err) {
      console.error("Failed to fetch work orders:", err);
    } finally {
      setWoLoading(false);
    }
  }, [woStatusFilter, woPriorityFilter, woSearch]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Search debounce
  useEffect(() => {
    const timeout = setTimeout(() => setWoSearch(woSearchInput || ""), 300);
    return () => clearTimeout(timeout);
  }, [woSearchInput]);

  // ============================================
  // Handle ?from_wo= parameter
  // ============================================

  useEffect(() => {
    const fromWo = searchParams.get("from_wo");
    if (!fromWo) return;

    async function loadWorkOrder(woId: string) {
      try {
        const res = await fetch(`/api/work-orders/${woId}`);
        if (!res.ok) return;
        const data = await res.json();
        const wo = data.workOrder;
        if (!wo) return;

        const row: WorkOrderRow = {
          wo_number: wo.wo_number || wo.appfolio_id || "",
          property_name: wo.property_name || "",
          property_address: wo.property_address || "",
          unit: wo.unit_name || "",
          description: wo.description || "",
          completed_date: wo.completed_date
            ? new Date(wo.completed_date).toISOString().split("T")[0]
            : "",
          category: wo.category || "",
          assigned_to: wo.assigned_to || "",
          work_order_id: wo.id,
        };
        setSelectedRow(row);
        setEditInvoice(null);
        setFromPdfScan(false);
        setFromWorkOrder(true);
        setView("form");
      } catch (err) {
        console.error("Failed to load work order:", err);
      }
    }

    loadWorkOrder(fromWo);
  }, [searchParams]);

  // ============================================
  // Work order sync
  // ============================================

  async function handleWoSync() {
    setWoSyncing(true);
    setWoSyncMessage(null);
    try {
      const res = await fetch("/api/sync/work-orders", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setWoSyncMessage(`Synced ${data.synced} work orders from AppFolio`);
        fetchWorkOrders();
      } else {
        setWoSyncMessage(`Sync error: ${data.error}`);
      }
    } catch {
      setWoSyncMessage("Sync failed — check console");
    } finally {
      setWoSyncing(false);
      setTimeout(() => setWoSyncMessage(null), 5000);
    }
  }

  // ============================================
  // Work order sort + filter helpers
  // ============================================

  function toggle<T extends string>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  const sortedWo = useMemo(() => {
    const arr = [...workOrders];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (woSortField) {
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
      return woSortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [workOrders, woSortField, woSortDir]);

  function handleWoSort(field: SortField) {
    if (woSortField === field) {
      setWoSortDir(woSortDir === "asc" ? "desc" : "asc");
    } else {
      setWoSortField(field);
      setWoSortDir(field === "created_at" ? "desc" : "asc");
    }
  }

  function WoSortIcon({ field }: { field: SortField }) {
    if (woSortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-300" />;
    return woSortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-emerald-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-600" />
    );
  }

  // Create invoice from work order
  function handleCreateInvoiceFromWo(wo: WorkOrder) {
    const row: WorkOrderRow = {
      wo_number: wo.wo_number || wo.appfolio_id || "",
      property_name: wo.property_name || "",
      property_address: wo.property_address || "",
      unit: wo.unit_name || "",
      description: wo.description || "",
      completed_date: wo.completed_date
        ? new Date(wo.completed_date).toISOString().split("T")[0]
        : "",
      category: wo.category || "",
      assigned_to: wo.assigned_to || "",
      work_order_id: wo.id,
    };
    setSelectedRow(row);
    setEditInvoice(null);
    setFromPdfScan(false);
    setFromWorkOrder(true);
    setView("form");
  }

  // CSV export
  function handleWoExportCsv() {
    const headers = ["WO #", "Property", "Address", "Description", "Priority", "Status", "Assigned To", "Created", "Completed"];
    const rows = sortedWo.map((wo) => [
      wo.wo_number || wo.appfolio_id,
      wo.property_name,
      wo.property_address || "",
      wo.description,
      wo.priority || "",
      wo.status,
      wo.assigned_to || "",
      wo.created_at ? new Date(wo.created_at).toLocaleDateString() : "",
      wo.completed_date ? new Date(wo.completed_date).toLocaleDateString() : "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
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
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  }

  const woHasFilters = woStatusFilter.length > 0 || woPriorityFilter.length > 0 || !!woSearch;

  // ============================================
  // CSV / PDF handlers
  // ============================================

  function handleCsvParsed(rows: WorkOrderRow[]) {
    setParsedRows(rows);
    setView("table");
  }

  function handlePdfScanned(fields: Record<string, unknown>) {
    // Parse line_items from the scanned PDF response
    const rawLineItems = Array.isArray(fields.line_items) ? fields.line_items : [];
    const lineItems = rawLineItems.map((li: Record<string, unknown>) => ({
      account: String(li.account || ""),
      description: String(li.description || ""),
      type: (String(li.type || "labor") as "labor" | "materials" | "other"),
      amount: parseFloat(String(li.amount || "0")) || 0,
    }));

    // Parse task_items array
    const rawTaskItems = Array.isArray(fields.task_items) ? fields.task_items : [];
    const taskItems = rawTaskItems.map((t: unknown) => String(t)).filter(Boolean);

    const row: WorkOrderRow = {
      wo_number: String(fields.wo_number || ""),
      property_name: String(fields.property_name || ""),
      property_address: String(fields.property_address || ""),
      unit: String(fields.unit || ""),
      description: String(fields.description || ""),
      completed_date: String(fields.completed_date || ""),
      category: String(fields.category || ""),
      assigned_to: String(fields.assigned_to || ""),
      technician: String(fields.technician || ""),
      technician_notes: String(fields.technician_notes || ""),
      status: String(fields.status || ""),
      created_date: String(fields.created_date || ""),
      scheduled_date: String(fields.scheduled_date || ""),
      permission_to_enter: String(fields.permission_to_enter || ""),
      maintenance_limit: String(fields.maintenance_limit || ""),
      pets: String(fields.pets || ""),
      estimate_amount: String(fields.estimate_amount || ""),
      vendor_instructions: String(fields.vendor_instructions || ""),
      property_notes: String(fields.property_notes || ""),
      created_by: String(fields.created_by || ""),
      labor_amount: String(fields.labor_amount || ""),
      materials_amount: String(fields.materials_amount || ""),
      total_amount: String(fields.total_amount || ""),
      task_items: taskItems.length > 0 ? taskItems : undefined,
      line_items: lineItems.length > 0 ? lineItems : undefined,
    };
    setSelectedRow(row);
    setEditInvoice(null);
    setFromPdfScan(true);
    setFromWorkOrder(false);
    setView("form");
  }

  function handleSelectRow(row: WorkOrderRow) {
    setSelectedRow(row);
    setEditInvoice(null);
    setFromPdfScan(false);
    setFromWorkOrder(false);
    setView("form");
  }

  function handleEditInvoice(invoice: HdmsInvoice) {
    setEditInvoice(invoice);
    setSelectedRow(null);
    setView("form");
  }

  function handleInvoiceSaved() {
    fetchInvoices();
    setView("upload");
    setSelectedRow(null);
    setEditInvoice(null);
    setFromPdfScan(false);
    setFromWorkOrder(false);
  }

  function handleBackToUpload() {
    setView("upload");
    setParsedRows([]);
  }

  function handleBackFromForm() {
    if (editInvoice || fromPdfScan || fromWorkOrder) {
      setView("upload");
      setEditInvoice(null);
      setFromPdfScan(false);
      setFromWorkOrder(false);
    } else {
      setView("table");
    }
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center shadow-glow">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice Generator</h1>
            <p className="text-sm text-gray-500">
              High Desert Maintenance Services
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {view === "upload" && (
        <div className="space-y-6">
          {/* CSV / PDF Upload */}
          <CsvUploader onParsed={handleCsvParsed} onPdfScanned={handlePdfScanned} />

          {/* ============================== */}
          {/* AppFolio Work Orders Section   */}
          {/* ============================== */}
          <div className="glass glass-shine rounded-2xl overflow-hidden">
            {/* Section header */}
            <button
              type="button"
              onClick={() => setWoExpanded(!woExpanded)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-gray-800">
                    AppFolio Work Orders
                  </span>
                  <span className="block text-[10px] text-gray-400">
                    Select a work order to create an invoice
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {woStats && !woLoading && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-blue-600 font-medium">{woStats.open} open</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-emerald-600 font-medium">{woStats.done} done</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-400">{woStats.closed} closed</span>
                  </div>
                )}
                {woExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>

            {woExpanded && (
              <div className="border-t border-white/30">
                {/* Sync bar */}
                <div className="flex items-center justify-between px-5 py-3 bg-white/20">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleWoSync(); }}
                      disabled={woSyncing}
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs h-7 px-3"
                    >
                      {woSyncing ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      {woSyncing ? "Syncing..." : "Sync Now"}
                    </Button>
                    {woSyncMessage && (
                      <span className="text-[11px] text-emerald-600">{woSyncMessage}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleWoExportCsv}
                      disabled={sortedWo.length === 0}
                      className="text-gray-400 hover:text-gray-600 text-[10px] h-7"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      CSV
                    </Button>
                  </div>
                </div>

                {/* Filters row */}
                <div className="px-5 py-3 space-y-2.5 bg-white/10 border-t border-white/20">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-gray-400 uppercase">Status:</span>
                      <PillToggle<"open" | "closed" | "done">
                        options={["open", "done", "closed"]}
                        selected={woStatusFilter}
                        onToggle={(s) => setWoStatusFilter(toggle(woStatusFilter, s))}
                        labelFn={(s) => STATUS_STYLES[s]?.label || s}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-gray-400 uppercase">Priority:</span>
                      <PillToggle<string>
                        options={["Emergency", "Urgent", "High", "Normal", "Low"]}
                        selected={woPriorityFilter}
                        onToggle={(p) => setWoPriorityFilter(toggle(woPriorityFilter, p))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative max-w-xs flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search property, address, WO#..."
                        value={woSearchInput}
                        onChange={(e) => setWoSearchInput(e.target.value)}
                        className="pl-7 h-7 text-xs bg-white/70"
                      />
                    </div>
                    {woHasFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setWoStatusFilter([]); setWoPriorityFilter([]); setWoSearchInput(""); }}
                        className="text-gray-400 hover:text-gray-600 text-[10px] h-7"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100/80 border-t border-t-white/20">
                        <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                          WO #
                        </th>
                        <th
                          className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600"
                          onClick={() => handleWoSort("property_name")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Property <WoSortIcon field="property_name" />
                          </span>
                        </th>
                        <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden lg:table-cell">
                          Description
                        </th>
                        <th
                          className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600"
                          onClick={() => handleWoSort("priority")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Priority <WoSortIcon field="priority" />
                          </span>
                        </th>
                        <th
                          className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600"
                          onClick={() => handleWoSort("status")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Status <WoSortIcon field="status" />
                          </span>
                        </th>
                        <th
                          className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600 hidden md:table-cell"
                          onClick={() => handleWoSort("created_at")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Created <WoSortIcon field="created_at" />
                          </span>
                        </th>
                        <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {woLoading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500 mx-auto" />
                          </td>
                        </tr>
                      ) : sortedWo.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-xs">
                            {woHasFilters
                              ? "No work orders match the current filters"
                              : "No work orders yet — click Sync Now to pull from AppFolio"}
                          </td>
                        </tr>
                      ) : (
                        sortedWo.map((wo) => {
                          const statusStyle = STATUS_STYLES[wo.status] || STATUS_STYLES.open;
                          const priorityStyle = PRIORITY_STYLES[wo.priority || "Normal"] || PRIORITY_STYLES.Normal;

                          return (
                            <tr
                              key={wo.id}
                              className="border-b border-gray-50/80 hover:bg-white/40 transition-colors"
                            >
                              <td className="px-4 py-2.5 text-gray-600 font-mono text-[11px]">
                                {wo.wo_number || wo.appfolio_id.slice(0, 8)}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="font-medium text-gray-800 text-xs">
                                  {wo.property_name}
                                </span>
                                {wo.property_address && (
                                  <span className="block text-[10px] text-gray-400 truncate max-w-[180px]">
                                    {wo.property_address}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 text-[11px] max-w-[200px] truncate hidden lg:table-cell">
                                {wo.description}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}>
                                  {wo.priority || "Normal"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                                  {statusStyle.label}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 text-[11px] hidden md:table-cell">
                                {formatDate(wo.created_at)}
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleCreateInvoiceFromWo(wo)}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
                                >
                                  <FileText className="h-3 w-3" />
                                  Create Invoice
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                {!woLoading && sortedWo.length > 0 && (
                  <div className="px-5 py-2.5 text-center text-[10px] text-gray-300 border-t border-white/20">
                    {sortedWo.length} work order{sortedWo.length !== 1 ? "s" : ""} • Last synced{" "}
                    {workOrders[0]?.synced_at ? formatDate(workOrders[0].synced_at) : "never"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invoice List */}
          <InvoiceList
            invoices={invoices}
            onRefresh={fetchInvoices}
            onEdit={handleEditInvoice}
            isLoading={isLoadingInvoices}
          />
        </div>
      )}

      {view === "table" && (
        <WorkOrderTable
          rows={parsedRows}
          onSelectRow={handleSelectRow}
          onBack={handleBackToUpload}
        />
      )}

      {view === "form" && (
        <InvoiceForm
          workOrder={selectedRow}
          editInvoice={editInvoice}
          onBack={handleBackFromForm}
          onSaved={handleInvoiceSaved}
        />
      )}
    </div>
  );
}
