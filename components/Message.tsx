"use client";

import React, { useState } from "react";
import { Copy, FileDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAsText, copyToClipboard, exportToPDF, ExportData } from "@/lib/export";

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
  fullContent?: string;
}

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isLoading?: boolean;
  isStreaming?: boolean;
  attachment?: AttachmentInfo;
  relatedDocument?: AttachmentInfo;
  onCitationClick?: (index: number) => void;
  showInlineSources?: boolean;
  senderName?: string;
  senderEmail?: string;
  createdAt?: string;
}

function getSenderInitials(name?: string, email?: string): string {
  if (name && name !== 'AI Assistant') {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) {
    const local = email.split('@')[0];
    return local.substring(0, 2).toUpperCase();
  }
  return '';
}

function formatMessageTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 p-3 bg-charcoal-900 text-white text-sm rounded-lg shadow-xl pointer-events-none">
          <span className="flex items-center gap-2 mb-1">
            <span className="text-base">{source.icon}</span>
            <span className="font-medium text-[13px]">{source.title}</span>
          </span>
          {source.section && (
            <span className="text-terra-300 text-xs">ORS {source.section}</span>
          )}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-charcoal-900" />
        </span>
      )}
    </span>
  );
}

function parseMarkdown(text: string): string {
  let result = text
    // Collapse blank lines between bullet items so they stay tight
    .replace(/(^[•\-] .+)\n\n(?=[•\-] )/gm, '$1\n')
    .replace(/^## (.+)$/gm, '<h3 class="text-sm font-semibold text-charcoal-900 mt-3 mb-1">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-charcoal-800 mt-2 mb-0.5">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-charcoal-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-charcoal-500 italic">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc leading-snug">$1</li>')
    .replace(/^• (.+)$/gm, '<li class="ml-4 list-disc leading-snug">$1</li>')
    .replace(/\n\n/g, '</p><p class="mt-1.5">')
    .replace(/\n/g, '<br/>');

  // Remove <br/> between consecutive list items
  result = result.replace(/<\/li><br\/><li/g, '</li><li');

  return result;
}

function parseCitations(
  content: string,
  sources?: Source[],
  onCitationClick?: (index: number) => void
): React.ReactNode[] {
  const formattedContent = parseMarkdown(content);
  const parts = formattedContent.split(/(\[\d+\])/g);

  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const citationNum = parseInt(match[1], 10);
      const source = sources?.[citationNum - 1];

      return (
        <CitationTooltip key={index} citationNum={citationNum} source={source}>
          <button
            className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 mx-0.5 text-xs font-bold bg-terra-100 text-terra-700 rounded hover:bg-terra-200 transition-colors cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              const citationEl = document.getElementById(`citation-${citationNum}`);
              if (citationEl) {
                citationEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              if (onCitationClick) {
                onCitationClick(citationNum - 1);
              }
            }}
          >
            {citationNum}
          </button>
        </CitationTooltip>
      );
    }

    return (
      <span
        key={index}
        dangerouslySetInnerHTML={{ __html: part }}
      />
    );
  });
}

