"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ArrowLeft, Save, FileDown, Loader2, Trash2, Wrench, Package, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkOrderRow, HdmsInvoice, LineItem } from "@/lib/invoices";

interface InvoiceFormProps {
  workOrder: WorkOrderRow | null;
  editInvoice: HdmsInvoice | null;
  onBack: () => void;
  onSaved: (invoice: HdmsInvoice) => void;
}

type LineItemType = "labor" | "materials" | "other";

interface FormLineItem {
  id: string;
  type: LineItemType;
  account: string;
  description: string;
  amount: string;
}

let nextLineItemId = 1;
function newLineItemId(): string {
  return `li_${nextLineItemId++}`;
}

function blankLineItem(type: LineItemType = "labor"): FormLineItem {
  return { id: newLineItemId(), type, account: "", description: "", amount: "0.00" };
}

const TYPE_STYLES: Record<LineItemType, { bg: string; text: string; label: string; icon: typeof Wrench }> = {
  labor: { bg: "bg-blue-50", text: "text-blue-700", label: "Labor", icon: Wrench },
  materials: { bg: "bg-amber-50", text: "text-amber-700", label: "Materials", icon: Package },
  other: { bg: "bg-gray-50", text: "text-gray-600", label: "Other", icon: Wrench },
};

export function InvoiceForm({ workOrder, editInvoice, onBack, onSaved }: InvoiceFormProps) {
  // Header fields
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [woReference, setWoReference] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<FormLineItem[]>([blankLineItem()]);

  // Scanned extra fields (read-only context shown to user)
  const [scannedMeta, setScannedMeta] = useState<{
    technician?: string;
    technicianNotes?: string;
    status?: string;
    createdDate?: string;
    scheduledDate?: string;
    permissionToEnter?: string;
    maintenanceLimit?: string;
    pets?: string;
    estimateAmount?: string;
    vendorInstructions?: string;
    propertyNotes?: string;
    createdBy?: string;
  }>({});

  const [taskItems, setTaskItems] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechNotes, setShowTechNotes] = useState(false);
  const [showTaskList, setShowTaskList] = useState(false);

  // AI rewrite state
  const [rewritingId, setRewritingId] = useState<string | null>(null);

  // Auto-save state
  const userHasEdited = useRef(false);
  const savedInvoiceIdRef = useRef<string | null>(editInvoice?.id ?? null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isSavingRef = useRef(false);
  const isGeneratingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { isSavingRef.current = isSaving; }, [isSaving]);
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);

  // Computed totals
  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);
  }, [lineItems]);

  const laborTotal = useMemo(() => {
    return lineItems.filter((li) => li.type === "labor").reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);
  }, [lineItems]);

  const materialsTotal = useMemo(() => {
    return lineItems.filter((li) => li.type === "materials").reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);
  }, [lineItems]);

  // ── Pre-populate from work order or existing invoice ──────────
  useEffect(() => {
    // Reset auto-save state
    userHasEdited.current = false;
    setSaveStatus("idle");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    if (editInvoice) {
      savedInvoiceIdRef.current = editInvoice.id;
      setPropertyName(editInvoice.property_name);
      setPropertyAddress(editInvoice.property_address);
      setWoReference(editInvoice.wo_reference || "");
      setCompletedDate(editInvoice.completed_date || "");
      setInternalNotes(editInvoice.internal_notes || "");

      // Load line items from invoice if present
      if (editInvoice.line_items && editInvoice.line_items.length > 0) {
        setLineItems(
          editInvoice.line_items.map((li) => ({
            id: newLineItemId(),
            type: (li.type as LineItemType) || "labor",
            account: li.account || "",
            description: li.description,
            amount: li.amount.toFixed(2),
          }))
        );
      } else {
        // Legacy invoices without line items — put description into labor line
        const items: FormLineItem[] = [];
        if (editInvoice.labor_amount > 0) {
          items.push({
            id: newLineItemId(),
            type: "labor",
            account: "",
            description: editInvoice.description || "Labor",
            amount: editInvoice.labor_amount.toFixed(2),
          });
        }
        if (editInvoice.materials_amount > 0) {
          items.push({
            id: newLineItemId(),
            type: "materials",
            account: "",
            description: "Materials",
            amount: editInvoice.materials_amount.toFixed(2),
          });
        }
        if (items.length === 0) {
          items.push({
            id: newLineItemId(),
            type: "labor",
            account: "",
            description: editInvoice.description || "",
            amount: "0.00",
          });
        }
        setLineItems(items);
      }
    } else if (workOrder) {
      savedInvoiceIdRef.current = null;
      setPropertyName(workOrder.property_name);
      setPropertyAddress(workOrder.property_address);
      setWoReference(workOrder.wo_number);
      setCompletedDate(workOrder.completed_date);

      // Load line items from scanned PDF
      if (workOrder.line_items && workOrder.line_items.length > 0) {
        // Financial WO with pre-priced line items from Details table
        setLineItems(
          workOrder.line_items.map((li) => ({
            id: newLineItemId(),
            type: (li.type as LineItemType) || "labor",
            account: li.account || "",
            description: li.description,
            amount: li.amount.toFixed(2),
          }))
        );
      } else if (workOrder.task_items && workOrder.task_items.length > 0) {
        // Task-list WO — roll all tasks into a single Labor line + a Materials line
        const taskSummary = workOrder.task_items.join("; ");
        const items: FormLineItem[] = [
          {
            id: newLineItemId(),
            type: "labor",
            account: "",
            description: `Labor – ${taskSummary}`,
            amount: "0.00",
          },
          {
            id: newLineItemId(),
            type: "materials",
            account: "",
            description: "Materials",
            amount: "0.00",
          },
        ];
        setLineItems(items);
      } else {
        // Fall back to legacy amounts — put description into labor line
        const items: FormLineItem[] = [];
        if (workOrder.labor_amount && parseFloat(workOrder.labor_amount) > 0) {
          items.push({
            id: newLineItemId(),
            type: "labor",
            account: "",
            description: workOrder.description || "Labor",
            amount: workOrder.labor_amount,
          });
        } else {
          // No amounts yet — just put the description in a labor line
          items.push({
            id: newLineItemId(),
            type: "labor",
            account: "",
            description: workOrder.description || "",
            amount: "0.00",
          });
        }
        if (workOrder.materials_amount && parseFloat(workOrder.materials_amount) > 0) {
          items.push({
            id: newLineItemId(),
            type: "materials",
            account: "",
            description: "Materials",
            amount: workOrder.materials_amount,
          });
        }
        setLineItems(items);
      }

      // Store task items for reference
      if (workOrder.task_items && workOrder.task_items.length > 0) {
        setTaskItems(workOrder.task_items);
      }

      // Store scanned metadata for context
      setScannedMeta({
        technician: workOrder.technician || undefined,
        technicianNotes: workOrder.technician_notes || undefined,
        status: workOrder.status || undefined,
        createdDate: workOrder.created_date || undefined,
        scheduledDate: workOrder.scheduled_date || undefined,
        permissionToEnter: workOrder.permission_to_enter || undefined,
        maintenanceLimit: workOrder.maintenance_limit || undefined,
        pets: workOrder.pets || undefined,
        estimateAmount: workOrder.estimate_amount || undefined,
        vendorInstructions: workOrder.vendor_instructions || undefined,
        propertyNotes: workOrder.property_notes || undefined,
        createdBy: workOrder.created_by || undefined,
      });

      // Pre-fill internal notes with useful context
      const noteParts: string[] = [];
      if (workOrder.vendor_instructions) noteParts.push(`Vendor: ${workOrder.vendor_instructions}`);
      if (workOrder.property_notes) noteParts.push(`Notes: ${workOrder.property_notes}`);
      if (workOrder.technician || workOrder.created_by) noteParts.push(`Tech: ${workOrder.technician || workOrder.created_by}`);
      if (noteParts.length > 0) setInternalNotes(noteParts.join("\n"));
    } else {
      savedInvoiceIdRef.current = null;
    }
  }, [workOrder, editInvoice]);

  // ── Auto-save effect (debounced 2s) ──────────
  useEffect(() => {
    if (!userHasEdited.current) return;
    if (isSavingRef.current || isGeneratingRef.current) return;

    // Need at least property name and one line item with a description
    if (!propertyName.trim()) return;
    const hasDesc = lineItems.some((li) => li.description.trim());
    if (!hasDesc) return;

    setSaveStatus("unsaved");

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      if (isSavingRef.current || isGeneratingRef.current) return;

      setSaveStatus("saving");
      try {
        const payload = buildSavePayload();

        if (savedInvoiceIdRef.current) {
          const res = await fetch(`/api/invoices/${savedInvoiceIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          setSaveStatus(res.ok ? "saved" : "unsaved");
        } else {
          const res = await fetch("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (res.ok) {
            savedInvoiceIdRef.current = data.invoice.id;
            setSaveStatus("saved");
          } else {
            setSaveStatus("unsaved");
          }
        }
      } catch {
        setSaveStatus("unsaved");
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyName, propertyAddress, woReference, completedDate, internalNotes, lineItems]);

  // ── Warn before page unload if unsaved ──────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (userHasEdited.current && saveStatus !== "saved" && saveStatus !== "idle") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  // ── Line item CRUD ──────────
  function updateLineItem(id: string, field: keyof Omit<FormLineItem, "id">, value: string) {
    userHasEdited.current = true;
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  }

  function removeLineItem(id: string) {
    userHasEdited.current = true;
    setLineItems((prev) => {
      const filtered = prev.filter((li) => li.id !== id);
      return filtered.length === 0 ? [blankLineItem()] : filtered;
    });
  }

  function addLineItem(type: LineItemType = "labor") {
    userHasEdited.current = true;
    setLineItems((prev) => [...prev, blankLineItem(type)]);
  }

  function formatDateForInput(dateStr: string): string {
    if (!dateStr) return "";
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return parsed.toISOString().split("T")[0];
  }

  // ── Build save payload ──────────
  function buildSavePayload() {
    const validLineItems: LineItem[] = lineItems
      .filter((li) => li.description.trim())
      .map((li) => ({
        description: li.description.trim(),
        account: li.account.trim() || undefined,
        type: li.type,
        amount: parseFloat(li.amount) || 0,
      }));

    const computedTotal = validLineItems.reduce((sum, li) => sum + li.amount, 0);
    const computedLabor = validLineItems.filter((li) => li.type === "labor").reduce((sum, li) => sum + li.amount, 0);
    const computedMaterials = validLineItems.filter((li) => li.type === "materials").reduce((sum, li) => sum + li.amount, 0);

    // Auto-compose description from labor line items (shown on PDF)
    const laborDescs = validLineItems
      .filter((li) => li.type === "labor" && li.description)
      .map((li) => li.description);
    const composedDescription =
      laborDescs.join("; ") ||
      validLineItems.map((li) => li.description).filter(Boolean).join("; ") ||
      "Maintenance services performed";

    return {
      property_name: propertyName.trim(),
      property_address: propertyAddress.trim(),
      wo_reference: woReference.trim() || null,
      completed_date: formatDateForInput(completedDate) || null,
      description: composedDescription,
      labor_amount: computedLabor,
      materials_amount: computedMaterials,
      total_amount: computedTotal,
      line_items: validLineItems.length > 0 ? validLineItems : null,
      internal_notes: internalNotes.trim() || null,
    };
  }

  // ── AI rewrite handler ──────────
  async function handleAiRewrite(lineItemId: string) {
    const li = lineItems.find((l) => l.id === lineItemId);
    if (!li || !li.description.trim()) return;

    setRewritingId(lineItemId);
    try {
      const res = await fetch("/api/invoices/rewrite-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: li.description.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.rewritten) {
        userHasEdited.current = true;
        setLineItems((prev) =>
          prev.map((item) =>
            item.id === lineItemId ? { ...item, description: data.rewritten } : item
          )
        );
      }
    } catch (err) {
      console.error("AI rewrite failed:", err);
    } finally {
      setRewritingId(null);
    }
  }

  // ── Manual save / generate PDF ──────────
  async function handleSave(generatePdf: boolean) {
    setError(null);

    const hasDescription = lineItems.some((li) => li.description.trim());
    if (!propertyName.trim() || !propertyAddress.trim() || !hasDescription) {
      setError("Property name, address, and at least one line item description are required");
      return;
    }

    // Cancel any pending auto-save
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    const setter = generatePdf ? setIsGenerating : setIsSaving;
    setter(true);

    try {
      const payload = buildSavePayload();

      let invoice: HdmsInvoice;
      const existingId = savedInvoiceIdRef.current;

      if (existingId) {
        // Update existing (from editInvoice or auto-saved new)
        const res = await fetch(`/api/invoices/${existingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        invoice = data.invoice;
      } else {
        // Create new
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        invoice = data.invoice;
        savedInvoiceIdRef.current = invoice.id;
      }

      if (generatePdf) {
        const pdfRes = await fetch(`/api/invoices/${invoice.id}/generate-pdf`, {
          method: "POST",
        });
        const pdfData = await pdfRes.json();
        if (!pdfRes.ok) throw new Error(pdfData.error);
        invoice = pdfData.invoice;

        const dlRes = await fetch(`/api/invoices/${invoice.id}/download`);
        const dlData = await dlRes.json();
        if (dlRes.ok && dlData.downloadUrl) {
          window.open(dlData.downloadUrl, "_blank");
        }
      }

      setSaveStatus("saved");
      userHasEdited.current = false;
      onSaved(invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
      setIsGenerating(false);
    }
  }

  const isLoading = isSaving || isGenerating;
  const hasScannedMeta = Object.values(scannedMeta).some(Boolean);
  const unpricedCount = lineItems.filter((li) => li.description.trim() && (parseFloat(li.amount) || 0) === 0).length;

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isLoading}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h3 className="text-lg font-semibold text-gray-900">
          {editInvoice ? `Edit ${editInvoice.invoice_code}` : "New Invoice"}
        </h3>

        {/* Auto-save status indicator */}
        <div className="ml-auto">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-500">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          {saveStatus === "unsaved" && (
            <span className="flex items-center gap-1.5 text-xs text-amber-500">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="glass-heavy glass-elevated rounded-2xl p-6 space-y-6">
        {/* Property Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Property Name
            </label>
            <Input
              value={propertyName}
              onChange={(e) => { userHasEdited.current = true; setPropertyName(e.target.value); }}
              placeholder="Property name"
              disabled={isLoading}
              className="bg-white/70 backdrop-blur-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Property Address
            </label>
            <Input
              value={propertyAddress}
              onChange={(e) => { userHasEdited.current = true; setPropertyAddress(e.target.value); }}
              placeholder="Full address"
              disabled={isLoading}
              className="bg-white/70 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* WO Reference & Date */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Work Order Reference
            </label>
            <Input
              value={woReference}
              onChange={(e) => { userHasEdited.current = true; setWoReference(e.target.value); }}
              placeholder="WO #"
              disabled={isLoading}
              className="bg-white/70 backdrop-blur-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Completed Date
            </label>
            <Input
              type="date"
              value={formatDateForInput(completedDate)}
              onChange={(e) => { userHasEdited.current = true; setCompletedDate(e.target.value); }}
              disabled={isLoading}
              className="bg-white/70 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Scanned Work Order Context (if available) */}
        {hasScannedMeta && (
          <div className="rounded-xl bg-blue-50/60 border border-blue-200/40 px-4 py-3 space-y-2">
            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest">
              Work Order Details
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-xs text-gray-600">
              {scannedMeta.status && (
                <div><span className="font-medium text-gray-500">Status:</span> {scannedMeta.status}</div>
              )}
              {(scannedMeta.technician || scannedMeta.createdBy) && (
                <div><span className="font-medium text-gray-500">Technician:</span> {scannedMeta.technician || scannedMeta.createdBy}</div>
              )}
              {scannedMeta.createdDate && (
                <div><span className="font-medium text-gray-500">Created:</span> {scannedMeta.createdDate}</div>
              )}
              {scannedMeta.scheduledDate && (
                <div><span className="font-medium text-gray-500">Scheduled:</span> {scannedMeta.scheduledDate}</div>
              )}
              {scannedMeta.maintenanceLimit && (
                <div><span className="font-medium text-gray-500">Maint Limit:</span> ${scannedMeta.maintenanceLimit}</div>
              )}
              {scannedMeta.estimateAmount && (
                <div><span className="font-medium text-gray-500">Estimate:</span> ${scannedMeta.estimateAmount}</div>
              )}
              {scannedMeta.permissionToEnter && (
                <div><span className="font-medium text-gray-500">Permission:</span> {scannedMeta.permissionToEnter}</div>
              )}
              {scannedMeta.pets && (
                <div><span className="font-medium text-gray-500">Pets:</span> {scannedMeta.pets}</div>
              )}
            </div>
            {scannedMeta.vendorInstructions && (
              <p className="text-[11px] text-gray-500">
                <span className="font-medium">Vendor Instructions:</span> {scannedMeta.vendorInstructions}
              </p>
            )}
            {scannedMeta.propertyNotes && (
              <p className="text-[11px] text-gray-500">
                <span className="font-medium">Property Notes:</span> {scannedMeta.propertyNotes}
              </p>
            )}

            {/* Technician's Notes (expandable) */}
            {scannedMeta.technicianNotes && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowTechNotes(!showTechNotes)}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {showTechNotes ? "Hide" : "Show"} Technician&apos;s Notes
                </button>
                {showTechNotes && (
                  <div className="mt-1.5 p-3 bg-white/60 rounded-lg border border-blue-100/60 text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {scannedMeta.technicianNotes}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Task List Reference (collapsible, from scanned task-list WOs) */}
        {taskItems.length > 0 && (
          <div className="rounded-xl bg-emerald-50/50 border border-emerald-200/40 px-4 py-3">
            <button
              type="button"
              onClick={() => setShowTaskList(!showTaskList)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-widest">
                  Work Order Tasks ({taskItems.length})
                </p>
              </div>
              <span className="text-[11px] font-medium text-emerald-600">
                {showTaskList ? "Hide" : "Show"} Task List
              </span>
            </button>
            {showTaskList && (
              <ul className="mt-2 space-y-0.5 text-[11px] text-gray-600 list-disc list-inside max-h-48 overflow-y-auto">
                {taskItems.map((task, idx) => (
                  <li key={idx} className="leading-relaxed">{task}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ============================== */}
        {/* Line Items                     */}
        {/* ============================== */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                Line Items
              </label>
              {unpricedCount > 0 && (
                <p className="text-[10px] text-amber-600 mt-0.5">
                  {unpricedCount} item{unpricedCount !== 1 ? "s" : ""} need pricing
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addLineItem("labor")}
                disabled={isLoading}
                className="text-blue-600 hover:text-blue-800 text-xs h-7"
              >
                <Wrench className="h-3 w-3 mr-1" />
                + Labor
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addLineItem("materials")}
                disabled={isLoading}
                className="text-amber-600 hover:text-amber-800 text-xs h-7"
              >
                <Package className="h-3 w-3 mr-1" />
                + Materials
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200/60 bg-white/50 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[80px_1fr_3fr_100px_36px] gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-200/40 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              <span>Type</span>
              <span>Account</span>
              <span>Description</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {/* Table rows */}
            {lineItems.map((li, idx) => {
              const typeStyle = TYPE_STYLES[li.type];
              const isUnpriced = li.description.trim() && (parseFloat(li.amount) || 0) === 0;

              return (
                <div
                  key={li.id}
                  className={`grid grid-cols-[80px_1fr_3fr_100px_36px] gap-2 px-3 py-1.5 border-b border-gray-100/60 last:border-b-0 items-start ${
                    isUnpriced ? "bg-amber-50/30" : ""
                  }`}
                >
                  <select
                    value={li.type}
                    onChange={(e) => updateLineItem(li.id, "type", e.target.value)}
                    disabled={isLoading}
                    className={`h-8 text-[10px] font-medium rounded-lg border border-gray-200/40 px-1.5 ${typeStyle.bg} ${typeStyle.text} cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600/30`}
                  >
                    <option value="labor">Labor</option>
                    <option value="materials">Materials</option>
                    <option value="other">Other</option>
                  </select>
                  <Input
                    value={li.account}
                    onChange={(e) => updateLineItem(li.id, "account", e.target.value)}
                    placeholder="Account"
                    disabled={isLoading}
                    className="h-8 text-xs bg-transparent border-gray-200/40"
                  />
                  {/* Description with AI rewrite button */}
                  <div className="relative">
                    <textarea
                      value={li.description}
                      onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                      placeholder={idx === 0 && li.type === "labor" ? "Describe the work performed...\n• Bullet points supported" : `Line item ${idx + 1} description`}
                      disabled={isLoading || rewritingId === li.id}
                      rows={4}
                      className={`w-full text-xs bg-transparent border border-gray-200/40 rounded-md px-3 py-2 resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:opacity-50 ${
                        li.description.trim().length > 10 ? "pr-8" : ""
                      }`}
                    />
                    {li.description.trim().length > 10 && (
                      <button
                        type="button"
                        onClick={() => handleAiRewrite(li.id)}
                        disabled={isLoading || rewritingId !== null}
                        className="absolute right-1.5 top-2 h-5 w-5 flex items-center justify-center text-gray-300 hover:text-purple-500 disabled:hover:text-gray-300 transition-colors rounded"
                        title="AI rewrite for professional invoice voice"
                      >
                        {rewritingId === li.id ? (
                          <Loader2 className="h-3 w-3 animate-spin text-purple-400" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={li.amount}
                      onChange={(e) => updateLineItem(li.id, "amount", e.target.value)}
                      disabled={isLoading}
                      className={`h-8 text-xs pl-5 text-right bg-transparent border-gray-200/40 ${
                        isUnpriced ? "border-amber-300/60" : ""
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineItem(li.id)}
                    disabled={isLoading}
                    className="flex items-center justify-center h-8 w-8 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50/60"
                    title="Remove line item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Subtotals + Total row */}
            <div className="bg-gray-50/80 border-t border-gray-200/60 px-3 py-2.5 space-y-1">
              {(laborTotal > 0 || materialsTotal > 0) && (laborTotal !== totalAmount) && (
                <div className="grid grid-cols-[80px_1fr_2fr_100px_36px] gap-2 items-center">
                  <span />
                  <span />
                  <div className="flex justify-end gap-6 text-[10px] text-gray-400">
                    {laborTotal > 0 && (
                      <span>Labor: <span className="font-medium text-blue-600">${laborTotal.toFixed(2)}</span></span>
                    )}
                    {materialsTotal > 0 && (
                      <span>Materials: <span className="font-medium text-amber-600">${materialsTotal.toFixed(2)}</span></span>
                    )}
                  </div>
                  <span />
                  <span />
                </div>
              )}
              <div className="grid grid-cols-[80px_1fr_2fr_100px_36px] gap-2 items-center">
                <span />
                <span />
                <span className="text-right text-xs font-semibold text-gray-600">Total</span>
                <span className="text-right text-sm font-bold text-gray-900">
                  ${totalAmount.toFixed(2)}
                </span>
                <span />
              </div>
            </div>
          </div>
        </div>

        {/* Internal Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Internal Notes (not shown on invoice)
          </label>
          <textarea
            value={internalNotes}
            onChange={(e) => { userHasEdited.current = true; setInternalNotes(e.target.value); }}
            placeholder="Internal notes, vendor instructions, property notes..."
            rows={3}
            disabled={isLoading}
            className="flex w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200/50">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={isLoading}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={isLoading}
            className="bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white shadow-glow hover:shadow-glow-lg transition-all duration-200"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Generate Invoice PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
