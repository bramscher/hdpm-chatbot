"use client";

import React, { useState } from "react";
import { Search, Building2, Loader2, Home, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ALL_TOWNS,
  ALL_PROPERTY_TYPES,
  ALL_AMENITIES,
  type Town,
  type PropertyType,
  type Amenity,
  type SubjectProperty,
} from "@/types/comps";

interface PropertyInputProps {
  onSubmit: (subject: SubjectProperty) => void;
  loading: boolean;
}

type Tab = "appfolio" | "manual";

interface AppFolioUnit {
  unitId: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  listedRent: number;
  marketRent: number;
  rentReady: boolean;
}

interface AppFolioResult {
  propertyId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  units: AppFolioUnit[];
}

export function PropertyInput({ onSubmit, loading }: PropertyInputProps) {
  const [tab, setTab] = useState<Tab>("appfolio");

  // AppFolio search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AppFolioResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Manual form state
  const [address, setAddress] = useState("");
  const [town, setTown] = useState<Town>("Bend");
  const [zipCode, setZipCode] = useState("");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("2");
  const [sqft, setSqft] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("SFR");
  const [currentRent, setCurrentRent] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);

  function toggleAmenity(val: string) {
    setAmenities((prev) =>
      prev.includes(val) ? prev.filter((a) => a !== val) : [...prev, val]
    );
  }

  // AppFolio search
  async function handleSearch() {
    if (searchQuery.trim().length < 3) {
      setSearchError("Enter at least 3 characters to search");
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const res = await fetch(
        `/api/comps/appfolio-lookup?address=${encodeURIComponent(searchQuery.trim())}`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setSearchResults(data.properties || []);
      if (data.properties?.length === 0) {
        setSearchError("No properties found. Try a different search or enter manually.");
      }
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Search failed"
      );
    } finally {
      setSearching(false);
    }
  }

  // Select an AppFolio property + unit
  function selectUnit(property: AppFolioResult, unit: AppFolioUnit) {
    const cityLower = property.city.toLowerCase();
    const townMap: Record<string, Town> = {
      bend: "Bend",
      redmond: "Redmond",
      sisters: "Sisters",
      prineville: "Prineville",
      culver: "Culver",
    };
    const detectedTown = townMap[cityLower] || "Bend";

    const ptMap = (pt: string): PropertyType => {
      const t = pt.toLowerCase();
      if (t.includes("single") || t.includes("house") || t.includes("sfr"))
        return "SFR";
      if (t.includes("apartment") || t.includes("apt")) return "Apartment";
      if (t.includes("townhouse") || t.includes("townhome")) return "Townhouse";
      if (t.includes("duplex")) return "Duplex";
      if (t.includes("condo")) return "Condo";
      if (t.includes("manufactured") || t.includes("mobile"))
        return "Manufactured";
      return "Other";
    };

    const fullAddress = [property.address, property.city, property.state, property.zip]
      .filter(Boolean)
      .join(", ");

    onSubmit({
      address: fullAddress,
      town: detectedTown,
      zip_code: property.zip,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms || undefined,
      sqft: unit.sqft || undefined,
      property_type: ptMap(property.propertyType),
      current_rent: unit.listedRent || unit.marketRent || undefined,
      appfolio_property_id: property.propertyId,
    });
  }

  // Manual submit
  function handleManualSubmit() {
    if (!address.trim()) return;

    onSubmit({
      address: address.trim(),
      town,
      zip_code: zipCode.trim() || undefined,
      bedrooms: Number(bedrooms),
      bathrooms: bathrooms ? Number(bathrooms) : undefined,
      sqft: sqft ? Number(sqft) : undefined,
      property_type: propertyType,
      amenities: amenities as Amenity[],
      current_rent: currentRent ? Number(currentRent) : undefined,
    });
  }

  return (
    <div className="glass-heavy glass-elevated rounded-2xl overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b border-gray-200/50">
        <button
          type="button"
          onClick={() => setTab("appfolio")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all duration-200 ${
            tab === "appfolio"
              ? "bg-white/60 text-gray-900 border-b-2 border-emerald-600"
              : "text-gray-400 hover:text-gray-600 hover:bg-white/30"
          }`}
        >
          <Building2 className="h-4 w-4" />
          AppFolio Lookup
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all duration-200 ${
            tab === "manual"
              ? "bg-white/60 text-gray-900 border-b-2 border-emerald-600"
              : "text-gray-400 hover:text-gray-600 hover:bg-white/30"
          }`}
        >
          <Home className="h-4 w-4" />
          Manual Entry
        </button>
      </div>

      <div className="p-6">
        {/* ==================== AppFolio Tab ==================== */}
        {tab === "appfolio" && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              Search your AppFolio properties by address to auto-fill the
              property details.
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search by address (e.g. 123 Main St)"
                  className="pl-9 bg-white/70 backdrop-blur-sm"
                  disabled={searching || loading}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={searching || loading || searchQuery.trim().length < 3}
                className="bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white shadow-glow"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {searchError && (
              <div className="p-3 bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-xl text-amber-700 text-sm">
                {searchError}
              </div>
            )}

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {searchResults.length} Properties Found
                </p>
                {searchResults.map((prop) => (
                  <div
                    key={prop.propertyId}
                    className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-gray-100/50">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <span className="font-medium text-sm text-gray-900">
                          {prop.address}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 pl-6">
                        {prop.city}, {prop.state} {prop.zip} &middot;{" "}
                        {prop.propertyType}
                        {prop.name && ` &middot; ${prop.name}`}
                      </p>
                    </div>

                    {prop.units.length > 0 ? (
                      <div className="divide-y divide-gray-100/50">
                        {prop.units.map((unit) => (
                          <button
                            key={unit.unitId}
                            type="button"
                            onClick={() => selectUnit(prop, unit)}
                            disabled={loading}
                            className="w-full px-4 py-2.5 flex items-center justify-between text-sm hover:bg-emerald-50/50 transition-colors disabled:opacity-50"
                          >
                            <div className="flex items-center gap-4 text-gray-600">
                              <span>
                                {unit.bedrooms} BR / {unit.bathrooms || "—"} BA
                              </span>
                              {unit.sqft > 0 && (
                                <span>{unit.sqft.toLocaleString()} sqft</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {(unit.listedRent || unit.marketRent) > 0 && (
                                <span className="font-semibold text-gray-900">
                                  ${(unit.listedRent || unit.marketRent).toLocaleString()}/mo
                                </span>
                              )}
                              <span className="text-xs text-emerald-600 font-medium">
                                Select &rarr;
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-2.5 text-xs text-gray-400">
                        No units found for this property
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400">
              Don&apos;t see your property?{" "}
              <button
                type="button"
                onClick={() => setTab("manual")}
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Enter manually
              </button>
            </p>
          </div>
        )}

        {/* ==================== Manual Tab ==================== */}
        {tab === "manual" && (
          <div className="space-y-5">
            {/* Address & Town */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Address *
                </label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full property address"
                  disabled={loading}
                  className="bg-white/70 backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Town
                </label>
                <select
                  value={town}
                  onChange={(e) => setTown(e.target.value as Town)}
                  disabled={loading}
                  className="flex h-10 w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2"
                >
                  {ALL_TOWNS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Zip Code
                </label>
                <Input
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="97701"
                  disabled={loading}
                  className="bg-white/70 backdrop-blur-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Property Type
                </label>
                <select
                  value={propertyType}
                  onChange={(e) =>
                    setPropertyType(e.target.value as PropertyType)
                  }
                  disabled={loading}
                  className="flex h-10 w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2"
                >
                  {ALL_PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* BR / BA / Sqft */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Bedrooms
                </label>
                <select
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  disabled={loading}
                  className="flex h-10 w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2"
                >
                  <option value="0">Studio</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Bathrooms
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  disabled={loading}
                  className="bg-white/70 backdrop-blur-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Sqft
                </label>
                <Input
                  type="number"
                  min="0"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  placeholder="--"
                  disabled={loading}
                  className="bg-white/70 backdrop-blur-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Current Rent
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    value={currentRent}
                    onChange={(e) => setCurrentRent(e.target.value)}
                    placeholder="Optional"
                    disabled={loading}
                    className="pl-7 bg-white/70 backdrop-blur-sm"
                  />
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Amenities
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_AMENITIES.map((a) => {
                  const active = amenities.includes(a.value);
                  return (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => toggleAmenity(a.value)}
                      disabled={loading}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                        active
                          ? "bg-emerald-100/80 text-emerald-700 ring-1 ring-emerald-300 shadow-sm"
                          : "bg-white/50 text-gray-500 hover:bg-white/70 hover:text-gray-700"
                      } disabled:opacity-50`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4 border-t border-gray-200/50">
              <Button
                onClick={handleManualSubmit}
                disabled={loading || !address.trim()}
                className="bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white shadow-glow hover:shadow-glow-lg transition-all duration-200"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Analyze Property
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
