"use client";

import React from "react";
import {
  TrendingUp,
  DollarSign,
  Home,
  BarChart3,
  FileText,
  Download,
  Mail,
  Link2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RentAnalysis, RentalComp } from "@/types/comps";

interface AnalysisResultsProps {
  analysis: RentAnalysis;
  onGenerateReport: () => void;
  onSearchZillow: () => void;
  generatingReport: boolean;
  zillowLoading: boolean;
  ownerName: string;
  ownerEmail: string;
  onOwnerNameChange: (value: string) => void;
  onOwnerEmailChange: (value: string) => void;
}

function fmt(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${
        accent
          ? "bg-gradient-to-br from-terra-500 to-green-700 text-white shadow-glow"
          : "glass-heavy"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon
          className={`h-3.5 w-3.5 ${accent ? "text-white/70" : "text-charcoal-400"}`}
        />
        <span
          className={`text-[10px] font-medium uppercase tracking-wider ${
            accent ? "text-white/70" : "text-charcoal-400"
          }`}
        >
          {label}
        </span>
      </div>
      <p
        className={`text-xl font-bold ${accent ? "text-white" : "text-charcoal-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

function CompRow({ comp, index }: { comp: RentalComp; index: number }) {
  return (
    <tr className={index % 2 === 0 ? "bg-white/40" : "bg-charcoal-50/40"}>
      <td className="px-3 py-2 text-sm text-charcoal-900 max-w-[200px] truncate">
        {comp.address || "N/A"}
      </td>
      <td className="px-3 py-2 text-sm text-charcoal-600">{comp.town}</td>
      <td className="px-3 py-2 text-sm text-charcoal-600">
        {comp.bedrooms}/{comp.bathrooms || "--"}
      </td>
      <td className="px-3 py-2 text-sm text-charcoal-600">
        {comp.sqft ? comp.sqft.toLocaleString() : "--"}
      </td>
      <td className="px-3 py-2 text-sm font-semibold text-charcoal-900">
        {fmt(Number(comp.monthly_rent))}
      </td>
      <td className="px-3 py-2 text-sm text-charcoal-500">
        {comp.rent_per_sqft
          ? `$${Number(comp.rent_per_sqft).toFixed(2)}`
          : "--"}
      </td>
      <td className="px-3 py-2 text-xs text-charcoal-400 whitespace-nowrap">
        {comp.comp_date
          ? new Date(comp.comp_date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "2-digit",
            })
          : "--"}
      </td>
    </tr>
  );
}

export function AnalysisResults({
  analysis,
  onGenerateReport,
  onSearchZillow,
  generatingReport,
  zillowLoading,
  ownerName,
  ownerEmail,
  onOwnerNameChange,
  onOwnerEmailChange,
}: AnalysisResultsProps) {
  const { subject, stats, comparable_comps, competing_listings, methodology_notes } =
    analysis;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Subject summary */}
      <div className="glass-heavy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Home className="h-4 w-4 text-terra-600" />
          <span className="text-xs font-medium text-charcoal-400 uppercase tracking-wider">
            Subject Property
          </span>
        </div>
        <p className="font-semibold text-charcoal-900">{subject.address}</p>
        <p className="text-sm text-charcoal-500 mt-0.5">
          {subject.town}, OR {subject.zip_code || ""} &middot;{" "}
          {subject.bedrooms} BR / {subject.bathrooms || "--"} BA &middot;{" "}
          {subject.sqft ? `${subject.sqft.toLocaleString()} sqft` : "N/A sqft"}{" "}
          &middot; {subject.property_type}
        </p>
        {subject.current_rent && (
          <p className="text-sm text-charcoal-400 mt-1">
            Current Rent: {fmt(subject.current_rent)}/mo
          </p>
        )}
      </div>

      {/* Recommended Rent — hero card */}
      <div className="bg-gradient-to-r from-terra-600 to-green-700 rounded-2xl p-6 text-white shadow-glow-lg">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-white/70" />
          <span className="text-sm font-medium text-white/70 uppercase tracking-wider">
            Recommended Rent
          </span>
        </div>
        <p className="text-4xl font-bold tracking-tight">
          {fmt(analysis.recommended_rent_low)} &ndash;{" "}
          {fmt(analysis.recommended_rent_high)}
          <span className="text-lg font-normal text-white/70">/mo</span>
        </p>
        <p className="text-white/80 mt-1">
          Target: {fmt(analysis.recommended_rent_mid)}/mo
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Avg Rent" value={fmt(stats.avg_rent)} icon={DollarSign} />
        <StatCard
          label="Median Rent"
          value={fmt(stats.median_rent)}
          icon={BarChart3}
        />
        <StatCard
          label="Range"
          value={`${fmt(stats.min_rent)} - ${fmt(stats.max_rent)}`}
          icon={TrendingUp}
        />
        <StatCard
          label="Sample Size"
          value={String(stats.count)}
          icon={FileText}
        />
      </div>

      {stats.avg_sqft && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Avg Sqft"
            value={stats.avg_sqft.toLocaleString()}
            icon={Home}
          />
          <StatCard
            label="Avg $/Sqft"
            value={
              stats.avg_rent_per_sqft
                ? `$${stats.avg_rent_per_sqft.toFixed(2)}`
                : "N/A"
            }
            icon={DollarSign}
          />
        </div>
      )}

      {/* Methodology notes */}
      {methodology_notes.length > 0 && (
        <div className="glass-heavy rounded-xl p-4">
          <h4 className="text-xs font-medium text-charcoal-400 uppercase tracking-wider mb-3">
            How We Calculated This
          </h4>
          <ul className="space-y-1.5">
            {methodology_notes.map((note, i) => (
              <li key={i} className="text-xs text-charcoal-600 flex gap-2">
                <span className="text-terra-500 flex-shrink-0">&bull;</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Comparable properties table */}
      <div className="glass-heavy rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-charcoal-200/50">
          <h4 className="text-xs font-medium text-charcoal-400 uppercase tracking-wider">
            Top {comparable_comps.length} Comparable Properties
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-terra-600 text-white">
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
                  Address
                </th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
                  Town
                </th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
                  BR/BA
                </th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
                  Sqft
                </th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
                  Rent
                </th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
                  $/Sqft
                </th>
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {comparable_comps.map((comp, i) => (
                <CompRow key={comp.id} comp={comp} index={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zillow section */}
      {competing_listings.length > 0 && (
        <div className="glass-heavy rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-charcoal-200/50">
            <h4 className="text-xs font-medium text-charcoal-400 uppercase tracking-wider">
              Zillow Competing Listings ({competing_listings.length})
            </h4>
          </div>
          <div className="divide-y divide-charcoal-100/50">
            {competing_listings.map((listing, i) => (
              <div
                key={i}
                className="px-4 py-2.5 flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-4">
                  <span className="text-charcoal-900 font-medium max-w-[240px] truncate">
                    {listing.address}
                  </span>
                  <span className="text-charcoal-500">
                    {listing.bedrooms} BR
                    {listing.bathrooms ? ` / ${listing.bathrooms} BA` : ""}
                  </span>
                  {listing.sqft && (
                    <span className="text-charcoal-400">
                      {listing.sqft.toLocaleString()} sqft
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-charcoal-900">
                    {fmt(listing.price)}/mo
                  </span>
                  {listing.listing_url && (
                    <a
                      href={listing.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-terra-600 hover:text-terra-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner details — personalization */}
      <div className="glass-heavy rounded-xl p-4">
        <h4 className="text-xs font-medium text-charcoal-400 uppercase tracking-wider mb-3">
          Property Owner (optional)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="owner-name" className="block text-xs text-charcoal-500 mb-1">
              Owner Name
            </label>
            <input
              id="owner-name"
              type="text"
              placeholder="e.g. John Doe"
              value={ownerName}
              onChange={(e) => onOwnerNameChange(e.target.value)}
              className="w-full rounded-lg border border-charcoal-200 bg-white/60 px-3 py-2 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
            />
          </div>
          <div>
            <label htmlFor="owner-email" className="block text-xs text-charcoal-500 mb-1">
              Owner Email
            </label>
            <input
              id="owner-email"
              type="email"
              placeholder="e.g. john@example.com"
              value={ownerEmail}
              onChange={(e) => onOwnerEmailChange(e.target.value)}
              className="w-full rounded-lg border border-charcoal-200 bg-white/60 px-3 py-2 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
            />
          </div>
        </div>
        <p className="text-[10px] text-charcoal-400 mt-2">
          Name adds &ldquo;Report prepared exclusively for&rdquo; to the PDF. Email pre-fills the &ldquo;Email to Owner&rdquo; button.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 justify-center pt-2">
        {competing_listings.length === 0 && (
          <Button
            onClick={onSearchZillow}
            disabled={zillowLoading}
            variant="outline"
            className="border-terra-200 text-terra-700 hover:bg-terra-50"
          >
            {zillowLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Search Zillow
          </Button>
        )}

        <Button
          onClick={onGenerateReport}
          disabled={generatingReport}
          className="bg-gradient-to-r from-terra-600 to-green-700 hover:from-terra-700 hover:to-green-800 text-white shadow-glow hover:shadow-glow-lg transition-all duration-200"
        >
          {generatingReport ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Generate PDF Report
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Report Ready Component
// ============================================

interface ReportReadyProps {
  analysis: RentAnalysis;
  pdfBase64: string;
  downloadUrl: string | null;
  shortUrl?: string | null;
  ownerName?: string;
  ownerEmail?: string;
}

export function ReportReady({
  analysis,
  pdfBase64,
  downloadUrl,
  shortUrl,
  ownerName,
  ownerEmail,
}: ReportReadyProps) {
  const { subject } = analysis;

  function handleDownload() {
    const byteChars = atob(pdfBase64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNums[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNums);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent-analysis_${subject.town}_${subject.address.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Prefer short URL for sharing, fall back to signed URL
  const shareUrl = shortUrl || downloadUrl;
  const shareExpiry = shortUrl ? "30 days" : "24 hours";

  function handleCopyLink() {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
    }
  }

  function handleEmail() {
    const greeting = ownerName ? `Hello ${ownerName},` : "Hello,";
    const subjectLine = `Rent Analysis Report - ${subject.address}`;

    const reportLink = shareUrl
      ? `View your rent analysis report here:\n${shareUrl}\n\n(This link expires in ${shareExpiry})`
      : "Please see the attached PDF report.";

    const body = `${greeting}

Please find the rent analysis report for ${subject.address}, ${subject.town}, OR.

Based on ${analysis.stats.count} comparable properties, our recommended rent range is ${fmt(analysis.recommended_rent_low)} - ${fmt(analysis.recommended_rent_high)}/mo.

${reportLink}

Best regards,
High Desert Property Management
541-548-0383 | info@highdesertpm.com
highdesertpm.com`;

    const mailto = ownerEmail ? `mailto:${encodeURIComponent(ownerEmail)}` : "mailto:";
    window.location.href = `${mailto}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Success header */}
      <div className="text-center py-4">
        <div className="w-14 h-14 mx-auto bg-gradient-to-br from-terra-500 to-green-700 rounded-2xl flex items-center justify-center shadow-glow mb-4">
          <FileText className="h-7 w-7 text-white" />
        </div>
        <h3 className="text-xl font-bold text-charcoal-900">Report Ready</h3>
        <p className="text-sm text-charcoal-500 mt-1">
          Rent analysis for {subject.address}
        </p>
      </div>

      {/* Recommendation preview */}
      <div className="glass-heavy rounded-xl p-5 text-center">
        <p className="text-xs font-medium text-charcoal-400 uppercase tracking-wider mb-2">
          Recommended Rent
        </p>
        <p className="text-3xl font-bold text-terra-700">
          {fmt(analysis.recommended_rent_low)} &ndash;{" "}
          {fmt(analysis.recommended_rent_high)}
          <span className="text-base font-normal text-charcoal-400">/mo</span>
        </p>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleDownload}
          className="w-full bg-gradient-to-r from-terra-600 to-green-700 hover:from-terra-700 hover:to-green-800 text-white shadow-glow hover:shadow-glow-lg transition-all duration-200"
        >
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>

        <Button
          onClick={handleEmail}
          variant="outline"
          className="w-full border-terra-200 text-terra-700 hover:bg-terra-50"
        >
          <Mail className="h-4 w-4 mr-2" />
          Email to Owner
        </Button>

        {shareUrl && (
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="w-full border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Copy Report Link
          </Button>
        )}
      </div>

      {shareUrl && (
        <p className="text-center text-[10px] text-charcoal-400">
          Report link expires in {shareExpiry}
        </p>
      )}
    </div>
  );
}
