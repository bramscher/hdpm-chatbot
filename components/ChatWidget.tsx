"use client";

import React, { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/ChatWindow";
import { cn } from "@/lib/utils";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleToggle = () => {
    if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  return (
    <>
      {/* Chat Window */}
      <ChatWindow
        isOpen={isOpen && !isMinimized}
        onClose={handleClose}
        onMinimize={handleMinimize}
      />

      {/* Floating Button */}
      <Button
        onClick={handleToggle}
        className={cn(
          "fixed bottom-5 right-5 w-12 h-12 rounded-full z-50",
          "bg-terra-500 hover:bg-terra-600",
          "shadow-md hover:shadow-lg",
          "transition-all duration-200 hover:scale-105 active:scale-95"
        )}
      >
        <MessageCircle className="h-5 w-5 text-white" />
        {isMinimized && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
        )}
      </Button>
    </>
  );
}
