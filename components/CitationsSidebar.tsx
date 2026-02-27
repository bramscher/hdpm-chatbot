"use client";

import React, { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Source } from "@/components/Message";

interface CitationsSidebarProps {
  sources: Source[];
  highlightedCitation: number | null;
  onCitationClick: (index: number) => void;
}

export function CitationsSidebar({
  sources,
  highlightedCitation,
  onCitationClick,
}: CitationsSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <div className="w-12 border-l border-emerald-300/40 flex flex-col items-center py-4 bg-gradient-to-b from-emerald-100/90 via-emerald-50/70 to-green-50/80 backdrop-blur-xl shadow-[inset_8px_0_20px_-6px_rgba(61,122,61,0.15)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="mb-4"
          title="Expand citations"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        {sources.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            <span className="text-xs font-bold text-emerald-700">{sources.length}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-emerald-300/40 flex flex-col bg-gradient-to-b from-emerald-100/90 via-emerald-50/70 to-green-50/80 backdrop-blur-xl shadow-[inset_8px_0_20px_-6px_rgba(61,122,61,0.15)]">
      {/* Header */}
      <div className="p-4 border-b border-emerald-200/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-green-700" />
          <h3 className="font-semibold text-emerald-900">Legal Sources</h3>
          {sources.length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-emerald-100/80 text-emerald-700 rounded-full font-medium">
              {sources.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(true)}
          className="h-8 w-8"
          title="Collapse"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-3">
        {sources.length === 0 ? (
          <div className="text-center py-8 px-4">
            <BookOpen className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">No sources yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Ask a question to see relevant ORS 90 citations
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((source, index) => (
              <div
                key={source.id}
                id={`citation-${index + 1}`}
                onClick={() => onCitationClick(index)}
                className={cn(
                  "p-3 rounded-xl cursor-pointer transition-all duration-200 ease-spring",
                  highlightedCitation === index
                    ? "bg-emerald-100/80 border-2 border-emerald-500 shadow-md shadow-emerald-300/50"
                    : "bg-white/60 backdrop-blur-sm border border-white/30 hover:border-emerald-400/50 hover:shadow-sm"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold shrink-0",
                      highlightedCitation === index
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{source.icon}</span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {source.title}
                      </span>
                    </div>
                    {source.section && (
                      <p className="text-xs text-emerald-700 mt-1 font-medium">
                        ORS {source.section}
                      </p>
                    )}
                  </div>
                </div>

                {/* Link to source */}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-700 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  View full text
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {sources.length > 0 && (
        <div className="p-3 border-t border-emerald-200/30 bg-emerald-50/50 backdrop-blur-sm">
          <p className="text-xs text-emerald-700 text-center">
            Click citation numbers in chat to highlight sources
          </p>
        </div>
      )}
    </div>
  );
}
