"use client";

import { memo, useRef, useEffect } from "react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const ChatComposer = memo(
  ({
    input,
    onInputChange,
    onSubmit,
    isLoading,
    onStop,
    placeholder = "Ask about a role, stack, or location…",
    disabled = false,
  }) => {
    const textareaRef = useRef(null);

    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
      }
    }, [input]);

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
      <form onSubmit={handleSubmit} className="relative w-full">
        <div
          className={cn(
            "group relative flex items-end gap-2 rounded-3xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl transition",
            "focus-within:border-slate-300 focus-within:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)]",
            "dark:border-slate-800/80 dark:bg-slate-900/70 dark:focus-within:border-slate-700",
            disabled && "opacity-50",
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
              "max-h-40 min-h-[28px] w-full resize-none bg-transparent py-1 pr-1 text-[15px] leading-6 outline-none",
              "placeholder:text-slate-400 dark:placeholder:text-slate-500",
            )}
            aria-label="Message input"
          />

          {!isLoading ? (
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              disabled={!input.trim() || disabled}
              aria-label="Send message"
            >
              <ArrowUpIcon className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              onClick={onStop}
              aria-label="Stop generating"
            >
              <SquareIcon className="h-3 w-3 fill-current" />
            </Button>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Press <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] dark:border-slate-800 dark:bg-slate-900">Enter</kbd> to send ·{" "}
          <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] dark:border-slate-800 dark:bg-slate-900">Shift+Enter</kbd> for newline
        </p>
      </form>
    );
  },
);

ChatComposer.displayName = "ChatComposer";
