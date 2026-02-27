"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Receipt } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("upload");
  const [parsedRows, setParsedRows] = useState<WorkOrderRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<WorkOrderRow | null>(null);
  const [editInvoice, setEditInvoice] = useState<HdmsInvoice | null>(null);
  const [fromPdfScan, setFromPdfScan] = useState(false);
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

  // Handle ?from_wo= parameter — pre-populate form from work order
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

        // Convert work order into a WorkOrderRow for the form
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
        setView("form");
      } catch (err) {
        console.error("Failed to load work order:", err);
      }
    }

    loadWorkOrder(fromWo);
  }, [searchParams]);

  function handleCsvParsed(rows: WorkOrderRow[]) {
    setParsedRows(rows);
    setView("table");
  }

  function handlePdfScanned(fields: Record<string, string>) {
    const row: WorkOrderRow = {
      wo_number: fields.wo_number || "",
      property_name: fields.property_name || "",
      property_address: fields.property_address || "",
      unit: fields.unit || "",
      description: fields.description || "",
      completed_date: fields.completed_date || "",
      category: fields.category || "",
      assigned_to: "",
      labor_amount: fields.labor_amount || "",
      materials_amount: fields.materials_amount || "",
      total_amount: fields.total_amount || "",
    };
    setSelectedRow(row);
    setEditInvoice(null);
    setFromPdfScan(true);
    setView("form");
  }

  function handleSelectRow(row: WorkOrderRow) {
    setSelectedRow(row);
    setEditInvoice(null);
    setFromPdfScan(false);
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
  }

  function handleBackToUpload() {
    setView("upload");
    setParsedRows([]);
  }

  function handleBackFromForm() {
    if (editInvoice || fromPdfScan) {
      setView("upload");
      setEditInvoice(null);
      setFromPdfScan(false);
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
        <>
          <CsvUploader onParsed={handleCsvParsed} onPdfScanned={handlePdfScanned} />
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
