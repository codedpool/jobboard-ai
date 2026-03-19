import { createGroq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText } from "ai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { auth } from "@clerk/nextjs/server";

export const maxDuration = 30;

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  const body = await req.json();
  const { messages, system, tools } = body;

  const { getToken } = auth();
  const clerkToken = await getToken().catch(() => null);

  // For now we don't call FastAPI here yet; we just include token metadata
  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system:
      system ??
      "You are a job board AI assistant. Help users find jobs. You may receive a clerkToken in the metadata.",
    messages: convertToModelMessages(messages),
    tools: frontendTools(tools),
    experimental_providerMetadata: {
      clerkToken,
    },
  });

  return result.toUIMessageStreamResponse();
}
