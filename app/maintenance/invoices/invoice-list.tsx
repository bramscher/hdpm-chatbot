"use client";

import React, { useState } from "react";
import {
  Download,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HdmsInvoice } from "@/lib/invoices";

interface InvoiceListProps {
  invoices: HdmsInvoice[];
  onRefresh: () => void;
  onEdit: (invoice: HdmsInvoice) => void;
  isLoading: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-gray-100/80", text: "text-gray-600", label: "Draft" },
  generated: { bg: "bg-blue-100/80", text: "text-blue-700", label: "Generated" },
  attached: { bg: "bg-emerald-100/80", text: "text-emerald-700", label: "Attached" },
  void: { bg: "bg-red-100/80", text: "text-red-600", label: "Void" },
};

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InvoiceList({ invoices, onRefresh, onEdit, isLoading }: InvoiceListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function handleDownload(invoice: HdmsInvoice) {
    setActionLoading(`download-${invoice.id}`);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/download`);
      const data = await res.json();
      if (res.ok && data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStatusChange(invoice: HdmsInvoice, status: string) {
    setActionLoading(`status-${invoice.id}`);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onRefresh();
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(invoice: HdmsInvoice) {
    setActionLoading(`delete-${invoice.id}`);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onRefresh();
      }
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  }

  if (invoices.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Invoices</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="text-gray-500"
        >
          <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {invoices.map((invoice) => {
          const statusStyle = STATUS_STYLES[invoice.status] || STATUS_STYLES.draft;
          const isVoid = invoice.status === "void";
          const isConfirmingDelete = deleteConfirm === invoice.id;
          const lineItemCount = invoice.line_items?.length || 0;

          return (
            <div
              key={invoice.id}
              className={cn(
                "glass rounded-xl p-4 transition-all duration-200",
                isVoid && "opacity-60"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: Invoice info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100/80 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">
                        {invoice.invoice_code}
                      </span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          statusStyle.bg,
                          statusStyle.text
                        )}
                      >
                        {statusStyle.label}
                      </span>
                      {invoice.wo_reference && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          WO#{invoice.wo_reference}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {invoice.property_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(invoice.created_at)}
                      {lineItemCount > 0 && (
                        <span className="ml-2 text-gray-300">
                          • {lineItemCount} line item{lineItemCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Center: Amount */}
                <div className="text-right shrink-0">
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(invoice.total_amount)}
                  </span>
                  {(invoice.labor_amount > 0 || invoice.materials_amount > 0) && invoice.labor_amount !== invoice.total_amount && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {invoice.labor_amount > 0 && (
                        <span className="text-blue-500">L: {formatCurrency(invoice.labor_amount)}</span>
                      )}
                      {invoice.labor_amount > 0 && invoice.materials_amount > 0 && (
                        <span className="mx-1">·</span>
                      )}
                      {invoice.materials_amount > 0 && (
                        <span className="text-amber-500">M: {formatCurrency(invoice.materials_amount)}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Edit — available for all non-void invoices */}
                  {!isVoid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(invoice)}
                      disabled={actionLoading !== null}
                      title="Edit invoice"
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Download */}
                  {(invoice.status === "generated" || invoice.status === "attached") &&
                    invoice.pdf_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(invoice)}
                        disabled={actionLoading !== null}
                        title="Download PDF"
                        className="h-8 w-8 p-0"
                      >
                        {actionLoading === `download-${invoice.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}

                  {/* Mark as Attached */}
                  {invoice.status === "generated" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange(invoice, "attached")}
                      disabled={actionLoading !== null}
                      title="Mark as Attached in AppFolio"
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 w-8 p-0"
                    >
                      {actionLoading === `status-${invoice.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}

                  {/* Void */}
                  {!isVoid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange(invoice, "void")}
                      disabled={actionLoading !== null}
                      title="Void invoice"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Delete */}
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1 ml-1 pl-1 border-l border-gray-200">
                      <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">Delete?</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(invoice)}
                        disabled={actionLoading !== null}
                        className="text-red-600 hover:bg-red-50 h-7 px-2 text-[10px] font-semibold"
                      >
                        {actionLoading === `delete-${invoice.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Yes"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(null)}
                        disabled={actionLoading !== null}
                        className="text-gray-500 hover:bg-gray-50 h-7 px-2 text-[10px]"
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(invoice.id)}
                      disabled={actionLoading !== null}
                      title="Delete invoice"
                      className="text-gray-300 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
