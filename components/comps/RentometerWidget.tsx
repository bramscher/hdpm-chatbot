"use client";

import React, { useState } from "react";
import { Search, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RentometerResult, Town } from "@/types/comps";

interface RentometerWidgetProps {
  onCompCreated?: () => void;
}

const SUPPORTED_CITIES: Town[] = ["Bend", "Redmond"];

export function RentometerWidget({ onCompCreated }: RentometerWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [city, setCity] = useState<Town>("Bend");
  const [address, setAddress] = useState("");
  const [bedrooms, setBedrooms] = useState("3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RentometerResult | null>(null);

  async function handleLookup() {
    if (!address.trim()) {
      setError("Enter an address to look up");
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/comps/rentometer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          city,
          bedrooms: Number(bedrooms),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResult(data.result);
      onCompCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass glass-shine rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
            <Search className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <span className="text-sm font-semibold text-gray-700">
            Rentometer Lookup
          </span>
          <span className="text-[10px] text-purple-500 font-medium bg-purple-50 px-1.5 py-0.5 rounded-full">
            Bend & Redmond
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/30 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Address
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
                disabled={loading}
                className="bg-white/70 backdrop-blur-sm h-9 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                City
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value as Town)}
                disabled={loading}
                className="flex h-9 w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {SUPPORTED_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Bedrooms
              </label>
              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                disabled={loading}
                className="flex h-9 w-24 rounded-xl border border-input bg-white/70 backdrop-blur-sm px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="0">Studio</option>
                <option value="1">1 BR</option>
                <option value="2">2 BR</option>
                <option value="3">3 BR</option>
                <option value="4">4 BR</option>
                <option value="5">5 BR</option>
              </select>
            </div>
            <Button
              onClick={handleLookup}
              disabled={loading}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white h-9"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5 mr-1.5" />
              )}
              Look Up
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-50/80 border border-red-200/50 rounded-xl text-red-700 text-xs">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-purple-50/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-700">
                  Rentometer Results
                </span>
                <span className="text-[10px] text-purple-400">
                  {result.sample_size} samples
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] text-gray-400 uppercase tracking-widest">
                    Median
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    ${result.median.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 uppercase tracking-widest">
                    Mean
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    ${result.mean.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Percentile bar */}
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>${result.percentile_25.toLocaleString()}</span>
                  <span>25th – 75th percentile</span>
                  <span>${result.percentile_75.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full"
                    style={{
                      marginLeft: `${
                        ((result.percentile_25 - result.min) /
                          (result.max - result.min)) *
                        100
                      }%`,
                      width: `${
                        ((result.percentile_75 - result.percentile_25) /
                          (result.max - result.min)) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                  <span>Min: ${result.min.toLocaleString()}</span>
                  <span>Max: ${result.max.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-[10px] text-gray-400 italic">
                Result cached as a comp for 30 days
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
