"use client";

import React, { useState } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ALL_TOWNS,
  ALL_PROPERTY_TYPES,
  ALL_AMENITIES,
  type Town,
  type PropertyType,
} from "@/types/comps";

interface AddCompFormProps {
  onBack: () => void;
  onSaved: () => void;
}

export function AddCompForm({ onBack, onSaved }: AddCompFormProps) {
  const [town, setTown] = useState<Town>("Bend");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("2");
  const [sqft, setSqft] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("SFR");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [compDate, setCompDate] = useState(new Date().toISOString().split("T")[0]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAmenity(val: string) {
    setAmenities((prev) =>
      prev.includes(val) ? prev.filter((a) => a !== val) : [...prev, val]
    );
  }

  async function handleSave() {
    setError(null);

    if (!monthlyRent || Number(monthlyRent) <= 0) {
      setError("Monthly rent is required and must be greater than 0");
      return;
    }

    setIsSaving(true);

    try {
      const sqftNum = sqft ? Number(sqft) : undefined;
      const rentNum = Number(monthlyRent);

      const res = await fetch("/api/comps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          town,
          address: address.trim() || undefined,
          zip_code: zipCode.trim() || undefined,
          bedrooms: Number(bedrooms),
          bathrooms: bathrooms ? Number(bathrooms) : undefined,
          sqft: sqftNum,
          property_type: propertyType,
          monthly_rent: rentNum,
          comp_date: compDate,
          amenities,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isSaving}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h3 className="text-lg font-semibold text-gray-900">Add Rent Comp</h3>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="glass-heavy glass-elevated rounded-2xl p-6 space-y-6">
        {/* Town & Property Type */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Town
            </label>
            <select
              value={town}
              onChange={(e) => setTown(e.target.value as Town)}
              disabled={isSaving}
              className="flex h-10 w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              Property Type
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as PropertyType)}
              disabled={isSaving}
              className="flex h-10 w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ALL_PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Address & Zip */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Address (optional)
            </label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address"
              disabled={isSaving}
              className="bg-white/70 backdrop-blur-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Zip Code
            </label>
            <Input
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="97701"
              disabled={isSaving}
              className="bg-white/70 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* BR / BA / Sqft / Date */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Bedrooms
            </label>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              disabled={isSaving}
              className="flex h-10 w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              disabled={isSaving}
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
              placeholder="—"
              disabled={isSaving}
              className="bg-white/70 backdrop-blur-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Comp Date
            </label>
            <Input
              type="date"
              value={compDate}
              onChange={(e) => setCompDate(e.target.value)}
              disabled={isSaving}
              className="bg-white/70 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Monthly Rent */}
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Monthly Rent *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              $
            </span>
            <Input
              type="number"
              step="1"
              min="0"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              placeholder="0"
              disabled={isSaving}
              className="pl-7 bg-white/70 backdrop-blur-sm font-semibold text-lg"
            />
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
                  disabled={isSaving}
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

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
            disabled={isSaving}
            className="flex w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200/50">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white shadow-glow hover:shadow-glow-lg transition-all duration-200"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Comp
          </Button>
        </div>
      </div>
    </div>
  );
}
