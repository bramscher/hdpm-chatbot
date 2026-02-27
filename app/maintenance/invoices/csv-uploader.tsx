"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WorkOrderRow } from "@/lib/invoices";

interface CsvUploaderProps {
  onParsed: (rows: WorkOrderRow[], headers: string[]) => void;
  onPdfScanned: (fields: Record<string, unknown>) => void;
}

export function CsvUploader({ onParsed, onPdfScanned }: CsvUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<"csv" | "pdf" | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  async function handleCsvFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsUploading(true);
    setUploadType("csv");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/invoices/parse-csv", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to parse CSV");
      }

      onParsed(data.rows, data.headers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsUploading(false);
      setUploadType(null);
    }
  }

  async function handlePdfFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setError("Please upload a PDF file");
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsUploading(true);
    setUploadType("pdf");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/invoices/parse-wo-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to parse PDF");
      }

      onPdfScanned(data.fields);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process PDF");
    } finally {
      setIsUploading(false);
      setUploadType(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.name.endsWith(".csv")) {
      handleCsvFile(file);
    } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      handlePdfFile(file);
    } else {
      setError("Please upload a CSV or PDF file");
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  return (
    <div className="animate-slide-up space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleCsvFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePdfFile(file);
          e.target.value = "";
        }}
      />

      {/* Upload Zone */}
      {isUploading ? (
        <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/60 p-10 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100/80 flex items-center justify-center">
              {uploadType === "pdf" ? (
                <ScanLine className="h-6 w-6 text-emerald-700 animate-pulse" />
              ) : (
                <FileText className="h-6 w-6 text-emerald-700 animate-pulse" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {uploadType === "pdf"
                  ? `Scanning ${fileName}...`
                  : `Parsing ${fileName}...`}
              </p>
              {uploadType === "pdf" && (
                <p className="text-xs text-gray-400 mt-1">
                  Extracting work order details with AI
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ease-spring",
            isDragging
              ? "border-emerald-500 bg-emerald-50/60 scale-[1.01]"
              : "border-gray-300/50 bg-white/40 backdrop-blur-sm hover:border-emerald-400 hover:bg-white/60"
          )}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100/80 flex items-center justify-center">
              <Upload className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Drop a file here, or choose an option below
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports CSV exports and Work Order PDFs
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  csvInputRef.current?.click();
                }}
              >
                <FileText className="h-4 w-4 mr-1.5" />
                Upload CSV
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  pdfInputRef.current?.click();
                }}
                className="bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white shadow-glow hover:shadow-glow-lg transition-all duration-200"
              >
                <ScanLine className="h-4 w-4 mr-1.5" />
                Scan Work Order PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
