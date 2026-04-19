"use client";

import { memo, useState, useCallback } from "react";
import {
  CheckIcon,
  CopyIcon,
  MoreHorizontalIcon,
  Sparkles,
} from "lucide-react";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { PlatformSelector } from "./PlatformSelector";
import JobListMessage from "@/components/JobListMessage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Strip hidden comments from content for display
function stripHiddenContent(content) {
  if (!content) return "";
  return content
    .replace(/<!--JOBS:.*?-->/gs, "")
    .replace(/<!--PARSED:.*?-->/gs, "")
    .replace(/<!--PLATFORMS:.*?-->/gs, "")
    .trim();
}

// Check if content has jobs data
function hasJobsData(content) {
  if (!content) return false;
  return /<!--JOBS:.*?-->/s.test(content);
}

// Check if asking for platform selection
function isAskingForPlatforms(content) {
  if (!content) return false;
  const lower = content.toLowerCase();
  return (
    (lower.includes("which platform") ||
      lower.includes("select platform") ||
      lower.includes("choose.*platform")) &&
    /<!--PARSED:.*?-->/s.test(content)
  );
}

// Extract parsed data from content
function extractParsedData(content) {
  if (!content) return null;
  const match = content.match(/<!--PARSED:(.*?)-->/s);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (_) {
      return null;
    }
  }
  return null;
}

// User Message Component
const UserMessage = memo(({ message }) => {
  return (
    <div
      className="group fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-3xl animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 duration-150"
      data-role="user"
    >
      <div className="relative col-start-2 min-w-0">
        <div className="wrap-break-word rounded-2xl rounded-br-md bg-slate-900/[0.06] border border-slate-900/[0.04] px-4 py-2.5 text-[15px] leading-relaxed text-slate-900 dark:bg-white/[0.08] dark:border-white/[0.06] dark:text-slate-100">
          {message.content}
        </div>
      </div>
    </div>
  );
});

UserMessage.displayName = "UserMessage";

// Streaming indicator dots
const StreamingDots = () => (
  <div className="flex items-center gap-1 py-1">
    <div
      className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50"
      style={{ animationDelay: "0ms" }}
    />
    <div
      className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50"
      style={{ animationDelay: "150ms" }}
    />
    <div
      className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50"
      style={{ animationDelay: "300ms" }}
    />
  </div>
);

// Assistant Message Component
const AssistantMessage = memo(
  ({ message, onCopy, isLast, isStreaming, onPlatformSelect }) => {
    const [isSelectingPlatforms, setIsSelectingPlatforms] = useState(false);

    const content = message.content || "";
    const showJobs = hasJobsData(content);
    const askingForPlatforms = isAskingForPlatforms(content);
    const displayContent = stripHiddenContent(content);
    const parsedData = extractParsedData(content);

    const handleCopy = useCallback(async () => {
      if (isSelectingPlatforms) return;
      try {
        await navigator.clipboard.writeText(displayContent);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }, [displayContent, isSelectingPlatforms]);

    const handlePlatformSelect = useCallback(
      (platforms) => {
        setIsSelectingPlatforms(true);
        onPlatformSelect?.(platforms, parsedData);
      },
      [onPlatformSelect, parsedData],
    );

    const [isCopied, setIsCopied] = useState(false);
    const isEmpty = !displayContent && !showJobs;
    const isCurrentlyStreaming = isStreaming && isLast;

    return (
      <div
        className="group fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-3xl animate-in py-4 duration-150"
        data-role="assistant"
      >
        <div className="flex items-start gap-3">
          <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white">
            <Sparkles className="size-3" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="wrap-break-word text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
              {isEmpty && isCurrentlyStreaming ? (
                <StreamingDots />
              ) : (
                <>
                  {displayContent && <MarkdownRenderer content={displayContent} />}

                  {showJobs && <JobListMessage content={content} />}

                  {askingForPlatforms && !isSelectingPlatforms && (
                    <div className="mt-4">
                      <PlatformSelector
                        onSelect={handlePlatformSelect}
                        isLoading={isSelectingPlatforms}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {!isCurrentlyStreaming && displayContent && !askingForPlatforms && (
              <div className="mt-2 flex min-h-6 items-center gap-1 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500">
                <TooltipIconButton
                  tooltip={isCopied ? "Copied!" : "Copy"}
                  onClick={handleCopy}
                >
                  {isCopied ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </TooltipIconButton>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <TooltipIconButton
                      tooltip="More"
                      className="data-[state=open]:bg-accent"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </TooltipIconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="bottom"
                    align="start"
                    className="min-w-32"
                  >
                    <DropdownMenuItem
                      onClick={handleCopy}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <CopyIcon className="size-4" />
                      Copy as text
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

AssistantMessage.displayName = "AssistantMessage";

// Main ChatMessage Component
export const ChatMessage = memo(
  ({ message, onCopy, isLast, isStreaming, onPlatformSelect }) => {
    if (message.role === "user") {
      return <UserMessage message={message} />;
    }

    if (message.role === "assistant") {
      return (
        <AssistantMessage
          message={message}
          onCopy={onCopy}
          isLast={isLast}
          isStreaming={isStreaming}
          onPlatformSelect={onPlatformSelect}
        />
      );
    }

    return null;
  },
);

ChatMessage.displayName = "ChatMessage";
