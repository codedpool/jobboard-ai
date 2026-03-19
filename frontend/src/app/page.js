"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";

export default function HomePage() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen bg-background">
        <div className="w-64 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h1 className="text-sm font-semibold text-foreground">
              Job Board AI
            </h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ThreadList />
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <Thread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
