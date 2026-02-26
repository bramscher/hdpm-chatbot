import Link from "next/link";
import { ChatWidget } from "@/components/ChatWidget";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-white/30 text-violet-600 px-4 py-2 rounded-full text-sm font-medium mb-6 glass-shine">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
            AI-Powered Knowledge Base
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-6 tracking-tight">
            HDPM Assistant
          </h1>

          <p className="text-xl text-gray-500 mb-10 leading-relaxed">
            Get instant answers from your knowledge base. Our AI assistant
            searches through policies, regulations, and documentation to
            provide accurate, cited responses.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-14 stagger-children">
            <div className="flex items-center gap-2 glass-subtle glass-shine rounded-2xl px-5 py-3">
              <span className="text-2xl">&#x2696;&#xFE0F;</span>
              <span className="text-gray-700 font-medium">Laws &amp; Regulations</span>
            </div>
            <div className="flex items-center gap-2 glass-subtle glass-shine rounded-2xl px-5 py-3">
              <span className="text-2xl">&#x1F3AC;</span>
              <span className="text-gray-700 font-medium">Video Resources</span>
            </div>
            <div className="flex items-center gap-2 glass-subtle glass-shine rounded-2xl px-5 py-3">
              <span className="text-2xl">&#x1F4C4;</span>
              <span className="text-gray-700 font-medium">Policy Documents</span>
            </div>
            <Link
              href="/maintenance/invoices"
              className="flex items-center gap-2 glass-subtle glass-shine rounded-2xl px-5 py-3 hover:bg-white/80 transition-all duration-200 ease-spring hover:-translate-y-0.5"
            >
              <span className="text-2xl">&#x1F9FE;</span>
              <span className="text-gray-700 font-medium">Invoice Generator</span>
            </Link>
          </div>

          <div className="glass-heavy glass-elevated rounded-3xl p-8 text-left animate-slide-up">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              How it works
            </h2>
            <ol className="space-y-5">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-500 text-white rounded-xl flex items-center justify-center font-semibold shadow-glow text-sm">
                  1
                </span>
                <div>
                  <h3 className="font-medium text-gray-900">Ask a question</h3>
                  <p className="text-gray-500 mt-0.5">
                    Click the chat button in the bottom right corner and type
                    your question.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-500 text-white rounded-xl flex items-center justify-center font-semibold shadow-glow text-sm">
                  2
                </span>
                <div>
                  <h3 className="font-medium text-gray-900">AI searches your knowledge base</h3>
                  <p className="text-gray-500 mt-0.5">
                    Our system uses semantic search to find the most relevant
                    information from your documents.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-500 text-white rounded-xl flex items-center justify-center font-semibold shadow-glow text-sm">
                  3
                </span>
                <div>
                  <h3 className="font-medium text-gray-900">
                    Get cited answers
                  </h3>
                  <p className="text-gray-500 mt-0.5">
                    Receive accurate responses with inline citations and
                    clickable source links.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto stagger-children">
          <div className="glass glass-shine rounded-2xl p-6 hover:shadow-glass-lg transition-all duration-300 ease-spring hover:-translate-y-1">
            <div className="w-12 h-12 bg-violet-100/80 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-violet-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Semantic Search
            </h3>
            <p className="text-gray-500">
              Find relevant information based on meaning, not just keywords.
            </p>
          </div>

          <div className="glass glass-shine rounded-2xl p-6 hover:shadow-glass-lg transition-all duration-300 ease-spring hover:-translate-y-1">
            <div className="w-12 h-12 bg-emerald-100/80 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Verified Sources
            </h3>
            <p className="text-gray-500">
              Every answer includes citations linking back to the original
              documents.
            </p>
          </div>

          <div className="glass glass-shine rounded-2xl p-6 hover:shadow-glass-lg transition-all duration-300 ease-spring hover:-translate-y-1">
            <div className="w-12 h-12 bg-rose-100/80 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-rose-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Instant Answers
            </h3>
            <p className="text-gray-500">
              Get responses in seconds, powered by Claude&apos;s advanced AI.
            </p>
          </div>
        </div>
      </div>

      {/* Chat Widget */}
      <ChatWidget />
    </main>
  );
}
