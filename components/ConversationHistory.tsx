"use client";

import React, { useState } from "react";
import { MessageSquarePlus, Clock, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user_email: string;
  user_name?: string;
}

interface ConversationHistoryProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  currentUserEmail?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isLoading: boolean;
}

function getInitials(name?: string, email?: string): string {
  if (name) {
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
  return '??';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

export function ConversationHistory({
  conversations,
  activeConversationId,
  currentUserEmail,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isLoading,
}: ConversationHistoryProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      setDeletingId(id);
      try {
        await onDeleteConversation(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 border-r border-emerald-400/40 flex flex-col items-center py-4 bg-gradient-to-b from-emerald-100/90 via-emerald-50/70 to-emerald-50/80 backdrop-blur-xl shadow-[inset_-8px_0_20px_-6px_rgba(61,122,61,0.15)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="mb-4"
          title="Expand history"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewConversation}
          className="text-emerald-700 hover:text-emerald-700 hover:bg-emerald-50/50"
          title="New conversation"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-emerald-400/40 flex flex-col bg-gradient-to-b from-emerald-100/90 via-emerald-50/70 to-emerald-50/80 backdrop-blur-xl shadow-[inset_-8px_0_20px_-6px_rgba(61,122,61,0.15)]">
      {/* Header */}
      <div className="p-4 border-b border-emerald-300/30 flex items-center justify-between">
        <h3 className="font-semibold text-emerald-900">Team History</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewConversation}
            className="h-8 w-8 text-emerald-700 hover:text-emerald-700 hover:bg-emerald-50/50"
            title="New conversation"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            className="h-8 w-8"
            title="Collapse"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Clock className="h-8 w-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No conversations yet</p>
            <p className="text-xs text-gray-400 mt-1">Start a new conversation to see it here</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => {
              const initials = getInitials(conversation.user_name, conversation.user_email);
              const isOwner = currentUserEmail === conversation.user_email;

              return (
                <div
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn(
                    "group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ease-spring",
                    activeConversationId === conversation.id
                      ? "bg-emerald-100/60 border border-emerald-300/50"
                      : "hover:bg-white/40 border border-transparent"
                  )}
                >
                  <div className="pr-8">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      activeConversationId === conversation.id
                        ? "text-emerald-900"
                        : "text-gray-800"
                    )}>
                      {conversation.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                          isOwner
                            ? "bg-emerald-300/80 text-emerald-700"
                            : "bg-blue-100 text-blue-700"
                        )}
                        title={conversation.user_name || conversation.user_email}
                      >
                        {initials}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(conversation.updated_at)}
                      </span>
                    </div>
                  </div>

                  {/* Delete button - only for conversation creator */}
                  {isOwner && (
                    <button
                      onClick={(e) => handleDelete(e, conversation.id)}
                      disabled={deletingId === conversation.id}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200",
                        "text-gray-400 hover:text-red-500 hover:bg-red-50/80",
                        deletingId === conversation.id && "opacity-100"
                      )}
                      title="Delete conversation"
                    >
                      {deletingId === conversation.id ? (
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-emerald-300/30">
        <Button
          onClick={onNewConversation}
          className="w-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white shadow-glow rounded-xl transition-all duration-300"
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>
    </div>
  );
}
