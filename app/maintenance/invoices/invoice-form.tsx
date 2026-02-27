"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Save, FileDown, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkOrderRow, HdmsInvoice, LineItem } from "@/lib/invoices";

interface InvoiceFormProps {
  workOrder: WorkOrderRow | null;
  editInvoice: HdmsInvoice | null;
  onBack: () => void;
  onSaved: (invoice: HdmsInvoice) => void;
}

interface FormLineItem {
  id: string; // client-side key for React
  account: string;
  description: string;
  amount: string;
}

let nextLineItemId = 1;
function newLineItemId(): string {
  return `li_${nextLineItemId++}`;
}

function blankLineItem(): FormLineItem {
  return { id: newLineItemId(), account: "", description: "", amount: "0.00" };
}

export function InvoiceForm({ workOrder, editInvoice, onBack, onSaved }: InvoiceFormProps) {
  // Header fields
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [woReference, setWoReference] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<FormLineItem[]>([blankLineItem()]);

  // Legacy fields (for backward compat display)
  const [laborAmount, setLaborAmount] = useState("0.00");
  const [materialsAmount, setMaterialsAmount] = useState("0.00");

  // Scanned extra fields (read-only context shown to user)
  const [scannedMeta, setScannedMeta] = useState<{
    technician?: string;
    status?: string;
    scheduledDate?: string;
    permissionToEnter?: string;
    maintenanceLimit?: string;
    vendorInstructions?: string;
    propertyNotes?: string;
  }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed total from line items
  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);
  }, [lineItems]);

  // Pre-populate from work order or existing invoice
  useEffect(() => {
    if (editInvoice) {
      setPropertyName(editInvoice.property_name);
      setPropertyAddress(editInvoice.property_address);
      setWoReference(editInvoice.wo_reference || "");
      setCompletedDate(editInvoice.completed_date || "");
      setDescription(editInvoice.description);
      setInternalNotes(editInvoice.internal_notes || "");
      setLaborAmount(editInvoice.labor_amount.toFixed(2));
      setMaterialsAmount(editInvoice.materials_amount.toFixed(2));

      // Load line items from invoice if present
      if (editInvoice.line_items && editInvoice.line_items.length > 0) {
        setLineItems(
          editInvoice.line_items.map((li) => ({
            id: newLineItemId(),
            account: li.account || "",
            description: li.description,
            amount: li.amount.toFixed(2),
          }))
        );
      } else {
        // Fall back to legacy amounts as line items
        const items: FormLineItem[] = [];
        if (editInvoice.labor_amount > 0) {
          items.push({ id: newLineItemId(), account: "", description: "Labor", amount: editInvoice.labor_amount.toFixed(2) });
        }
        if (editInvoice.materials_amount > 0) {
          items.push({ id: newLineItemId(), account: "", description: "Materials", amount: editInvoice.materials_amount.toFixed(2) });
        }
        if (items.length === 0) {
          items.push(blankLineItem());
        }
        setLineItems(items);
      }
    } else if (workOrder) {
      setPropertyName(workOrder.property_name);
      setPropertyAddress(workOrder.property_address);
      setWoReference(workOrder.wo_number);
      setCompletedDate(workOrder.completed_date);
      setDescription(workOrder.description);

      // Load line items from scanned PDF
      if (workOrder.line_items && workOrder.line_items.length > 0) {
        setLineItems(
          workOrder.line_items.map((li) => ({
            id: newLineItemId(),
            account: li.account || "",
            description: li.description,
            amount: li.amount.toFixed(2),
          }))
        );
      } else {
        // Fall back to legacy amounts
        const items: FormLineItem[] = [];
        if (workOrder.labor_amount && parseFloat(workOrder.labor_amount) > 0) {
          items.push({ id: newLineItemId(), account: "", description: "Labor", amount: workOrder.labor_amount });
        }
        if (workOrder.materials_amount && parseFloat(workOrder.materials_amount) > 0) {
          items.push({ id: newLineItemId(), account: "", description: "Materials", amount: workOrder.materials_amount });
        }
        if (workOrder.total_amount && items.length === 0 && parseFloat(workOrder.total_amount) > 0) {
          items.push({ id: newLineItemId(), account: "", description: "Work performed", amount: workOrder.total_amount });
        }
        if (items.length === 0) {
          items.push(blankLineItem());
        }
        setLineItems(items);
      }

      // Store scanned metadata for context
      setScannedMeta({
        technician: workOrder.technician || undefined,
        status: workOrder.status || undefined,
        scheduledDate: workOrder.scheduled_date || undefined,
        permissionToEnter: workOrder.permission_to_enter || undefined,
        maintenanceLimit: workOrder.maintenance_limit || undefined,
        vendorInstructions: workOrder.vendor_instructions || undefined,
        propertyNotes: workOrder.property_notes || undefined,
      });

      // Pre-fill internal notes with useful context from scan
      const noteParts: string[] = [];
      if (workOrder.vendor_instructions) noteParts.push(`Vendor: ${workOrder.vendor_instructions}`);
      if (workOrder.property_notes) noteParts.push(`Notes: ${workOrder.property_notes}`);
      if (workOrder.technician) noteParts.push(`Tech: ${workOrder.technician}`);
      if (noteParts.length > 0) setInternalNotes(noteParts.join("\n"));
    }
  }, [workOrder, editInvoice]);

  // Line item CRUD
  function updateLineItem(id: string, field: keyof Omit<FormLineItem, "id">, value: string) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => {
      const filtered = prev.filter((li) => li.id !== id);
      return filtered.length === 0 ? [blankLineItem()] : filtered;
    });
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, blankLineItem()]);
  }

  function formatDateForInput(dateStr: string): string {
    if (!dateStr) return "";
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return parsed.toISOString().split("T")[0];
  }

  async function handleSave(generatePdf: boolean) {
    setError(null);

    if (!propertyName.trim() || !propertyAddress.trim() || !description.trim()) {
      setError("Property name, address, and description are required");
      return;
    }

    const setter = generatePdf ? setIsGenerating : setIsSaving;
    setter(true);

    try {
      // Build line items payload
      const validLineItems: LineItem[] = lineItems
        .filter((li) => li.description.trim() && (parseFloat(li.amount) || 0) > 0)
        .map((li) => ({
          description: li.description.trim(),
          account: li.account.trim() || undefined,
          amount: parseFloat(li.amount) || 0,
        }));

      const computedTotal = validLineItems.reduce((sum, li) => sum + li.amount, 0);

      const payload = {
        property_name: propertyName.trim(),
        property_address: propertyAddress.trim(),
        wo_reference: woReference.trim() || null,
        completed_date: formatDateForInput(completedDate) || null,
        description: description.trim(),
        labor_amount: 0,
        materials_amount: 0,
        total_amount: computedTotal,
        line_items: validLineItems.length > 0 ? validLineItems : null,
        internal_notes: internalNotes.trim() || null,
      };

      let invoice: HdmsInvoice;

      if (editInvoice) {
        const res = await fetch(`/api/invoices/${editInvoice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        invoice = data.invoice;
      } else {
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        invoice = data.invoice;
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
              onChange={(e) => setPropertyName(e.target.value)}
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
              onChange={(e) => setPropertyAddress(e.target.value)}
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
              onChange={(e) => setWoReference(e.target.value)}
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
              onChange={(e) => setCompletedDate(e.target.value)}
              disabled={isLoading}
              className="bg-white/70 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Scanned Work Order Context (if available) */}
        {hasScannedMeta && (
          <div className="rounded-xl bg-blue-50/60 border border-blue-200/40 px-4 py-3 space-y-1.5">
            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest">
              Work Order Details
            </p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
              {scannedMeta.status && (
                <div><span className="font-medium text-gray-500">Status:</span> {scannedMeta.status}</div>
              )}
              {scannedMeta.technician && (
                <div><span className="font-medium text-gray-500">Technician:</span> {scannedMeta.technician}</div>
              )}
              {scannedMeta.scheduledDate && (
                <div><span className="font-medium text-gray-500">Scheduled:</span> {scannedMeta.scheduledDate}</div>
              )}
              {scannedMeta.maintenanceLimit && (
                <div><span className="font-medium text-gray-500">Maint Limit:</span> ${scannedMeta.maintenanceLimit}</div>
              )}
              {scannedMeta.permissionToEnter && (
                <div><span className="font-medium text-gray-500">Permission:</span> {scannedMeta.permissionToEnter}</div>
              )}
            </div>
            {scannedMeta.vendorInstructions && (
              <p className="text-[11px] text-gray-500 mt-1">
                <span className="font-medium">Vendor Instructions:</span> {scannedMeta.vendorInstructions}
              </p>
            )}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Description of Work (shown on invoice)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Clean, owner-facing description of the work performed..."
            rows={3}
            disabled={isLoading}
            className="flex w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
        </div>

        {/* ============================== */}
        {/* Line Items                     */}
        {/* ============================== */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
              Line Items
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLineItem}
              disabled={isLoading}
              className="text-emerald-600 hover:text-emerald-800 text-xs h-7"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Line
            </Button>
          </div>

          <div className="rounded-xl border border-gray-200/60 bg-white/50 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_2fr_100px_36px] gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-200/40 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              <span>Account</span>
              <span>Description</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {/* Table rows */}
            {lineItems.map((li, idx) => (
              <div
                key={li.id}
                className="grid grid-cols-[1fr_2fr_100px_36px] gap-2 px-3 py-1.5 border-b border-gray-100/60 last:border-b-0 items-center"
              >
                <Input
                  value={li.account}
                  onChange={(e) => updateLineItem(li.id, "account", e.target.value)}
                  placeholder="Account"
                  disabled={isLoading}
                  className="h-8 text-xs bg-transparent border-gray-200/40"
                />
                <Input
                  value={li.description}
                  onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                  placeholder={`Line item ${idx + 1} description`}
                  disabled={isLoading}
                  className="h-8 text-xs bg-transparent border-gray-200/40"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={li.amount}
                    onChange={(e) => updateLineItem(li.id, "amount", e.target.value)}
                    disabled={isLoading}
                    className="h-8 text-xs pl-5 text-right bg-transparent border-gray-200/40"
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
            ))}

            {/* Total row */}
            <div className="grid grid-cols-[1fr_2fr_100px_36px] gap-2 px-3 py-2.5 bg-gray-50/80 border-t border-gray-200/60 items-center">
              <span />
              <span className="text-right text-xs font-semibold text-gray-600">Total</span>
              <span className="text-right text-sm font-bold text-gray-900">
                ${totalAmount.toFixed(2)}
              </span>
              <span />
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
            onChange={(e) => setInternalNotes(e.target.value)}
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
