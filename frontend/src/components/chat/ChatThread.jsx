"use client";

import { memo, useRef, useEffect, useCallback, useState } from "react";
import { ArrowDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { ChatMessage } from "./ChatMessage";
import { ChatComposer } from "./ChatComposer";
import { ChatWelcome } from "./ChatWelcome";

export const ChatThread = memo(
  ({
    messages,
    input,
    setInput,
    onSendMessage,
    streaming,
    onStop,
    onSuggestionClick,
    onPlatformSelect,
  }) => {
    const viewportRef = useRef(null);
    const shouldAutoScrollRef = useRef(true);
    const lastMessageCountRef = useRef(0);

    // Check if user is near bottom
    const isNearBottom = useCallback(() => {
      const viewport = viewportRef.current;
      if (!viewport) return true;
      const threshold = 100;
      return (
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
        threshold
      );
    }, []);

    // Scroll to bottom
    const scrollToBottom = useCallback((smooth = true) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }, []);

    // Handle scroll events
    const handleScroll = useCallback(() => {
      shouldAutoScrollRef.current = isNearBottom();
    }, [isNearBottom]);

    // Auto-scroll when new messages arrive
    useEffect(() => {
      if (messages.length > lastMessageCountRef.current) {
        if (shouldAutoScrollRef.current) {
          scrollToBottom();
        }
      }
      lastMessageCountRef.current = messages.length;
    }, [messages.length, scrollToBottom]);

    // Auto-scroll during streaming (when content updates)
    useEffect(() => {
      if (streaming && shouldAutoScrollRef.current) {
        scrollToBottom();
      }
    }, [streaming, messages, scrollToBottom]);

    // Handle suggestion click
    const handleSuggestionClick = useCallback(
      (prompt) => {
        onSuggestionClick?.(prompt);
      },
      [onSuggestionClick],
    );

    // Handle form submit
    const handleSubmit = useCallback(
      (e) => {
        e?.preventDefault();
        if (input.trim() && !streaming) {
          onSendMessage(input);
        }
      },
      [input, streaming, onSendMessage],
    );

    // Handle input change (synthetic event or direct value)
    const handleInputChange = useCallback(
      (e) => {
        setInput(e.target ? e.target.value : e);
      },
      [setInput],
    );

    // Handle platform selection from dialog
    const handlePlatformSelect = useCallback(
      (platforms, parsedData) => {
        if (onPlatformSelect) {
          onPlatformSelect(platforms, parsedData);
        }
      },
      [onPlatformSelect],
    );

    const isEmpty = messages.length === 0;
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Track scroll position for scroll-to-bottom button
    useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const onScroll = () => setIsAtBottom(isNearBottom());
      viewport.addEventListener("scroll", onScroll, { passive: true });
      return () => viewport.removeEventListener("scroll", onScroll);
    }, [isNearBottom]);

    return (
      <div
        className="flex h-full flex-col bg-background"
        style={{
          "--thread-max-width": "44rem",
          "--composer-radius": "24px",
          "--composer-padding": "10px",
        }}
      >
        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth px-4 pt-4"
        >
          {isEmpty ? (
            <ChatWelcome onSuggestionClick={handleSuggestionClick} />
          ) : (
            <div className="flex flex-col">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id || index}
                  message={message}
                  isLast={index === messages.length - 1}
                  isStreaming={streaming}
                  onPlatformSelect={handlePlatformSelect}
                />
              ))}
            </div>
          )}

          {/* Footer with scroll button and composer */}
          <div className="sticky bottom-0 mx-auto mt-auto flex w-full max-w-3xl flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
            {/* Scroll to bottom button */}
            <ScrollToBottomButton
              onClick={() => {
                shouldAutoScrollRef.current = true;
                scrollToBottom();
              }}
              visible={!isAtBottom && !isEmpty}
            />

            <ChatComposer
              input={input}
              onInputChange={handleInputChange}
              onSubmit={handleSubmit}
              isLoading={streaming}
              onStop={onStop}
            />
          </div>
        </div>
      </div>
    );
  },
);

ChatThread.displayName = "ChatThread";

// Scroll to bottom button component
const ScrollToBottomButton = memo(({ onClick, visible }) => {
  return (
    <TooltipIconButton
      tooltip="Scroll to bottom"
      variant="outline"
      onClick={onClick}
      className={cn(
        "absolute -top-12 z-10 self-center rounded-full p-4 transition-opacity dark:border-border dark:bg-background dark:hover:bg-accent",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowDownIcon className="size-4" />
    </TooltipIconButton>
  );
});

ScrollToBottomButton.displayName = "ScrollToBottomButton";
