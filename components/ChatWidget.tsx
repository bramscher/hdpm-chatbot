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
          "fixed bottom-5 right-5 w-14 h-14 rounded-full z-50",
          "bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700",
          "shadow-glow hover:shadow-glow-lg",
          "transition-all duration-300 ease-spring hover:scale-110 active:scale-95",
          "animate-scale-in",
          isOpen && !isMinimized && "rotate-0"
        )}
      >
        <MessageCircle className="h-6 w-6 text-white" />
        {isMinimized && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
        )}
      </Button>
    </>
  );
}
