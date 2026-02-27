"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ALL_TOWNS,
  ALL_PROPERTY_TYPES,
  ALL_DATA_SOURCES,
  ALL_AMENITIES,
  DATA_SOURCE_LABELS,
  type Town,
  type PropertyType,
  type DataSource,
  type CompsFilter,
} from "@/types/comps";

interface CompsFiltersProps {
  filter: CompsFilter;
  onChange: (filter: CompsFilter) => void;
}

function PillToggle<T extends string>({
  options,
  selected,
  onToggle,
  labelFn,
}: {
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
  labelFn?: (value: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
              isActive
                ? "bg-emerald-100/80 text-emerald-700 ring-1 ring-emerald-300 shadow-sm"
                : "bg-white/50 text-gray-500 hover:bg-white/70 hover:text-gray-700"
            }`}
          >
            {labelFn ? labelFn(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

export function CompsFilters({ filter, onChange }: CompsFiltersProps) {
  const [expanded, setExpanded] = useState(true);

  function toggle<T extends string>(arr: T[] | undefined, value: T): T[] {
    const current = arr || [];
    return current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
  }

  function handleReset() {
    onChange({});
  }

  const hasFilters =
    (filter.towns && filter.towns.length > 0) ||
    (filter.bedrooms && filter.bedrooms.length > 0) ||
    (filter.property_types && filter.property_types.length > 0) ||
    (filter.data_sources && filter.data_sources.length > 0) ||
    (filter.amenities && filter.amenities.length > 0) ||
    filter.date_from ||
    filter.date_to ||
    filter.rent_min !== undefined ||
    filter.rent_max !== undefined;

  return (
    <div className="glass glass-shine rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Filters</span>
          {hasFilters && (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-white/30">
          {/* Towns */}
          <div className="pt-4">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Towns
            </label>
            <PillToggle<Town>
              options={ALL_TOWNS}
              selected={filter.towns || []}
              onToggle={(t) => onChange({ ...filter, towns: toggle(filter.towns, t) })}
            />
          </div>

          {/* Bedrooms */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Bedrooms
            </label>
            <PillToggle<string>
              options={["0", "1", "2", "3", "4", "5+"]}
              selected={(filter.bedrooms || []).map(String)}
              onToggle={(b) => {
                const num = b === "5+" ? 5 : Number(b);
                const current = filter.bedrooms || [];
                const next = current.includes(num)
                  ? current.filter((v) => v !== num)
                  : [...current, num];
                onChange({ ...filter, bedrooms: next });
              }}
              labelFn={(b) => (b === "0" ? "Studio" : b === "5+" ? "5+" : `${b} BR`)}
            />
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Property Type
            </label>
            <PillToggle<PropertyType>
              options={ALL_PROPERTY_TYPES}
              selected={filter.property_types || []}
              onToggle={(t) =>
                onChange({ ...filter, property_types: toggle(filter.property_types, t) })
              }
            />
          </div>

          {/* Data Source */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Data Source
            </label>
            <PillToggle<DataSource>
              options={ALL_DATA_SOURCES}
              selected={filter.data_sources || []}
              onToggle={(s) =>
                onChange({ ...filter, data_sources: toggle(filter.data_sources, s) })
              }
              labelFn={(s) => DATA_SOURCE_LABELS[s]}
            />
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Amenities
            </label>
            <PillToggle<string>
              options={ALL_AMENITIES.map((a) => a.value)}
              selected={filter.amenities || []}
              onToggle={(a) =>
                onChange({ ...filter, amenities: toggle(filter.amenities, a) })
              }
              labelFn={(v) => ALL_AMENITIES.find((a) => a.value === v)?.label || v}
            />
          </div>

          {/* Rent Range + Date Range */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Rent Range
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filter.rent_min ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...filter,
                        rent_min: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="pl-6 h-8 text-xs bg-white/70"
                  />
                </div>
                <span className="text-gray-300 text-xs">–</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filter.rent_max ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...filter,
                        rent_max: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="pl-6 h-8 text-xs bg-white/70"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filter.date_from || ""}
                  onChange={(e) => onChange({ ...filter, date_from: e.target.value || undefined })}
                  className="h-8 text-xs bg-white/70 flex-1"
                />
                <span className="text-gray-300 text-xs">–</span>
                <Input
                  type="date"
                  value={filter.date_to || ""}
                  onChange={(e) => onChange({ ...filter, date_to: e.target.value || undefined })}
                  className="h-8 text-xs bg-white/70 flex-1"
                />
              </div>
            </div>
          </div>

          {/* Reset */}
          {hasFilters && (
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Reset Filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