export function Message({
  role,
  content,
  sources,
  isLoading,
  isStreaming,
  attachment,
  relatedDocument,
  onCitationClick,
  showInlineSources = false,
  senderName,
  senderEmail,
  createdAt,
}: MessageProps) {
  const isUser = role === "user";
  const initials = isUser ? getSenderInitials(senderName, senderEmail) : '';
  const timeStr = formatMessageTime(createdAt);
  const [expandedSources, setExpandedSources] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const documentForExport = relatedDocument || attachment;

  const handleCopyToClipboard = async () => {
    const exportData: ExportData = {
      documentName: documentForExport?.name,
      documentContent: documentForExport?.fullContent || documentForExport?.preview,
      aiResponse: content,
      sources: sources || [],
      timestamp: new Date(),
    };

    const text = formatAsText(exportData);
    const success = await copyToClipboard(text);

    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const exportData: ExportData = {
        documentName: documentForExport?.name,
        documentContent: documentForExport?.fullContent || documentForExport?.preview,
        aiResponse: content,
        sources: sources || [],
        timestamp: new Date(),
      };

      await exportToPDF(exportData);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-3">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-charcoal-900 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            AI
          </div>
          <div className="flex gap-1.5 items-center pt-1.5">
            <div className="w-1.5 h-1.5 bg-charcoal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 h-1.5 bg-charcoal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 h-1.5 bg-charcoal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            <span className="ml-2 text-sm text-charcoal-400">Searching ORS Chapter 90...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "px-6 py-3",
      isUser ? "bg-sand-50/50" : ""
    )}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0 pt-0.5">
          <div
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
              isUser
                ? "bg-terra-100 text-terra-700"
                : "bg-charcoal-900 text-white"
            )}
            title={senderName || senderEmail || (isUser ? 'User' : 'AI Assistant')}
          >
            {isUser ? (initials || "U") : "AI"}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Sender info */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-charcoal-800">
              {isUser ? (senderName || "You") : "Assistant"}
            </span>
            {timeStr && (
              <span className="text-2xs text-charcoal-300">{timeStr}</span>
            )}
          </div>

          {/* Attachment indicator for user messages */}
          {isUser && attachment && (
            <div className="p-2.5 bg-white border border-sand-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm">{attachment.type === "pdf" ? "\uD83D\uDCC4" : "\uD83D\uDCDD"}</span>
                <span className="text-[13px] font-medium text-charcoal-700">{attachment.name}</span>
                <span className="text-2xs px-1.5 py-0.5 bg-sand-100 text-charcoal-500 rounded font-medium">
                  {attachment.type === "pdf" ? "PDF" : "Text"}
                </span>
              </div>
              <p className="text-xs text-charcoal-400 mt-1.5 line-clamp-2 pl-6">{attachment.preview}</p>
            </div>
          )}

          {/* Message text with inline citations */}
          <div className="text-sm text-charcoal-700 leading-normal [&_li]:my-0 [&_p]:my-0">
            <p>
              {parseCitations(content, sources, onCitationClick)}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 ml-0.5 bg-charcoal-800 animate-pulse rounded-sm" />
              )}
            </p>
          </div>

          {/* Sources - Collapsible (only shown if showInlineSources is true) */}
          {showInlineSources && sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-sand-200">
              <button
                onClick={() => setExpandedSources(!expandedSources)}
                className="flex items-center gap-2 text-xs font-semibold text-charcoal-500 uppercase tracking-wide hover:text-charcoal-700 transition-colors"
              >
                <svg
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    expandedSources ? "rotate-90" : ""
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {sources.length} Source{sources.length !== 1 ? 's' : ''}
              </button>

              {expandedSources && (
                <ul className="mt-3 space-y-2">
                  {sources.map((source, index) => (
                    <li
                      key={source.id}
                      id={`source-${index + 1}`}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-sand-50 border border-sand-200 hover:border-sand-300 transition-colors"
                    >
                      <span className="flex items-center justify-center w-6 h-6 bg-sand-200 text-charcoal-600 rounded-md text-xs font-bold shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] font-medium text-charcoal-700 hover:text-terra-700 block"
                        >
                          {source.title}
                        </a>
                        {source.section && (
                          <span className="text-2xs text-terra-600">ORS {source.section}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Export buttons for assistant messages */}
          {!isUser && !isStreaming && content && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyToClipboard}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  copySuccess
                    ? "bg-green-50 text-green-700"
                    : "text-charcoal-400 hover:text-charcoal-600 hover:bg-sand-100"
                )}
                title="Copy to clipboard"
              >
                {copySuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  exportingPDF
                    ? "text-charcoal-300 cursor-wait"
                    : "text-charcoal-400 hover:text-charcoal-600 hover:bg-sand-100"
                )}
                title="Download as PDF"
              >
                {exportingPDF ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-charcoal-300 border-t-transparent rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    PDF
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
