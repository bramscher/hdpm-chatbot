"use client";

import React, { useState, useCallback, useEffect } from "react";
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
  Save,
  History,
  Trash2,
  ImageIcon,
  Download,
  X,
  CheckCircle2,
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

interface SavedListing {
  id: string;
  appfolio_unit_id: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  bedrooms: number;
  bathrooms: number | null;
  sqft: number | null;
  monthly_rent: number;
  listing_title: string;
  listing_body: string;
  rently_enabled: boolean;
  rently_url: string | null;
  created_by: string;
  created_at: string;
}

interface UnitPhoto {
  id: string;
  url: string;
  thumbnail_url: string;
  caption: string;
  is_primary: boolean;
}

type View = "list" | "editor" | "history";

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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Photos state
  const [photos, setPhotos] = useState<UnitPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());

  // History state
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load cached vacancies on mount (instant)
  const loadCached = useCallback(async () => {
    try {
      const res = await fetch("/api/cached-vacancies");
      const data = await res.json();
      if (res.ok && data.units?.length > 0) {
        setUnits(data.units);
        setFetched(true);
      }
    } catch {
      // Cache miss is fine — user can pull fresh
    }
  }, []);

  // Sync: pull fresh from AppFolio, upsert cache, remove stale
  const fetchVacancies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cached-vacancies", { method: "POST" });
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

  // Auto-load cached data on mount
  useEffect(() => {
    loadCached();
  }, [loadCached]);

  const fetchPhotos = useCallback(async (address: string) => {
    setPhotosLoading(true);
    setPhotos([]);
    try {
      const params = new URLSearchParams({ address });
      const res = await fetch(`/api/appfolio-photos?${params}`);
      const data = await res.json();
      if (res.ok) setPhotos(data.photos || []);
    } catch {
      // Photos are optional — fail silently
    } finally {
      setPhotosLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/saved-listings");
      const data = await res.json();
      if (res.ok) setSavedListings(data.listings || []);
    } catch {
      // Non-critical
    } finally {
      setHistoryLoading(false);
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
      setSaved(false);
      setShowPhotos(false);
      setSelectedPhotos(new Set());

      // Fetch photos in parallel with generation
      fetchPhotos(unit.address);

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
    [rentlyToggles, rentlyUrls, fetchPhotos]
  );

  const handleSave = useCallback(async () => {
    if (!selectedUnit || !title || !body) return;

    setSaving(true);
    try {
      const rentlyEnabled = rentlyToggles[selectedUnit.appfolio_unit_id] || false;

      const res = await fetch("/api/saved-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appfolio_unit_id: selectedUnit.appfolio_unit_id,
          address: selectedUnit.address,
          city: selectedUnit.city,
          state: selectedUnit.state,
          zip: selectedUnit.zip,
          bedrooms: selectedUnit.bedrooms,
          bathrooms: selectedUnit.bathrooms,
          sqft: selectedUnit.sqft,
          monthly_rent: selectedUnit.rent,
          unit_type: selectedUnit.unit_type,
          amenities: selectedUnit.amenities,
          available_date: selectedUnit.available_date,
          listing_title: title,
          listing_body: body,
          rently_enabled: rentlyEnabled,
          rently_url: editorRentlyUrl || null,
          created_by: "staff@highdesertpm.com",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save listing");
    } finally {
      setSaving(false);
    }
  }, [selectedUnit, title, body, editorRentlyUrl, rentlyToggles]);

  const handleDeleteSaved = useCallback(async (id: string) => {
    try {
      await fetch("/api/saved-listings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setSavedListings((prev) => prev.filter((l) => l.id !== id));
    } catch {
      // Non-critical
    }
  }, []);

  const handleLoadSaved = useCallback((listing: SavedListing) => {
    setTitle(listing.listing_title);
    setBody(listing.listing_body);
    setEditorRentlyUrl(listing.rently_url || "");
    setSelectedUnit({
      appfolio_unit_id: listing.appfolio_unit_id,
      appfolio_property_id: "",
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zip: listing.zip || "",
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms || 0,
      rent: listing.monthly_rent,
      sqft: listing.sqft || 0,
      available_date: "",
      unit_type: "",
      amenities: [],
    });
    setView("editor");
    setSaved(false);
    setCopied(false);
    setShowPreview(false);
  }, []);

  const handleCopy = useCallback(async () => {
    const fullText = `${title}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

  const handleDownloadPhotos = useCallback(async () => {
    const photosToDownload = selectedPhotos.size > 0
      ? photos.filter((p) => selectedPhotos.has(p.id))
      : photos;

    for (const photo of photosToDownload) {
      const link = document.createElement("a");
      link.href = photo.url;
      link.download = `${photo.caption || photo.id}.jpg`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Small delay between downloads
      await new Promise((r) => setTimeout(r, 300));
    }
  }, [photos, selectedPhotos]);

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }, []);

  const handleStartOver = useCallback(() => {
    setView("list");
    setSelectedUnit(null);
    setTitle("");
    setBody("");
    setError(null);
    setCopied(false);
    setSaved(false);
    setShowPreview(false);
    setPhotos([]);
    setShowPhotos(false);
    setSelectedPhotos(new Set());
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

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  // ── History View ──
  if (view === "history") {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-charcoal-900">
              Saved Listings
            </h1>
            <p className="text-sm text-charcoal-500 mt-1">
              Previously generated Craigslist listing copy
            </p>
          </div>
          <Button
            onClick={handleStartOver}
            variant="outline"
            size="sm"
            className="text-charcoal-600"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Back to Vacancies
          </Button>
        </div>

        {historyLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-xl p-5 animate-pulse">
                <div className="h-5 bg-charcoal-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-charcoal-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : savedListings.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center">
            <History className="h-10 w-10 text-charcoal-300 mx-auto mb-3" />
            <p className="text-charcoal-500 text-sm">
              No saved listings yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedListings.map((listing) => (
              <div
                key={listing.id}
                className="glass glass-shine rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-charcoal-900 truncate">
                      {listing.listing_title}
                    </h3>
                    <p className="text-xs text-charcoal-500 mt-0.5">
                      {listing.address}, {listing.city} &middot;{" "}
                      ${listing.monthly_rent.toLocaleString()}/mo &middot;{" "}
                      {listing.bedrooms}BR/{listing.bathrooms}BA
                    </p>
                    <p className="text-2xs text-charcoal-400 mt-1">
                      Saved {formatTimestamp(listing.created_at)} by{" "}
                      {listing.created_by}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      onClick={() => handleLoadSaved(listing)}
                      size="sm"
                      className="bg-terra-600 hover:bg-terra-700 text-white"
                    >
                      Open
                    </Button>
                    <Button
                      onClick={() => handleDeleteSaved(listing.id)}
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700 hover:border-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

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
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setView("history");
                fetchHistory();
              }}
              variant="outline"
              size="sm"
              className="text-charcoal-600"
            >
              <History className="h-4 w-4 mr-1.5" />
              Saved
            </Button>
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
              {fetched ? "Sync Vacancies" : "Pull Vacancies"}
            </Button>
          </div>
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
              <div key={i} className="glass rounded-xl p-5 animate-pulse">
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
          <h1 className="text-2xl font-bold text-charcoal-900">Edit Listing</h1>
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
            onClick={handleSave}
            disabled={generating || !body || saving}
            size="sm"
            variant="outline"
            className={cn(
              saved
                ? "text-green-600 border-green-300"
                : "text-charcoal-600"
            )}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            {saved ? "Saved" : "Save"}
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
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            <X className="h-3.5 w-3.5 inline" />
          </button>
        </div>
      )}

      {generating ? (
        <div className="glass rounded-xl p-10 text-center">
          <Loader2 className="h-8 w-8 text-terra-600 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-charcoal-600">Generating listing copy...</p>
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
                Update the URL here, then re-generate or edit the body text manually
              </p>
            </div>
          )}

          {/* Photos Section */}
          <div className="glass rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPhotos(!showPhotos)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-charcoal-500" />
                <span className="text-sm font-semibold text-charcoal-700">
                  Property Photos
                </span>
                {photos.length > 0 && (
                  <span className="text-2xs px-1.5 py-0.5 rounded-full bg-terra-50 text-terra-600 font-medium">
                    {photos.length}
                  </span>
                )}
                {photosLoading && (
                  <Loader2 className="h-3.5 w-3.5 text-charcoal-400 animate-spin" />
                )}
              </div>
              {showPhotos ? (
                <ChevronUp className="h-4 w-4 text-charcoal-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-charcoal-400" />
              )}
            </button>

            {showPhotos && (
              <div className="px-5 pb-5 border-t border-white/30 pt-4">
                {photosLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 text-charcoal-400 animate-spin" />
                  </div>
                ) : photos.length === 0 ? (
                  <div className="text-center py-6">
                    <ImageIcon className="h-8 w-8 text-charcoal-300 mx-auto mb-2" />
                    <p className="text-xs text-charcoal-500">
                      No photos available from AppFolio for this unit
                    </p>
                    <p className="text-2xs text-charcoal-400 mt-1">
                      Upload photos directly to Craigslist when posting
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-charcoal-500">
                        {selectedPhotos.size > 0
                          ? `${selectedPhotos.size} selected`
                          : "Click to select, then download for Craigslist upload"}
                      </p>
                      <Button
                        onClick={handleDownloadPhotos}
                        size="sm"
                        variant="outline"
                        className="text-charcoal-600 h-7 text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {selectedPhotos.size > 0
                          ? `Download ${selectedPhotos.size}`
                          : "Download All"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => togglePhotoSelection(photo.id)}
                          className={cn(
                            "relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all",
                            selectedPhotos.has(photo.id)
                              ? "border-terra-500 ring-2 ring-terra-500/30"
                              : "border-transparent hover:border-charcoal-200"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.thumbnail_url}
                            alt={photo.caption || "Property photo"}
                            className="w-full h-full object-cover"
                          />
                          {selectedPhotos.has(photo.id) && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-terra-500 flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          {photo.is_primary && (
                            <span className="absolute bottom-1 left-1 text-2xs px-1.5 py-0.5 rounded bg-black/60 text-white">
                              Primary
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

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
