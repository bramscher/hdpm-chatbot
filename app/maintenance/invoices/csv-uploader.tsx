"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WorkOrderRow } from "@/lib/invoices";

interface CsvUploaderProps {
  onParsed: (rows: WorkOrderRow[], headers: string[]) => void;
}

export function CsvUploader({ onParsed }: CsvUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsUploading(true);

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
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
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
    <div className="animate-slide-up">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ease-spring",
          isDragging
            ? "border-violet-400 bg-violet-50/60 scale-[1.01]"
            : "border-gray-300/50 bg-white/40 backdrop-blur-sm hover:border-violet-300 hover:bg-white/60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <div className="flex flex-col items-center gap-4">
          {isUploading ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-violet-100/80 flex items-center justify-center">
                <FileText className="h-6 w-6 text-violet-600 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Parsing {fileName}...
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-violet-100/80 flex items-center justify-center">
                <Upload className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Drop your AppFolio CSV here, or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Completed Work Orders export from AppFolio
                </p>
              </div>
              <Button variant="outline" size="sm" className="mt-2">
                Select CSV File
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
