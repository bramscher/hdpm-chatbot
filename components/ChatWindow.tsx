"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Minimize2, LogOut, User, Paperclip, FileText, Trash2 } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message, Source } from "@/components/Message";
import { ConversationHistory, ConversationSummary } from "@/components/ConversationHistory";
import { CitationsSidebar } from "@/components/CitationsSidebar";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  attachment?: {
    type: "text" | "pdf";
    name: string;
    preview: string;
    fullContent?: string;
  };
}

interface Attachment {
  type: "text" | "pdf";
  name: string;
  content: string;
  preview: string;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm the **High Desert Property Management** assistant. I can help with:\n\n• **Oregon landlord-tenant law** (ORS Chapter 90)\n• **Security deposits** and move-out procedures\n• **Late fees** and rent collection\n• **Eviction notices** and timelines\n• **Tenant rights** and landlord obligations\n• **Manufactured dwelling parks** and marinas\n\n*Complete ORS Chapter 90 loaded (163 sections)*\n\nWhat would you like to know?",
};

export function ChatWindow({ isOpen, onClose, onMinimize }: ChatWindowProps) {
  const { data: session } = useSession();

  // Conversation state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isFirstMessage, setIsFirstMessage] = useState(true);

  // Message state
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Attachment state
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  // Citations state
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);

  // Get all sources from the latest assistant message
  const currentSources = React.useMemo(() => {
    // Find the last assistant message with sources
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].sources && messages[i].sources!.length > 0) {
        return messages[i].sources!;
      }
    }
    return [];
  }, [messages]);

  // Handle citation click from sidebar
  const handleCitationClick = (index: number) => {
    setHighlightedCitation(index);
    // Clear highlight after a few seconds
    setTimeout(() => setHighlightedCitation(null), 3000);
  };

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    if (session?.user?.email) {
      fetchConversations();
    }
  }, [session?.user?.email, fetchConversations]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Save message to database
  const saveMessage = async (
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    sources?: Source[],
    attachment?: ChatMessage["attachment"]
  ) => {
    try {
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, sources, attachment }),
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  // Generate title for conversation
  const generateTitle = async (conversationId: string, firstMessage: string, hasAttachment: boolean, attachmentName?: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/generate-title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstMessage, hasAttachment, attachmentName }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update local conversations list with new title
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId ? { ...conv, title: data.title } : conv
          )
        );
      }
    } catch (error) {
      console.error("Error generating title:", error);
    }
  };

  // Create new conversation
  const handleNewConversation = async () => {
    setActiveConversationId(null);
    setMessages([WELCOME_MESSAGE]);
    setIsFirstMessage(true);
    setInput("");
    setAttachment(null);
    setShowPasteArea(false);
    setPasteText("");
  };

  // Load existing conversation
  const handleSelectConversation = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/conversations/${id}`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: ChatMessage[] = data.conversation.messages.map((msg: {
          id: string;
          role: "user" | "assistant";
          content: string;
          sources?: Source[];
          attachment?: ChatMessage["attachment"];
        }) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          sources: msg.sources || undefined,
          attachment: msg.attachment || undefined,
        }));

        // Add welcome message at the start if no messages
        if (loadedMessages.length === 0) {
          loadedMessages.unshift(WELCOME_MESSAGE);
        }

        setMessages(loadedMessages);
        setActiveConversationId(id);
        setIsFirstMessage(false);
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((conv) => conv.id !== id));

      // If deleted conversation was active, start new one
      if (activeConversationId === id) {
        handleNewConversation();
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  // Handle PDF file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Extracting text from PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to parse PDF");
      }

      const { text, method } = await response.json();

      if (method === "ocr") {
        setUploadStatus("OCR complete!");
      }

      const preview = text.substring(0, 200) + (text.length > 200 ? "..." : "");

      setAttachment({
        type: "pdf",
        name: file.name + (method === "ocr" ? " (OCR)" : ""),
        content: text,
        preview,
      });
      setShowPasteArea(false);
    } catch (error) {
      console.error("PDF upload error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      alert(`PDF parsing failed: ${errorMsg}`);
    } finally {
      setIsUploading(false);
      setUploadStatus("");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle pasted email/text
  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;

    const preview = pasteText.substring(0, 200) + (pasteText.length > 200 ? "..." : "");
    setAttachment({
      type: "text",
      name: "Pasted Email/Text",
      content: pasteText,
      preview,
    });
    setPasteText("");
    setShowPasteArea(false);
  };

  const clearAttachment = () => {
    setAttachment(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Capture attachment before clearing - make a deep copy to preserve it
    const currentAttachment = attachment ? { ...attachment } : null;
    let conversationId = activeConversationId;

    // If this is the first message, create a new conversation
    if (isFirstMessage || !conversationId) {
      try {
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Conversation" }),
        });

        if (response.ok) {
          const data = await response.json();
          conversationId = data.conversation.id;
          setActiveConversationId(conversationId);

          // Add to conversations list
          setConversations((prev) => [data.conversation, ...prev]);

          // Generate title asynchronously
          if (conversationId) {
            generateTitle(
              conversationId,
              trimmedInput,
              !!currentAttachment,
              currentAttachment?.name
            );
          }
        }
      } catch (error) {
        console.error("Error creating conversation:", error);
      }
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedInput,
      attachment: currentAttachment
        ? {
            type: currentAttachment.type,
            name: currentAttachment.name,
            preview: currentAttachment.preview,
            fullContent: currentAttachment.content,
          }
        : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachment(null);
    setIsLoading(true);
    setIsFirstMessage(false);

    // Save user message to database
    if (conversationId) {
      saveMessage(conversationId, "user", trimmedInput, undefined, userMessage.attachment);
    }

    // Create placeholder for streaming assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    let streamedContent = "";
    let streamedSources: Source[] = [];

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedInput,
          documentContent: currentAttachment?.content,
          documentName: currentAttachment?.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      setStreamingMessageId(assistantMessageId);
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "", sources: [] },
      ]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "sources") {
                streamedSources = data.sources;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, sources: streamedSources }
                      : msg
                  )
                );
              } else if (data.type === "text") {
                streamedContent += data.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: streamedContent }
                      : msg
                  )
                );
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Save assistant message to database after streaming completes
      if (conversationId && streamedContent) {
        saveMessage(conversationId, "assistant", streamedContent, streamedSources);
      }

      // Update conversation in list to move it to top
      setConversations((prev) => {
        const updated = prev.map((conv) =>
          conv.id === conversationId
            ? { ...conv, updated_at: new Date().toISOString() }
            : conv
        );
        return updated.sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "I'm sorry, I encountered an error processing your request. Please try again.",
      };
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== assistantMessageId);
        return [...filtered, errorMessage];
      });
    } finally {
      setIsLoading(false);
      setStreamingMessageId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-y-4 inset-x-4 bg-white rounded-2xl shadow-2xl border border-gray-200 flex overflow-hidden z-50",
        "animate-in slide-in-from-right-5 fade-in duration-300"
      )}
    >
      {/* Conversation History Sidebar */}
      <ConversationHistory
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        isLoading={isLoadingConversations}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-base font-bold">HD</span>
            </div>
            <div>
              <h3 className="font-semibold text-base">High Desert Property Management</h3>
              <p className="text-sm text-white/80">Oregon Landlord-Tenant Law Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={onMinimize}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* User Info Bar */}
        {session?.user && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center">
                <User className="h-4 w-4 text-amber-700" />
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-800">{session.user.name || "User"}</span>
                <span className="text-gray-500 ml-2">{session.user.email}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 h-7 px-2 text-xs"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-3 w-3 mr-1" />
              Sign out
            </Button>
          </div>
        )}

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-100">
            {messages.map((message, index) => {
              let relatedDocument = undefined;
              if (message.role === "assistant" && index > 0) {
                for (let i = index - 1; i >= 0; i--) {
                  if (messages[i].role === "user" && messages[i].attachment) {
                    relatedDocument = messages[i].attachment;
                    break;
                  }
                }
              }

              return (
                <Message
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  sources={message.sources}
                  isStreaming={message.id === streamingMessageId}
                  attachment={message.attachment}
                  relatedDocument={relatedDocument}
                  onCitationClick={handleCitationClick}
                  showInlineSources={false}
                />
              );
            })}
          </div>
        </ScrollArea>

        {/* Paste Area Modal */}
        {showPasteArea && (
          <div className="p-4 border-t border-gray-200 bg-amber-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Paste Email or Correspondence
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPasteArea(false);
                  setPasteText("");
                }}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste email content, tenant letter, or any text you want analyzed..."
              className="w-full h-32 p-3 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex justify-end mt-2">
              <Button
                onClick={handlePasteSubmit}
                disabled={!pasteText.trim()}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700"
              >
                Attach Text
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-5 border-t border-gray-200 bg-gray-50">
          {/* Upload Progress */}
          {isUploading && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-amber-800">
                  {uploadStatus || "Processing PDF..."}
                </span>
                <p className="text-xs text-amber-600 mt-1">
                  Scanned PDFs use AI vision to extract text
                </p>
              </div>
            </div>
          )}

          {/* Attachment Preview */}
          {attachment && !isUploading && (
            <div className="mb-3 p-3 bg-white border border-amber-200 rounded-lg flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {attachment.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                    {attachment.type === "pdf" ? "PDF" : "Text"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{attachment.preview}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAttachment}
                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            {/* Attachment buttons */}
            <div className="flex gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading}
                className="h-12 w-12 border-gray-300"
                title="Upload PDF"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Paperclip className="h-5 w-5 text-gray-600" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowPasteArea(!showPasteArea)}
                disabled={isLoading}
                className="h-12 w-12 border-gray-300"
                title="Paste email/text"
              >
                <FileText className="h-5 w-5 text-gray-600" />
              </Button>
            </div>

            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                attachment
                  ? "Ask about this document..."
                  : "Ask about Oregon landlord-tenant law (ORS 90)..."
              }
              disabled={isLoading}
              className="flex-1 bg-white h-12 text-base px-4"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 h-12 px-6"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-3 text-center">
            High Desert Property Management • Internal Use Only • 163 ORS 90 Sections Loaded
          </p>
        </form>
      </div>

      {/* Citations Sidebar */}
      <CitationsSidebar
        sources={currentSources}
        highlightedCitation={highlightedCitation}
        onCitationClick={handleCitationClick}
      />
    </div>
  );
}
