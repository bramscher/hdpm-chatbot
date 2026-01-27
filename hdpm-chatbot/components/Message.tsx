"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface Source {
  id: string;
  title: string;
  url: string;
  type: string;
  icon: string;
  section: string | null;
}

interface AttachmentInfo {
  type: "text" | "pdf";
  name: string;
  preview: string;
}

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isLoading?: boolean;
  isStreaming?: boolean;
  attachment?: AttachmentInfo;
}

interface CitationTooltipProps {
  citationNum: number;
  source: Source | undefined;
  children: React.ReactNode;
}

function CitationTooltip({ citationNum, source, children }: CitationTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isHovered && source && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-80 p-3 bg-gray-900 text-white text-sm rounded-xl shadow-xl pointer-events-none">
          <span className="flex items-center gap-2 mb-1">
            <span className="text-lg">{source.icon}</span>
            <span className="font-semibold">{source.title}</span>
          </span>
          {source.section && (
            <span className="text-amber-300 text-sm">ORS {source.section}</span>
          )}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

/**
 * Parse markdown-like formatting in content
 */
function parseMarkdown(text: string): string {
  // Convert ## headers to styled text
  return text
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-4 mb-2">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-gray-800 mt-3 mb-1">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/\n/g, '<br/>');
}

/**
 * Parse message content and convert citation references [1], [2] etc to interactive elements
 */
function parseCitations(content: string, sources?: Source[]): React.ReactNode[] {
  // First apply markdown parsing
  const formattedContent = parseMarkdown(content);

  // Split by citation pattern
  const parts = formattedContent.split(/(\[\d+\])/g);

  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const citationNum = parseInt(match[1], 10);
      const source = sources?.[citationNum - 1];

      return (
        <CitationTooltip key={index} citationNum={citationNum} source={source}>
          <a
            href={`#source-${citationNum}`}
            className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 mx-0.5 text-sm font-bold bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition-colors cursor-pointer border border-amber-200"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(`source-${citationNum}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            {citationNum}
          </a>
        </CitationTooltip>
      );
    }

    // Render HTML content safely (since we control the input)
    return (
      <span
        key={index}
        dangerouslySetInnerHTML={{ __html: part }}
      />
    );
  });
}

export function Message({ role, content, sources, isLoading, isStreaming, attachment }: MessageProps) {
  const isUser = role === "user";
  const [expandedSources, setExpandedSources] = useState(true); // Default to expanded

  if (isLoading) {
    return (
      <div className="flex gap-4 p-5">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
          AI
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5 items-center">
            <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            <span className="ml-3 text-base text-gray-600">Searching ORS Chapter 90...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-4 p-5", isUser ? "bg-gray-50" : "bg-white")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0",
          isUser
            ? "bg-gradient-to-br from-gray-600 to-gray-800"
            : "bg-gradient-to-br from-amber-500 to-orange-600"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-hidden">
        {/* Attachment indicator for user messages */}
        {isUser && attachment && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{attachment.type === "pdf" ? "📄" : "📝"}</span>
              <span className="text-sm font-medium text-amber-800">{attachment.name}</span>
              <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                {attachment.type === "pdf" ? "PDF Parsed" : "Text Attached"}
              </span>
            </div>
            <div className="text-xs text-gray-600 bg-white p-2 rounded border border-amber-100 max-h-24 overflow-y-auto">
              <span className="font-medium text-amber-700">Document preview:</span>
              <p className="mt-1 whitespace-pre-wrap">{attachment.preview}</p>
            </div>
          </div>
        )}

        {/* Message text with inline citations */}
        <div className="prose prose-base max-w-none text-gray-800 leading-relaxed">
          <p className="mb-3">
            {parseCitations(content, sources)}
            {isStreaming && (
              <span className="inline-block w-2 h-5 ml-1 bg-amber-500 animate-pulse rounded-sm" />
            )}
          </p>
        </div>

        {/* Sources - Collapsible */}
        {sources && sources.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => setExpandedSources(!expandedSources)}
              className="flex items-center gap-2 text-sm font-semibold text-amber-700 uppercase tracking-wide hover:text-amber-800 transition-colors"
            >
              <svg
                className={cn(
                  "w-4 h-4 transition-transform",
                  expandedSources ? "rotate-90" : ""
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {sources.length} Legal Source{sources.length !== 1 ? 's' : ''} Referenced
            </button>

            {expandedSources && (
              <ul className="mt-4 space-y-3">
                {sources.map((source, index) => (
                  <li
                    key={source.id}
                    id={`source-${index + 1}`}
                    className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors"
                  >
                    <span className="flex items-center justify-center w-8 h-8 bg-amber-200 text-amber-800 rounded-lg text-sm font-bold shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-xl shrink-0">{source.icon}</span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium text-amber-800 hover:text-amber-900 hover:underline block"
                      >
                        {source.title}
                      </a>
                      {source.section && (
                        <span className="text-sm text-amber-600">ORS {source.section}</span>
                      )}
                    </div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-200 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
