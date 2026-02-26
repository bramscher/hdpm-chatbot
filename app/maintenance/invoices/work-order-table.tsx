"use client";

import React from "react";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkOrderRow } from "@/lib/invoices";

interface WorkOrderTableProps {
  rows: WorkOrderRow[];
  onSelectRow: (row: WorkOrderRow) => void;
  onBack: () => void;
}

export function WorkOrderTable({ rows, onSelectRow, onBack }: WorkOrderTableProps) {
  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Completed Work Orders
          </h3>
          <p className="text-sm text-gray-500">
            {rows.length} work order{rows.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          Upload Different CSV
        </Button>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200/50">
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  WO #
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Property
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">
                  Address
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider hidden lg:table-cell">
                  Date
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-100/50 hover:bg-white/40 transition-colors duration-150"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-violet-500 shrink-0" />
                      <span className="font-medium text-gray-800">
                        {row.wo_number || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-gray-800 font-medium truncate max-w-[200px]">
                      {row.property_name || "—"}
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <div className="text-gray-600 truncate max-w-[250px]">
                      {row.property_address || "—"}
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <span className="text-gray-600">
                      {row.completed_date || "—"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="sm"
                      onClick={() => onSelectRow(row)}
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-glow hover:shadow-glow-lg transition-all duration-200 rounded-lg"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Invoice
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
