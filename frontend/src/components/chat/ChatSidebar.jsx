"use client";

import { memo, useState } from "react";
import {
  PlusIcon,
  MoreHorizontalIcon,
  TrashIcon,
  PencilIcon,
  MessageSquareIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const ChatSidebar = memo(
  ({
    threads,
    activeThreadId,
    loading,
    onNewThread,
    onSelectThread,
    onDeleteThread,
    onRenameThread,
  }) => {
    return (
      <div className="flex flex-col gap-1 p-2">
        {/* New Thread Button */}
        <Button
          variant="outline"
          className="h-9 justify-start gap-2 rounded-lg px-3 text-sm hover:bg-muted"
          onClick={onNewThread}
        >
          <PlusIcon className="size-4" />
          New Chat
        </Button>

        {/* Loading State */}
        {loading && <ThreadListSkeleton />}

        {/* Thread List - filter out draft threads with no title */}
        {!loading && (
          <div className="flex flex-col gap-0.5 mt-1">
            {threads.filter((t) => !t.id.startsWith("draft-")).length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No conversations yet
              </div>
            ) : (
              threads
                .filter((t) => !t.id.startsWith("draft-"))
                .map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    onSelect={() => onSelectThread(thread.id)}
                    onDelete={() => onDeleteThread(thread.id)}
                    onRename={(newTitle) => onRenameThread(thread.id, newTitle)}
                  />
                ))
            )}
          </div>
        )}
      </div>
    );
  }
);

ChatSidebar.displayName = "ChatSidebar";

// Individual thread item
const ThreadItem = memo(
  ({ thread, isActive, onSelect, onDelete, onRename }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(thread.title || "");

    const handleRenameSubmit = () => {
      if (renameValue.trim() && renameValue !== thread.title) {
        onRename(renameValue.trim());
      }
      setIsRenaming(false);
    };

    const handleRenameCancel = () => {
      setRenameValue(thread.title || "");
      setIsRenaming(false);
    };

    if (isRenaming) {
      return (
        <div className="flex h-9 items-center gap-2 rounded-lg bg-muted px-3">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") handleRenameCancel();
            }}
            onBlur={handleRenameSubmit}
            className="flex-1 bg-transparent text-sm outline-none"
            autoFocus
          />
        </div>
      );
    }

    const displayTitle = thread.title || "Untitled chat";

    return (
      <div
        className={cn(
          "group flex h-9 items-center gap-2 rounded-lg transition-colors",
          "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
          isActive && "bg-muted"
        )}
      >
        <button
          className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-start text-sm"
          onClick={onSelect}
        >
          <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{displayTitle}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "mr-2 size-7 p-0 opacity-0 transition-opacity",
                "group-hover:opacity-100 data-[state=open]:bg-accent data-[state=open]:opacity-100",
                isActive && "opacity-100"
              )}
            >
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            className="min-w-32"
          >
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(thread.title || "");
                setIsRenaming(true);
              }}
              className="flex cursor-pointer items-center gap-2"
            >
              <PencilIcon className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="flex cursor-pointer items-center gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <TrashIcon className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

ThreadItem.displayName = "ThreadItem";

// Loading skeleton
const ThreadListSkeleton = () => {
  return (
    <div className="flex flex-col gap-1 mt-1">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="flex h-9 items-center px-3"
          role="status"
          aria-label="Loading threads"
        >
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
};
