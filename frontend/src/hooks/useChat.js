"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const generateId = () =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);

/**
 * Custom useChat hook that manages chat state for a single thread.
 * Reads Groq responses as raw text streams (not AI SDK UI protocol).
 * Persists messages to Postgres via FastAPI backend.
 */
export function useChat({ threadId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);

  // Abort controller for cancelling in-flight streams
  const abortRef = useRef(null);
  // Track threadId in ref so callbacks always see latest
  const threadIdRef = useRef(threadId);
  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  /**
   * Load message history from the backend for a given thread.
   */
  const loadHistory = useCallback(async (tid) => {
    if (!tid) return;
    try {
      const res = await fetch(`/api/threads/${tid}/messages`);
      if (!res.ok) {
        console.error("Failed to load history:", res.status);
        return;
      }
      const data = await res.json();
      // Backend returns array of { id, thread_id, role, content, created_at }
      const mapped = (Array.isArray(data) ? data : []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      }));
      setMessages(mapped);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  }, []);

  // Load history when threadId changes, but only if switching between real threads
  // Don't load automatically when threadId changes due to draft persistence
  useEffect(() => {
    if (!threadId) {
      setMessages([]);
    } else if (threadId.startsWith("draft-")) {
      setMessages([]);
    }
    // We deliberately don't call loadHistory here to avoid overwriting optimistically
    // added messages when a draft thread is persisted. See handleSelectThread in
    // DashboardPage which calls loadHistory explicitly.
  }, [threadId]);

  /**
   * Save a single message to the backend.
   */
  const persistMessage = useCallback(async (tid, role, content) => {
    if (!tid || tid.startsWith("draft-")) return;
    try {
      const res = await fetch(`/api/threads/${tid}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content }),
      });
      if (!res.ok) {
        console.error("Failed to persist message:", res.status);
      }
    } catch (err) {
      console.error("Failed to persist message:", err);
    }
  }, []);

  /**
   * Send a message and stream the assistant response.
   * @param {string} text - The message text
   * @param {string} [overrideThreadId] - Optional thread ID to use instead of threadIdRef
   */
  const sendMessage = useCallback(
    async (text, overrideThreadId) => {
      const tid = overrideThreadId || threadIdRef.current;
      if (!tid || tid.startsWith("draft-") || !text?.trim() || streaming)
        return;

      setError(null);

      const userMsg = {
        id: generateId(),
        role: "user",
        content: text.trim(),
      };

      const assistantMsg = {
        id: generateId(),
        role: "assistant",
        content: "",
      };

      // Optimistically add user message + empty assistant placeholder
      setMessages((prev) => {
        const newMessages = [...prev, userMsg, assistantMsg];
        return newMessages;
      });

      setInput("");
      setStreaming(true);

      // Build the messages array to send to /api/chat
      // We need to include history + the new user message
      const historyForApi = messages.concat(userMsg).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Persist user message to backend
        await persistMessage(tid, "user", userMsg.content);

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: tid,
            messages: historyForApi,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          // Update the assistant message placeholder with streamed content
          const currentContent = fullContent;
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: currentContent,
              };
            }
            return updated;
          });
        }

        // Persist assistant message to backend (don't block on failure)
        persistMessage(tid, "assistant", fullContent).catch((err) => {
          console.error("Failed to persist assistant message:", err);
        });

        // Note: We don't reload history here since we already have the messages locally
        // This avoids potential auth issues with long-running requests
      } catch (err) {
        if (err.name === "AbortError") {
          // User cancelled — that's fine
          return;
        }
        console.error("Stream error:", err);
        setError(err.message || "Something went wrong");

        // Update the assistant message with error
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (
            lastIdx >= 0 &&
            updated[lastIdx].role === "assistant" &&
            !updated[lastIdx].content
          ) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: "⚠️ Sorry, something went wrong. Please try again.",
            };
          }
          return updated;
        });
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming, persistMessage, loadHistory],
  );

  /**
   * Stop the current stream.
   */
  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setStreaming(false);
    }
  }, []);

  return {
    messages,
    input,
    setInput,
    sendMessage,
    streaming,
    stop,
    error,
    loadHistory,
  };
}
