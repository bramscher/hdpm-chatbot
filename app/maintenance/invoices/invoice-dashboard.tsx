"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Receipt } from "lucide-react";
import Link from "next/link";
import { WorkOrderRow, HdmsInvoice } from "@/lib/invoices";
import { CsvUploader } from "./csv-uploader";
import { WorkOrderTable } from "./work-order-table";
import { InvoiceForm } from "./invoice-form";
import { InvoiceList } from "./invoice-list";

type View = "upload" | "table" | "form";

interface InvoiceDashboardProps {
  userEmail: string;
  userName: string;
}

export function InvoiceDashboard({ userEmail, userName }: InvoiceDashboardProps) {
  const [view, setView] = useState<View>("upload");
  const [parsedRows, setParsedRows] = useState<WorkOrderRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<WorkOrderRow | null>(null);
  const [editInvoice, setEditInvoice] = useState<HdmsInvoice | null>(null);
  const [invoices, setInvoices] = useState<HdmsInvoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);

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

  function handleCsvParsed(rows: WorkOrderRow[]) {
    setParsedRows(rows);
    setView("table");
  }

  function handleSelectRow(row: WorkOrderRow) {
    setSelectedRow(row);
    setEditInvoice(null);
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
  }

  function handleBackToUpload() {
    setView("upload");
    setParsedRows([]);
  }

  function handleBackFromForm() {
    if (editInvoice) {
      setView("upload");
      setEditInvoice(null);
    } else {
      setView("table");
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-violet-600 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-glow">
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
        <>
          <CsvUploader onParsed={handleCsvParsed} />
          <InvoiceList
            invoices={invoices}
            onRefresh={fetchInvoices}
            onEdit={handleEditInvoice}
            isLoading={isLoadingInvoices}
          />
        </>
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
