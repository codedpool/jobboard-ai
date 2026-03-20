"use client";

import { useCallback, useRef } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { ChatThread, ChatSidebar } from "@/components/chat";
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
  } = useChat({ threadId: activeThreadId });

  // Track whether we've auto-titled the active thread
  const titledThreadsRef = useRef(new Set());

  // Handle selecting a thread from sidebar
  const handleSelectThread = useCallback(
    (threadId) => {
      selectThread(threadId);
      // Load history when user selects an existing thread
      loadHistory(threadId);
    },
    [selectThread, loadHistory],
  );

  // Handle creating a new thread (draft only)
  const handleNewThread = useCallback(() => {
    createDraftThread();
  }, [createDraftThread]);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (text) => {
      let tid = activeThreadId;

      // Auto-create draft thread if none selected
      if (!tid) {
        const draftThread = createDraftThread();
        tid = draftThread.id;
      }

      // If this is a draft thread, persist it now
      if (isDraftThread(tid)) {
        const title = text.length > 50 ? text.slice(0, 50) + "..." : text;
        const realThread = await persistThread(tid, title);
        if (!realThread) return;
        tid = realThread.id;
        titledThreadsRef.current.add(tid);
      }

      // Send the message with the real thread ID
      await sendMessage(text, tid);

      // Auto-title: after first user message, set the thread title (for non-draft threads)
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

  // Handle suggestion click from welcome screen
  const handleSuggestionClick = useCallback(
    async (prompt) => {
      setInput(prompt);
      // Use a small delay to ensure state is set before sending
      setTimeout(() => {
        handleSendMessage(prompt);
      }, 50);
    },
    [setInput, handleSendMessage],
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Link href="/dashboard">
            <span className="text-sm font-semibold text-foreground">
              Job Board AI
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {user && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                {user.firstName ||
                  user.emailAddresses?.[0]?.emailAddress?.split("@")[0]}
              </span>
            )}
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
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
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col">
        <ChatThread
          messages={messages}
          input={input}
          setInput={setInput}
          onSendMessage={handleSendMessage}
          streaming={streaming}
          onStop={stop}
          onSuggestionClick={handleSuggestionClick}
        />
      </main>
    </div>
  );
}
