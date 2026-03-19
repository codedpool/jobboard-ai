"use client";

import { memo, useRef, useEffect } from "react";
import { ArrowUpIcon, SquareIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/tooltip-icon-button";

export const ChatComposer = memo(({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onStop,
  placeholder = "Send a message...",
  disabled = false,
}) => {
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  }, [input]);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading && !disabled) {
        onSubmit(e);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
      onSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex w-full flex-col">
      <div
        className={cn(
          "flex w-full flex-col gap-2 rounded-3xl border bg-background p-2.5 transition-shadow",
          "focus-within:border-ring/75 focus-within:ring-2 focus-within:ring-ring/20",
          disabled && "opacity-50"
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={onInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "max-h-32 min-h-10 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none",
            "placeholder:text-muted-foreground/80"
          )}
          aria-label="Message input"
        />
        
        <div className="relative flex items-center justify-between">
          {/* Attachment button placeholder */}
          <TooltipIconButton
            tooltip="Add attachment"
            variant="ghost"
            size="icon"
            type="button"
            className="size-8 rounded-full p-1 hover:bg-muted-foreground/15"
            disabled
          >
            <PlusIcon className="size-5 stroke-[1.5px]" />
          </TooltipIconButton>

          {/* Send / Stop button */}
          {!isLoading ? (
            <TooltipIconButton
              tooltip="Send message"
              type="submit"
              variant="default"
              size="icon"
              className="size-8 rounded-full"
              disabled={!input.trim() || disabled}
              aria-label="Send message"
            >
              <ArrowUpIcon className="size-4" />
            </TooltipIconButton>
          ) : (
            <Button
              type="button"
              variant="default"
              size="icon"
              className="size-8 rounded-full"
              onClick={onStop}
              aria-label="Stop generating"
            >
              <SquareIcon className="size-3 fill-current" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
});

ChatComposer.displayName = "ChatComposer";
