"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyInput } from "@/components/comps/PropertyInput";
import {
  AnalysisResults,
  ReportReady,
} from "@/components/comps/AnalysisResults";
import type {
  SubjectProperty,
  RentAnalysis,
  CompetingListing,
} from "@/types/comps";

interface RentAnalysisWizardProps {
  userEmail: string;
  userName: string;
}

type Step = "input" | "results" | "report";

export function RentAnalysisWizard({
  userEmail,
  userName,
}: RentAnalysisWizardProps) {
  const [step, setStep] = useState<Step>("input");
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [zillowLoading, setZillowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [subject, setSubject] = useState<SubjectProperty | null>(null);
  const [analysis, setAnalysis] = useState<RentAnalysis | null>(null);
  const [competingListings, setCompetingListings] = useState<CompetingListing[]>([]);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Step 1: Analyze property
  async function handlePropertySubmit(subjectProp: SubjectProperty) {
    setSubject(subjectProp);
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/comps/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectProp,
          competing_listings: [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAnalysis(data.analysis);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  // Search Zillow for competing listings
  async function handleSearchZillow() {
    if (!subject || !analysis) return;
    setZillowLoading(true);

    try {
      const res = await fetch(
        `/api/comps/zillow?town=${encodeURIComponent(subject.town)}&bedrooms=${subject.bedrooms}`
      );
      const data = await res.json();

      if (data.listings && data.listings.length > 0) {
        setCompetingListings(data.listings);

        // Re-generate analysis with Zillow data
        const reportRes = await fetch("/api/comps/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            competing_listings: data.listings,
          }),
        });

        const reportData = await reportRes.json();
        if (reportRes.ok) {
          setAnalysis(reportData.analysis);
        }
      } else if (data.zillow_url) {
        // Scraping failed or no results — open Zillow in new tab
        window.open(data.zillow_url, "_blank");
      }
    } catch (err) {
      console.error("Zillow search failed:", err);
    } finally {
      setZillowLoading(false);
    }
  }

  // Generate final PDF report
  async function handleGenerateReport() {
    if (!subject || !analysis) return;
    setGeneratingReport(true);
    setError(null);

    try {
      const res = await fetch("/api/comps/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          competing_listings: competingListings,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAnalysis(data.analysis);
      setPdfBase64(data.pdf_base64);
      setDownloadUrl(data.download_url || null);
      setStep("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setGeneratingReport(false);
    }
  }

  // Reset to start
  function handleStartOver() {
    setStep("input");
    setSubject(null);
    setAnalysis(null);
    setCompetingListings([]);
    setPdfBase64(null);
    setDownloadUrl(null);
    setError(null);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/comps">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Comps
            </Button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl flex items-center justify-center shadow-glow">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                Rent Analysis Report
              </h2>
              <p className="text-xs text-gray-400">
                Generate branded reports for property owners
              </p>
            </div>
          </div>
        </div>

        {step !== "input" && (
          <Button
            onClick={handleStartOver}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-gray-600"
          >
            Start Over
          </Button>
        )}
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 px-1">
        {[
          { key: "input", label: "Property" },
          { key: "results", label: "Analysis" },
          { key: "report", label: "Report" },
        ].map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <ChevronRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
            )}
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-200 ${
                step === s.key
                  ? "bg-emerald-100 text-emerald-700"
                  : ["input", "results", "report"].indexOf(step) >
                    ["input", "results", "report"].indexOf(s.key)
                  ? "text-emerald-500"
                  : "text-gray-300"
              }`}
            >
              {s.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Steps */}
      {step === "input" && (
        <PropertyInput onSubmit={handlePropertySubmit} loading={analyzing} />
      )}

      {step === "results" && analysis && (
        <AnalysisResults
          analysis={analysis}
          onGenerateReport={handleGenerateReport}
          onSearchZillow={handleSearchZillow}
          generatingReport={generatingReport}
          zillowLoading={zillowLoading}
        />
      )}

      {step === "report" && analysis && pdfBase64 && (
        <ReportReady
          analysis={analysis}
          pdfBase64={pdfBase64}
          downloadUrl={downloadUrl}
        />
      )}

      {/* Footer */}
      <p className="text-center text-[10px] text-gray-300 pb-8">
        Powered by AppFolio, HUD FMR, and Zillow market data
      </p>
    </div>
  );
}
