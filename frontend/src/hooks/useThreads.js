"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Hook to manage thread list backed by Postgres via FastAPI.
 * Supports "draft" threads that are not persisted until the first message.
 */
export function useThreads() {
  const { getToken } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  // Track which thread IDs are drafts (not yet persisted)
  const draftThreadIds = useRef(new Set());

  /**
   * Fetch all threads from backend.
   */
  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/threads");
      if (!res.ok) {
        console.error("Failed to fetch threads:", res.status);
        return;
      }
      const data = await res.json();
      const sorted = (Array.isArray(data) ? data : []).sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
      );
      setThreads(sorted);
      return sorted;
    } catch (err) {
      console.error("Error fetching threads:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Load threads on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchThreads();
    }
  }, [fetchThreads]);

  /**
   * Create a draft thread (local only, not persisted to backend).
   * Returns the draft thread object.
   */
  const createDraftThread = useCallback(() => {
    const draftId = `draft-${Date.now()}`;
    const now = new Date().toISOString();
    const draftThread = {
      id: draftId,
      user_id: "",
      title: null,
      created_at: now,
      updated_at: now,
    };
    draftThreadIds.current.add(draftId);
    setThreads((prev) => [draftThread, ...prev]);
    setActiveThreadId(draftId);
    return draftThread;
  }, []);

  /**
   * Persist a draft thread to the backend (called when first message is sent).
   * Returns the real thread from the backend.
   */
  const persistThread = useCallback(
    async (draftId, title) => {
      if (!draftThreadIds.current.has(draftId)) {
        // Not a draft, nothing to persist
        return null;
      }

      try {
        const token = await getToken();
        const res = await fetch("/api/threads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ title: title || null }),
        });
        if (!res.ok) {
          console.error("Failed to create thread:", res.status);
          return null;
        }
        const newThread = await res.json();

        // Remove draft marker and replace draft with real thread
        draftThreadIds.current.delete(draftId);
        setThreads((prev) =>
          prev.map((t) => (t.id === draftId ? newThread : t)),
        );
        setActiveThreadId(newThread.id);
        return newThread;
      } catch (err) {
        console.error("Error persisting thread:", err);
        return null;
      }
    },
    [getToken],
  );

  /**
   * Check if a thread ID is a draft.
   */
  const isDraftThread = useCallback((threadId) => {
    return draftThreadIds.current.has(threadId);
  }, []);

  /**
   * Select a thread.
   */
  const selectThread = useCallback((threadId) => {
    setActiveThreadId(threadId);
  }, []);

  /**
   * Update a thread's title in local state.
   */
  const updateThreadTitle = useCallback((threadId, title) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, title } : t)),
    );
  }, []);

  /**
   * Delete a thread (from backend if persisted, or just remove draft).
   */
  const deleteThread = useCallback(
    async (threadId) => {
      // If it's a draft, just remove locally
      if (draftThreadIds.current.has(threadId)) {
        draftThreadIds.current.delete(threadId);
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (activeThreadId === threadId) {
          setActiveThreadId(null);
        }
        return;
      }

      // Otherwise, delete from backend
      try {
        const token = await getToken();
        const res = await fetch("/api/threads", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ threadId }),
        });
        if (!res.ok && res.status !== 204) {
          console.error("Failed to delete thread:", res.status);
          return;
        }
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (activeThreadId === threadId) {
          setActiveThreadId(null);
        }
      } catch (err) {
        console.error("Error deleting thread:", err);
      }
    },
    [activeThreadId, getToken],
  );

  /**
   * Refresh threads from backend.
   */
  const refreshThreads = useCallback(async () => {
    await fetchThreads();
  }, [fetchThreads]);

  return {
    threads,
    activeThreadId,
    loading,
    createDraftThread,
    persistThread,
    isDraftThread,
    selectThread,
    updateThreadTitle,
    deleteThread,
    refreshThreads,
    setActiveThreadId,
  };
}
