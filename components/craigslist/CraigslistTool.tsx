"use client";

import React, { useState, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Home,
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface VacantUnit {
  appfolio_unit_id: string;
  appfolio_property_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  sqft: number;
  available_date: string;
  unit_type: string;
  amenities: string[];
}

type View = "list" | "editor";

export function CraigslistTool() {
  const [view, setView] = useState<View>("list");
  const [units, setUnits] = useState<VacantUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Per-unit rently state
  const [rentlyToggles, setRentlyToggles] = useState<Record<string, boolean>>({});
  const [rentlyUrls, setRentlyUrls] = useState<Record<string, string>>({});

  // Editor state
  const [selectedUnit, setSelectedUnit] = useState<VacantUnit | null>(null);
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editorRentlyUrl, setEditorRentlyUrl] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchVacancies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appfolio-vacancies");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUnits(data.units || []);
      setFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch vacancies");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerate = useCallback(
    async (unit: VacantUnit) => {
      const rentlyEnabled = rentlyToggles[unit.appfolio_unit_id] || false;
      const rentlyUrl = rentlyUrls[unit.appfolio_unit_id] || "";

      setSelectedUnit(unit);
      setEditorRentlyUrl(rentlyUrl);
      setView("editor");
      setGenerating(true);
      setTitle("");
      setBody("");
      setShowPreview(false);
      setCopied(false);

      try {
        const res = await fetch("/api/generate-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unit,
            rently_enabled: rentlyEnabled,
            rently_url: rentlyUrl,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setTitle(data.title || "");
        setBody(data.body || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate listing");
        setView("list");
      } finally {
        setGenerating(false);
      }
    },
    [rentlyToggles, rentlyUrls]
  );

  const handleCopy = useCallback(async () => {
    const fullText = `${title}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = fullText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [title, body]);

  const handleStartOver = useCallback(() => {
    setView("list");
    setSelectedUnit(null);
    setTitle("");
    setBody("");
    setError(null);
    setCopied(false);
    setShowPreview(false);
  }, []);

  const toggleRently = useCallback((unitId: string) => {
    setRentlyToggles((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  }, []);

  const setRentlyUrl = useCallback((unitId: string, url: string) => {
    setRentlyUrls((prev) => ({ ...prev, [unitId]: url }));
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Contact for date";
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // ── List View ──
  if (view === "list") {
    return (
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-charcoal-900">
              Craigslist Listing Generator
            </h1>
            <p className="text-sm text-charcoal-500 mt-1">
              Pull vacant units from AppFolio, generate listing copy, and post to
              Craigslist
            </p>
          </div>
          <Button
            onClick={fetchVacancies}
            disabled={loading}
            className="bg-terra-600 hover:bg-terra-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {fetched ? "Refresh" : "Pull Vacancies"}
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50/80 border border-red-200/50 rounded-xl text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass rounded-xl p-5 animate-pulse"
              >
                <div className="h-5 bg-charcoal-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-charcoal-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {fetched && !loading && units.length === 0 && (
          <div className="glass rounded-xl p-10 text-center">
            <Home className="h-10 w-10 text-charcoal-300 mx-auto mb-3" />
            <p className="text-charcoal-500 text-sm">
              No vacant units found in AppFolio
            </p>
          </div>
        )}

        {/* Unit cards */}
        {!loading && units.length > 0 && (
          <div className="space-y-3">
            {units.map((unit) => {
              const rentlyOn = rentlyToggles[unit.appfolio_unit_id] || false;
              return (
                <div
                  key={unit.appfolio_unit_id}
                  className="glass glass-shine rounded-xl overflow-hidden"
                >
                  <div className="p-5">
                    {/* Top row: address + generate button */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-charcoal-900 truncate">
                          {unit.address}
                        </h3>
                        <p className="text-xs text-charcoal-500 mt-0.5">
                          {unit.city}, {unit.state} {unit.zip}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleGenerate(unit)}
                        size="sm"
                        className="bg-terra-600 hover:bg-terra-700 text-white flex-shrink-0"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Generate Listing
                      </Button>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-terra-50 text-terra-700 text-xs font-semibold">
                        ${unit.rent.toLocaleString()}/mo
                      </span>
                      <span className="text-xs text-charcoal-600">
                        {unit.bedrooms}BR / {unit.bathrooms}BA
                      </span>
                      {unit.sqft > 0 && (
                        <span className="text-xs text-charcoal-500">
                          {unit.sqft.toLocaleString()} sqft
                        </span>
                      )}
                      <span className="text-xs text-charcoal-500">
                        {unit.unit_type}
                      </span>
                      <span className="text-xs text-charcoal-400">
                        Avail: {formatDate(unit.available_date)}
                      </span>
                    </div>

                    {/* Amenities preview */}
                    {unit.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {unit.amenities.slice(0, 6).map((a) => (
                          <span
                            key={a}
                            className="text-2xs px-2 py-0.5 rounded-full bg-sand-100 text-charcoal-600"
                          >
                            {a}
                          </span>
                        ))}
                        {unit.amenities.length > 6 && (
                          <span className="text-2xs px-2 py-0.5 rounded-full bg-sand-100 text-charcoal-400">
                            +{unit.amenities.length - 6} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Rently controls */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-charcoal-100">
                      <button
                        type="button"
                        onClick={() => toggleRently(unit.appfolio_unit_id)}
                        className="flex items-center gap-1.5 text-xs text-charcoal-600 hover:text-charcoal-800 transition-colors"
                      >
                        {rentlyOn ? (
                          <ToggleRight className="h-5 w-5 text-terra-600" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-charcoal-400" />
                        )}
                        Rently tours available
                      </button>

                      {rentlyOn && (
                        <Input
                          value={rentlyUrls[unit.appfolio_unit_id] || ""}
                          onChange={(e) =>
                            setRentlyUrl(unit.appfolio_unit_id, e.target.value)
                          }
                          placeholder="https://rently.com/..."
                          className="flex-1 h-8 text-xs bg-white/70"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Editor View ──
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">
            Edit Listing
          </h1>
          {selectedUnit && (
            <p className="text-sm text-charcoal-500 mt-0.5">
              {selectedUnit.address}, {selectedUnit.city}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleStartOver}
            variant="outline"
            size="sm"
            className="text-charcoal-600"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Start Over
          </Button>
          <Button
            onClick={handleCopy}
            disabled={generating || !body}
            size="sm"
            className={cn(
              "text-white",
              copied
                ? "bg-green-600 hover:bg-green-700"
                : "bg-terra-600 hover:bg-terra-700"
            )}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1.5" />
            )}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50/80 border border-red-200/50 rounded-xl text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {generating ? (
        <div className="glass rounded-xl p-10 text-center">
          <Loader2 className="h-8 w-8 text-terra-600 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-charcoal-600">
            Generating listing copy...
          </p>
          <p className="text-xs text-charcoal-400 mt-1">
            This usually takes 5-10 seconds
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Post Title */}
          <div className="glass rounded-xl p-5">
            <label className="block text-[10px] font-semibold text-charcoal-400 uppercase tracking-widest mb-2">
              Post Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white/70 text-sm font-medium"
            />
          </div>

          {/* Rently URL (editable in editor) */}
          {selectedUnit && rentlyToggles[selectedUnit.appfolio_unit_id] && (
            <div className="glass rounded-xl p-5">
              <label className="block text-[10px] font-semibold text-charcoal-400 uppercase tracking-widest mb-2">
                Rently Tour URL
              </label>
              <Input
                value={editorRentlyUrl}
                onChange={(e) => setEditorRentlyUrl(e.target.value)}
                placeholder="https://rently.com/..."
                className="bg-white/70 text-sm"
              />
              <p className="text-2xs text-charcoal-400 mt-1.5">
                Update the URL here, then re-generate or edit the body text
                manually
              </p>
            </div>
          )}

          {/* Listing Body */}
          <div className="glass rounded-xl p-5">
            <label className="block text-[10px] font-semibold text-charcoal-400 uppercase tracking-widest mb-2">
              Listing Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={24}
              className="w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-4 py-3 text-sm font-mono leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra-600/30 focus-visible:ring-offset-2 resize-y"
            />
          </div>

          {/* Preview */}
          <div className="glass rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                {showPreview ? (
                  <EyeOff className="h-4 w-4 text-charcoal-500" />
                ) : (
                  <Eye className="h-4 w-4 text-charcoal-500" />
                )}
                <span className="text-sm font-semibold text-charcoal-700">
                  Preview formatted post
                </span>
              </div>
              {showPreview ? (
                <ChevronUp className="h-4 w-4 text-charcoal-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-charcoal-400" />
              )}
            </button>

            {showPreview && (
              <div className="px-5 pb-5 border-t border-white/30 pt-4">
                <div className="bg-white rounded-xl p-6 border border-charcoal-100">
                  <h2 className="text-base font-bold text-charcoal-900 mb-4">
                    {title}
                  </h2>
                  <pre className="text-sm text-charcoal-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {body}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
