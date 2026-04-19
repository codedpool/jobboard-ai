"use client";

import { useCallback, useRef } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { ChatThread, ChatSidebar } from "@/components/chat";
import { Logo } from "@/components/Logo";
import { useChat } from "@/hooks/useChat";
import { useThreads } from "@/hooks/useThreads";

export default function DashboardPage() {
  const { user } = useUser();

  const {
    threads,
    activeThreadId,
    loading: threadsLoading,
    createDraftThread,
    persistThread,
    isDraftThread,
    selectThread,
    updateThreadTitle,
    deleteThread,
  } = useThreads();

  const {
    messages,
    input,
    setInput,
    sendMessage,
    streaming,
    stop,
    error,
    loadHistory,
    selectPlatforms,
  } = useChat({ threadId: activeThreadId });

  const titledThreadsRef = useRef(new Set());

  const handleSelectThread = useCallback(
    (threadId) => {
      selectThread(threadId);
      loadHistory(threadId);
    },
    [selectThread, loadHistory],
  );

  const handleNewThread = useCallback(() => {
    createDraftThread();
  }, [createDraftThread]);

  const handleSendMessage = useCallback(
    async (text) => {
      let tid = activeThreadId;

      if (!tid) {
        const draftThread = createDraftThread();
        tid = draftThread.id;
      }

      if (isDraftThread(tid)) {
        const title = text.length > 50 ? text.slice(0, 50) + "..." : text;
        const realThread = await persistThread(tid, title);
        if (!realThread) return;
        tid = realThread.id;
        titledThreadsRef.current.add(tid);
      }

      await sendMessage(text, tid);

      if (tid && !titledThreadsRef.current.has(tid)) {
        titledThreadsRef.current.add(tid);
        const title = text.length > 50 ? text.slice(0, 50) + "..." : text;
        updateThreadTitle(tid, title);
      }
    },
    [
      activeThreadId,
      createDraftThread,
      isDraftThread,
      persistThread,
      sendMessage,
      updateThreadTitle,
    ],
  );

  const handleSuggestionClick = useCallback(
    async (prompt) => {
      setInput(prompt);
      setTimeout(() => {
        handleSendMessage(prompt);
      }, 50);
    },
    [setInput, handleSendMessage],
  );

  const displayName =
    user?.firstName ||
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    "you";

  return (
    <div className="flex h-screen bg-[#fafaf7] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-100">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/70 bg-[#f5f4ef]/60 dark:border-slate-800/70 dark:bg-[#0b0b11]/70 md:flex">
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Logo variant="icon" height={30} href="/dashboard" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <ChatSidebar
            threads={threads}
            activeThreadId={activeThreadId}
            loading={threadsLoading}
            onNewThread={handleNewThread}
            onSelectThread={handleSelectThread}
            onDeleteThread={deleteThread}
            onRenameThread={updateThreadTitle}
          />
        </div>

        <div className="border-t border-slate-200/70 px-3 py-3 dark:border-slate-800/70">
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800/40">
            <UserButton
              appearance={{
                elements: { avatarBox: "h-8 w-8" },
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                Personal workspace
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col bg-transparent">
        <ChatThread
          messages={messages}
          input={input}
          setInput={setInput}
          onSendMessage={handleSendMessage}
          streaming={streaming}
          onStop={stop}
          onSuggestionClick={handleSuggestionClick}
          onPlatformSelect={selectPlatforms}
        />
      </main>
    </div>
  );
}
