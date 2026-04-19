"use client";

import { memo, useState } from "react";
import {
  PlusIcon,
  MoreHorizontalIcon,
  TrashIcon,
  PencilIcon,
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
    const visible = threads.filter((t) => !t.id.startsWith("draft-"));

    return (
      <div className="flex flex-col gap-4 pt-2">
        <button
          onClick={onNewThread}
          className="group flex h-9 items-center justify-between rounded-xl border border-slate-200/80 bg-white/60 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900/70"
        >
          <span className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" strokeWidth={2} />
            New chat
          </span>
          <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 font-mono text-[10px] text-slate-500 group-hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:inline-block">
            ⌘K
          </kbd>
        </button>

        <div>
          <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Conversations
          </p>

          {loading && <ThreadListSkeleton />}

          {!loading && visible.length === 0 && (
            <p className="px-2 py-3 text-sm text-slate-500 dark:text-slate-400">
              Nothing here yet — ask your first question.
            </p>
          )}

          {!loading && visible.length > 0 && (
            <div className="flex flex-col">
              {visible.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onSelect={() => onSelectThread(thread.id)}
                  onDelete={() => onDeleteThread(thread.id)}
                  onRename={(newTitle) => onRenameThread(thread.id, newTitle)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

ChatSidebar.displayName = "ChatSidebar";

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
        <div className="flex h-9 items-center gap-2 rounded-lg bg-slate-200/60 px-3 dark:bg-slate-800/60">
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
          "group relative flex h-9 items-center gap-1 rounded-lg pl-3 pr-1 transition-colors",
          isActive
            ? "bg-slate-200/60 dark:bg-slate-800/60"
            : "hover:bg-slate-200/40 dark:hover:bg-slate-800/40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1.5 h-6 w-[2px] rounded-full transition-opacity",
            isActive
              ? "bg-gradient-to-b from-violet-500 to-sky-500 opacity-100"
              : "opacity-0",
          )}
        />
        <button
          onClick={onSelect}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm transition-colors",
            isActive
              ? "font-medium text-slate-900 dark:text-white"
              : "text-slate-600 dark:text-slate-400",
          )}
        >
          {displayTitle}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-7 shrink-0 p-0 opacity-0 transition-opacity",
                "group-hover:opacity-100 data-[state=open]:opacity-100",
                isActive && "opacity-60",
              )}
            >
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="min-w-32">
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
  },
);

ThreadItem.displayName = "ThreadItem";

const ThreadListSkeleton = () => {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex h-9 items-center px-3" role="status">
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
};
