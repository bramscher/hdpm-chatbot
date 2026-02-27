import Link from "next/link";
import Image from "next/image";
import { ChatWidget } from "@/components/ChatWidget";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="container mx-auto px-4 pt-14 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-5 mb-3 animate-slide-up">
            <Image
              src="/hdpm-logo.png"
              alt="High Desert Property Management"
              width={72}
              height={47}
              priority
              className="flex-shrink-0"
            />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
                High Desert Property Management
              </h1>
              <p className="text-lg font-medium text-emerald-700 mt-0.5">
                Automation Dashboard
              </p>
            </div>
          </div>

          {/* Green accent bar */}
          <div className="h-0.5 bg-gradient-to-r from-emerald-600 via-green-500 to-transparent rounded-full mt-6 mb-2" />
        </div>
      </div>

      {/* Tools Grid */}
      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-6">
            Tools
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {/* Invoice Generator */}
            <Link
              href="/maintenance/invoices"
              className="group glass glass-shine rounded-2xl p-6 hover:shadow-glow-lg transition-all duration-300 ease-spring hover:-translate-y-1 block"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl flex items-center justify-center mb-5 shadow-glow group-hover:scale-105 transition-transform duration-300">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1.5 flex items-center justify-between">
                Invoice Generator
                <svg className="w-5 h-5 text-gray-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Generate branded PDF invoices for maintenance work orders. Upload CSV or scan work order PDFs.
              </p>
            </Link>

            {/* AI Knowledge Base */}
            <div className="group glass glass-shine rounded-2xl p-6 hover:shadow-glow-lg transition-all duration-300 ease-spring hover:-translate-y-1 cursor-default">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl flex items-center justify-center mb-5 shadow-glow group-hover:scale-105 transition-transform duration-300">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1.5">
                AI Knowledge Base
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Search policies, regulations, and documentation with AI-powered semantic search. Click the chat button below.
              </p>
            </div>

            {/* Rent Comparison Toolkit */}
            <Link
              href="/comps"
              className="group glass glass-shine rounded-2xl p-6 hover:shadow-glow-lg transition-all duration-300 ease-spring hover:-translate-y-1 block"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-700 rounded-xl flex items-center justify-center mb-5 shadow-glow group-hover:scale-105 transition-transform duration-300">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1.5 flex items-center justify-between">
                Rent Comps
                <svg className="w-5 h-5 text-gray-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Compare rental rates across Central Oregon. AppFolio, Rentometer, HUD FMR, and manual entry.
              </p>
            </Link>
          </div>
        </div>
      </div>

      {/* Chat Widget */}
      <ChatWidget />
    </main>
  );
}
