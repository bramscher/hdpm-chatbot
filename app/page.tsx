"use client";

import Link from "next/link";
import { FileText, BarChart3, ArrowUpRight, Zap, TrendingUp, Clock } from "lucide-react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  return (
    <>
      <div className="px-8 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8 animate-slide-up">
          <p className="text-xs font-semibold text-terra-500 uppercase tracking-widest mb-1">
            Dashboard
          </p>
          <h1 className="text-2xl font-bold text-charcoal-900 tracking-tight">
            {getGreeting()}
          </h1>
          <p className="text-sm text-charcoal-400 mt-1">
            Your automation tools are ready.
          </p>
        </div>

        {/* Tool Cards */}
        <div className="grid lg:grid-cols-2 gap-5 stagger-children">
          {/* Invoice Generator */}
          <Link
            href="/maintenance/invoices"
            className="group bg-white rounded-xl border border-sand-200 p-6 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 block relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-terra-50 rounded-bl-[80px] -mr-4 -mt-4 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 bg-terra-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-terra-600" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-charcoal-300 group-hover:text-terra-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
              </div>
              <h3 className="text-base font-semibold text-charcoal-900 mb-1.5">
                Invoice Generator
              </h3>
              <p className="text-sm text-charcoal-400 leading-relaxed">
                Generate invoices from AppFolio work orders, CSV uploads, or scanned PDFs.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-charcoal-300">
                  <Zap className="w-3 h-3" />
                  <span>Auto-extract</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-charcoal-300">
                  <Clock className="w-3 h-3" />
                  <span>PDF export</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Rent Comps */}
          <Link
            href="/comps"
            className="group bg-white rounded-xl border border-sand-200 p-6 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 block relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[80px] -mr-4 -mt-4 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-charcoal-300 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
              </div>
              <h3 className="text-base font-semibold text-charcoal-900 mb-1.5">
                Rent Comps
              </h3>
              <p className="text-sm text-charcoal-400 leading-relaxed">
                Compare rental rates across Central Oregon with AppFolio, Rentometer, and HUD FMR data.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-charcoal-300">
                  <TrendingUp className="w-3 h-3" />
                  <span>Market analysis</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-charcoal-300">
                  <BarChart3 className="w-3 h-3" />
                  <span>PDF reports</span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Stats / Status */}
        <div className="mt-8 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <div className="bg-white rounded-xl border border-sand-200 p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm font-medium text-charcoal-900">All systems operational</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-charcoal-400">
                <span>AppFolio API: <span className="text-green-600 font-medium">Connected</span></span>
                <span>Rentometer: <span className="text-green-600 font-medium">Active</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
