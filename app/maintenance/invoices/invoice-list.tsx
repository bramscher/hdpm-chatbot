"use client";

import React, { useState } from "react";
import {
  Download,
  CheckCircle2,
  XCircle,
  Pencil,
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
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {invoice.property_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(invoice.created_at)}
                    </p>
                  </div>
                </div>

                {/* Center: Amount */}
                <div className="text-right shrink-0">
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(invoice.total_amount)}
                  </span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {invoice.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(invoice)}
                      disabled={actionLoading !== null}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}

                  {(invoice.status === "generated" || invoice.status === "attached") &&
                    invoice.pdf_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(invoice)}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === `download-${invoice.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                  {invoice.status === "generated" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange(invoice, "attached")}
                      disabled={actionLoading !== null}
                      title="Mark as Attached in AppFolio"
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      {actionLoading === `status-${invoice.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {!isVoid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange(invoice, "void")}
                      disabled={actionLoading !== null}
                      title="Void invoice"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" />
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
