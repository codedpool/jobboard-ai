"use client";

import { memo, useState, useCallback } from "react";
import {
  CheckIcon,
  CopyIcon,
  RefreshCwIcon,
  MoreHorizontalIcon,
  BotIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { MarkdownRenderer } from "./MarkdownRenderer";
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
    .trim();
}

// Check if content has jobs data
function hasJobsData(content) {
  if (!content) return false;
  return /<!--JOBS:.*?-->/s.test(content);
}

// User Message Component
const UserMessage = memo(({ message }) => {
  return (
    <div
      className="group fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-3xl animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 duration-150"
      data-role="user"
    >
      <div className="relative col-start-2 min-w-0">
        <div className="wrap-break-word rounded-2xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-foreground">
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
    <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50" style={{ animationDelay: "0ms" }} />
    <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50" style={{ animationDelay: "150ms" }} />
    <div className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50" style={{ animationDelay: "300ms" }} />
  </div>
);

// Assistant Message Component
const AssistantMessage = memo(({ message, onCopy, isLast, isStreaming }) => {
  const [isCopied, setIsCopied] = useState(false);

  const content = message.content || "";
  const showJobs = hasJobsData(content);
  const displayContent = stripHiddenContent(content);

  const handleCopy = useCallback(async () => {
    if (isCopied) return;
    try {
      await navigator.clipboard.writeText(displayContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [displayContent, isCopied]);

  const isEmpty = !displayContent && !showJobs;
  const isCurrentlyStreaming = isStreaming && isLast;

  return (
    <div
      className="fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-3xl animate-in py-3 duration-150"
      data-role="assistant"
    >
      {/* Avatar indicator */}
      <div className="mb-1.5 ml-2 flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
          <BotIcon className="size-3.5 text-primary" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Assistant</span>
        {isCurrentlyStreaming && (
          <span className="text-xs text-primary/70 animate-pulse">typing...</span>
        )}
      </div>

      <div className="wrap-break-word px-2 text-foreground leading-relaxed">
        {/* Show streaming placeholder if empty and streaming */}
        {isEmpty && isCurrentlyStreaming ? (
          <StreamingDots />
        ) : (
          <>
            {/* Markdown content */}
            {displayContent && <MarkdownRenderer content={displayContent} />}

            {/* Job tiles */}
            {showJobs && <JobListMessage content={content} />}
          </>
        )}
      </div>

      {/* Action Bar - Show when not streaming and has content */}
      {!isCurrentlyStreaming && displayContent && (
        <div className="mt-1 ml-2 flex min-h-6 items-center gap-1 text-muted-foreground">
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
  );
});

AssistantMessage.displayName = "AssistantMessage";

// Main ChatMessage Component
export const ChatMessage = memo(
  ({ message, onCopy, isLast, isStreaming }) => {
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
        />
      );
    }

    return null;
  }
);

ChatMessage.displayName = "ChatMessage";
