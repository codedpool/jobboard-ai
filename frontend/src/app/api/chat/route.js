import { createGroq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText } from "ai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";

export const maxDuration = 30;

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  const { messages, system, tools } = await req.json();

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system: system ?? "You are a job board AI assistant. Help users find jobs.",
    messages: convertToModelMessages(messages),
    tools: frontendTools(tools),
  });

  return result.toUIMessageStreamResponse();
}
