"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkOrderRow, HdmsInvoice } from "@/lib/invoices";

interface InvoiceFormProps {
  workOrder: WorkOrderRow | null;
  editInvoice: HdmsInvoice | null;
  onBack: () => void;
  onSaved: (invoice: HdmsInvoice) => void;
}

export function InvoiceForm({ workOrder, editInvoice, onBack, onSaved }: InvoiceFormProps) {
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [woReference, setWoReference] = useState("");
  const [completedDate, setCompletedDate] = useState("");
  const [description, setDescription] = useState("");
  const [laborAmount, setLaborAmount] = useState("0.00");
  const [materialsAmount, setMaterialsAmount] = useState("0.00");
  const [totalAmount, setTotalAmount] = useState("0.00");
  const [internalNotes, setInternalNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate from work order or existing invoice
  useEffect(() => {
    if (editInvoice) {
      setPropertyName(editInvoice.property_name);
      setPropertyAddress(editInvoice.property_address);
      setWoReference(editInvoice.wo_reference || "");
      setCompletedDate(editInvoice.completed_date || "");
      setDescription(editInvoice.description);
      setLaborAmount(editInvoice.labor_amount.toFixed(2));
      setMaterialsAmount(editInvoice.materials_amount.toFixed(2));
      setTotalAmount(editInvoice.total_amount.toFixed(2));
      setInternalNotes(editInvoice.internal_notes || "");
    } else if (workOrder) {
      setPropertyName(workOrder.property_name);
      setPropertyAddress(workOrder.property_address);
      setWoReference(workOrder.wo_number);
      setCompletedDate(workOrder.completed_date);
      setDescription(workOrder.description);
      if (workOrder.labor_amount) setLaborAmount(workOrder.labor_amount);
      if (workOrder.materials_amount) setMaterialsAmount(workOrder.materials_amount);
      if (workOrder.total_amount) setTotalAmount(workOrder.total_amount);
    }
  }, [workOrder, editInvoice]);

  // Auto-calculate total
  useEffect(() => {
    const labor = parseFloat(laborAmount) || 0;
    const materials = parseFloat(materialsAmount) || 0;
    setTotalAmount((labor + materials).toFixed(2));
  }, [laborAmount, materialsAmount]);

  function formatDateForInput(dateStr: string): string {
    if (!dateStr) return "";
    // Handle various date formats from CSV
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
      let invoice: HdmsInvoice;

      if (editInvoice) {
        // Update existing invoice
        const res = await fetch(`/api/invoices/${editInvoice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_name: propertyName.trim(),
            property_address: propertyAddress.trim(),
            wo_reference: woReference.trim() || null,
            completed_date: formatDateForInput(completedDate) || null,
            description: description.trim(),
            labor_amount: parseFloat(laborAmount) || 0,
            materials_amount: parseFloat(materialsAmount) || 0,
            total_amount: parseFloat(totalAmount) || 0,
            internal_notes: internalNotes.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        invoice = data.invoice;
      } else {
        // Create new invoice
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_name: propertyName.trim(),
            property_address: propertyAddress.trim(),
            wo_reference: woReference.trim() || null,
            completed_date: formatDateForInput(completedDate) || null,
            description: description.trim(),
            labor_amount: parseFloat(laborAmount) || 0,
            materials_amount: parseFloat(materialsAmount) || 0,
            total_amount: parseFloat(totalAmount) || 0,
            internal_notes: internalNotes.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        invoice = data.invoice;
      }

      if (generatePdf) {
        // Generate PDF
        const pdfRes = await fetch(`/api/invoices/${invoice.id}/generate-pdf`, {
          method: "POST",
        });
        const pdfData = await pdfRes.json();
        if (!pdfRes.ok) throw new Error(pdfData.error);
        invoice = pdfData.invoice;

        // Auto-download
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
            className="flex w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
        </div>

        {/* Amounts */}
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Labor Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={laborAmount}
                onChange={(e) => setLaborAmount(e.target.value)}
                disabled={isLoading}
                className="pl-7 bg-white/70 backdrop-blur-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Materials Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={materialsAmount}
                onChange={(e) => setMaterialsAmount(e.target.value)}
                disabled={isLoading}
                className="pl-7 bg-white/70 backdrop-blur-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Total
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                disabled={isLoading}
                className="pl-7 bg-white/70 backdrop-blur-sm font-semibold"
              />
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
            placeholder="Internal notes for tracking..."
            rows={2}
            disabled={isLoading}
            className="flex w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
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
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-glow hover:shadow-glow-lg transition-all duration-200"
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
