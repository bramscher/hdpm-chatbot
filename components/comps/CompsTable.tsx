"use client";

import React, { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DATA_SOURCE_LABELS,
  type RentalComp,
  type CompsSortField,
  type CompsSortDirection,
} from "@/types/comps";

interface CompsTableProps {
  comps: RentalComp[];
  loading?: boolean;
  onDelete?: (id: string) => void;
}

const COLUMNS: { key: CompsSortField; label: string; className?: string }[] = [
  { key: "town", label: "Town" },
  { key: "bedrooms", label: "BR/BA" },
  { key: "property_type", label: "Type" },
  { key: "monthly_rent", label: "Rent" },
  { key: "sqft", label: "Sqft" },
  { key: "comp_date", label: "Date" },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

export function CompsTable({ comps, loading, onDelete }: CompsTableProps) {
  const [sortField, setSortField] = useState<CompsSortField>("comp_date");
  const [sortDir, setSortDir] = useState<CompsSortDirection>("desc");

  const sorted = useMemo(() => {
    const arr = [...comps];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "monthly_rent":
          cmp = Number(a.monthly_rent) - Number(b.monthly_rent);
          break;
        case "comp_date":
          cmp = (a.comp_date || "").localeCompare(b.comp_date || "");
          break;
        case "town":
          cmp = a.town.localeCompare(b.town);
          break;
        case "bedrooms":
          cmp = a.bedrooms - b.bedrooms;
          break;
        case "sqft":
          cmp = (a.sqft || 0) - (b.sqft || 0);
          break;
        case "property_type":
          cmp = a.property_type.localeCompare(b.property_type);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [comps, sortField, sortDir]);

  function handleSort(field: CompsSortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "monthly_rent" ? "desc" : "asc");
    }
  }

  function SortIcon({ field }: { field: CompsSortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-300" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-emerald-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-600" />
    );
  }

  function handleExportCsv() {
    const headers = [
      "Town",
      "Address",
      "Bedrooms",
      "Bathrooms",
      "Sqft",
      "Property Type",
      "Monthly Rent",
      "Rent/Sqft",
      "Data Source",
      "Date",
      "Notes",
    ];
    const rows = sorted.map((c) => [
      c.town,
      c.address || "",
      c.bedrooms,
      c.bathrooms || "",
      c.sqft || "",
      c.property_type,
      c.monthly_rent,
      c.rent_per_sqft || "",
      DATA_SOURCE_LABELS[c.data_source] || c.data_source,
      c.comp_date,
      c.notes || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent-comps-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="glass glass-shine rounded-2xl p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 bg-gray-200 rounded" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass glass-shine rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/30">
        <span className="text-sm font-semibold text-gray-700">
          {comps.length} Comp{comps.length !== 1 ? "s" : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportCsv}
          disabled={comps.length === 0}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100/80">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600 transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.key} />
                  </span>
                </th>
              ))}
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Source
              </th>
              {onDelete && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1 + (onDelete ? 1 : 0)}
                  className="px-4 py-12 text-center text-gray-400 text-sm"
                >
                  No comps match the current filters
                </td>
              </tr>
            ) : (
              sorted.map((comp) => (
                <tr
                  key={comp.id}
                  className="border-b border-gray-50/80 hover:bg-white/40 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {comp.town}
                    {comp.address && (
                      <span className="block text-[11px] text-gray-400 truncate max-w-[180px]">
                        {comp.address}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {comp.bedrooms}/{comp.bathrooms || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{comp.property_type}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    ${Number(comp.monthly_rent).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {comp.sqft ? comp.sqft.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(comp.comp_date)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${
                        comp.data_source === "appfolio"
                          ? "bg-blue-50 text-blue-600"
                          : comp.data_source === "rentometer"
                          ? "bg-purple-50 text-purple-600"
                          : comp.data_source === "hud_fmr"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-gray-50 text-gray-500"
                      }`}
                    >
                      {DATA_SOURCE_LABELS[comp.data_source] || comp.data_source}
                    </span>
                  </td>
                  {onDelete && (
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => onDelete(comp.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50/50"
                        title="Delete comp"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
