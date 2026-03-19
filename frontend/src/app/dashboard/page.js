"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function DashboardPage() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Link href="/dashboard">
              <span className="text-sm font-semibold text-foreground">
                Job Board AI
              </span>
            </Link>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            <ThreadList />
          </div>
        </aside>

        {/* Main chat area */}
        <main className="flex-1 flex flex-col">
          <Thread />
        </main>
      </div>
    </AssistantRuntimeProvider>
  );
}
