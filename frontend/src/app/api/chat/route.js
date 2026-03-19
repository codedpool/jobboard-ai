import { getAuth } from "@clerk/nextjs/server";
import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  generateId,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const maxDuration = 30;

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Groq via its OpenAI-compatible API endpoint
const groqProvider = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

// --- Detection helpers ---

const JOB_SEARCH_REGEX =
  /\b(job|jobs|internship|intern|hiring|remote|backend|frontend|fullstack|full.?stack|engineer|developer|dev|position|role|vacancy|opening|work|opportunity|python|node\.?js|react|django|fastapi|golang|rust|typescript)\b/i;

const PLATFORM_LIST_REGEX =
  /\b(remoteok|remotive|github|linkedin|hn|hackernews|yc|ycombinator|reddit|telegram|wellfound|angellist|indeed|glassdoor)\b/i;

function isJobSearchMessage(text) {
  return JOB_SEARCH_REGEX.test(text);
}

function isPlatformListMessage(text) {
  return PLATFORM_LIST_REGEX.test(text);
}

function extractPlatforms(text) {
  const known = [
    "remoteok",
    "remotive",
    "github",
    "linkedin",
    "hn",
    "hackernews",
    "yc",
    "ycombinator",
    "reddit",
    "telegram",
    "wellfound",
    "angellist",
    "indeed",
    "glassdoor",
  ];
  const lower = text.toLowerCase();
  return known.filter((p) => lower.includes(p));
}

/**
 * Extract plain text from an AI SDK v6 UIMessage.
 * In v6, message content lives in `parts` as { type: "text", text: string } objects.
 * Falls back to a plain `content` string for any legacy/edge cases.
 */
function getMessageText(message) {
  if (!message) return "";

  if (Array.isArray(message.parts)) {
    const fromParts = message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text || "")
      .join("")
      .trim();
    if (fromParts) return fromParts;
  }

  // Fallback for plain string content
  if (typeof message.content === "string") return message.content.trim();

  return "";
}

function lastAssistantAskedForPlatforms(messages) {
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  if (!assistantMessages.length) return false;
  const last = assistantMessages[assistantMessages.length - 1];
  const text = getMessageText(last);
  return text.includes("platforms") || text.includes("which platform");
}

/**
 * Wrap a static text string in an AI SDK v6 UI message stream response.
 * Uses the text-start / text-delta / text-end chunk protocol expected by
 * DefaultChatTransport (useChat) in @ai-sdk/react v3 / ai v6.
 */
function textToStream(text) {
  const id = generateId();
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

/**
 * Forward the conversation to Groq and stream back the response using
 * the AI SDK v6 UI message stream protocol so the browser can consume it.
 */
async function handleGenericGroq(messages, system) {
  const systemPrompt =
    system ||
    "You are a job board AI assistant. Help users find jobs, refine their search, and manage job-search agents.";

  // Convert AI SDK v6 UIMessage[] → CoreMessage[] expected by streamText
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: groqProvider("llama-3.3-70b-versatile"),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}

// --- Main route ---

export async function POST(req) {
  const body = await req.json();
  const { messages, system } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const lastText = getMessageText(lastUserMessage);

  // Grab an auth token to forward to the Python backend when needed
  const authState = getAuth(req);
  const clerkToken =
    authState && authState.sessionId
      ? await authState.getToken().catch(() => null)
      : null;

  const authHeaders = clerkToken
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clerkToken}`,
      }
    : { "Content-Type": "application/json" };

  const lowerText = lastText.toLowerCase();
  const wantsJobs =
    lowerText.includes("show jobs") ||
    lowerText.includes("show results") ||
    lowerText.includes("show my jobs") ||
    lowerText.includes("list jobs");

  if (wantsJobs) {
    if (!clerkToken) {
      return textToStream("⚠️ You need to sign in to see your saved jobs.");
    }
    try {
      const configsRes = await fetch(`${BACKEND_URL}/api/configs`, {
        headers: authHeaders,
      });
      if (!configsRes.ok) throw new Error("Failed to fetch configs");
      const configs = await configsRes.json();

      if (!configs || configs.length === 0) {
        return textToStream(
          "You haven't set up any job tracking agents yet! Try saying 'Find me a backend job'.",
        );
      }

      // Simplest: use the latest config (assuming last in the array is the most recent)
      const latestConfig = configs[configs.length - 1];
      const configId = latestConfig.id;

      const resultsRes = await fetch(
        `${BACKEND_URL}/api/configs/${configId}/results?limit=10`,
        {
          headers: authHeaders,
        },
      );
      if (!resultsRes.ok) throw new Error("Failed to fetch results");
      const results = await resultsRes.json();

      const rawJobs = results.jobs || [];
      if (rawJobs.length === 0) {
        return textToStream(
          "No jobs found yet for your latest agent. Try triggering a fetch first!",
        );
      }

      const jobsPayload = {
        config_id: configId,
        jobs: rawJobs.map((job) => ({
          id: job.id,
          title: job.title,
          company: job.company,
          url: job.url,
          source: job.source,
          location: job.location,
          score: job.score,
          reason: job.reason,
        })),
      };

      const hidden = `<!--JOBS:${JSON.stringify(jobsPayload)}-->`;
      const content = `Here are your latest ${jobsPayload.jobs.length} jobs:\n\n${hidden}`;

      return textToStream(content);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      return textToStream(
        "⚠️ Oops, something went wrong fetching your jobs. Please try again.",
      );
    }
  }

  // ── FLOW 1: User is answering the "which platforms?" follow-up ──────────────
  if (
    isPlatformListMessage(lastText) &&
    lastAssistantAskedForPlatforms(messages)
  ) {
    const platforms = extractPlatforms(lastText);

    // Retrieve the parsed job data that was stashed in the previous assistant msg
    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
    const lastAssistantText = getMessageText(lastAssistant);

    let parsedData = {};
    const match = lastAssistantText.match(/<!--PARSED:(.*?)-->/s);
    if (match) {
      try {
        parsedData = JSON.parse(match[1]);
      } catch (_) {}
    }

    if (clerkToken && parsedData.parsed_role) {
      let configRes;
      try {
        configRes = await fetch(`${BACKEND_URL}/api/configs`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            raw_query: parsedData.raw_query || lastText,
            parsed_role: parsedData.parsed_role,
            keywords: parsedData.keywords || [],
            seniority: parsedData.seniority || "any",
            location_preference: parsedData.location_preference || "",
            platforms,
            interval_minutes: 60,
          }),
        });
      } catch (_) {
        return textToStream(
          "⚠️ I couldn't reach the server to save your job config. Please try again in a moment.",
        );
      }

      if (configRes.ok) {
        const platformList = platforms.join(", ");
        return textToStream(
          `✅ Agent created for **${parsedData.parsed_role}** on **${platformList}**.\n\nI'll start scanning these platforms and surface matching jobs here. You can refine further by saying things like "only remote", "more senior", or "exclude React".`,
        );
      } else {
        return textToStream(
          "⚠️ I couldn't save your job config. Make sure you're signed in and try again.",
        );
      }
    }

    const platformList = platforms.join(", ") || lastText;
    return textToStream(
      `✅ Got it — I'll look for jobs on **${platformList}**. (Sign in to save this agent permanently.)`,
    );
  }

  // ── FLOW 2: Job search query — parse it via the Python backend ──────────────
  if (isJobSearchMessage(lastText)) {
    let parseRes;
    try {
      parseRes = await fetch(`${BACKEND_URL}/api/parse-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: lastText }),
      });
    } catch (_) {
      // Backend unreachable — fall through to generic Groq chat
      return handleGenericGroq(messages, system);
    }

    if (!parseRes.ok) {
      return handleGenericGroq(messages, system);
    }

    const parsed = await parseRes.json();

    const responseText =
      `I found your job search intent! Here's what I understood:\n\n` +
      `**Role:** ${parsed.parsed_role}\n` +
      `**Keywords:** ${(parsed.keywords || []).join(", ")}\n` +
      `**Seniority:** ${parsed.seniority}\n` +
      `**Location:** ${parsed.location_preference}\n` +
      `**Summary:** ${parsed.summary}\n\n` +
      `Which platforms should I search on? You can pick one or more:\n` +
      `- remoteok\n- remotive\n- github\n- hn (Hacker News)\n- yc (Y Combinator)\n- reddit\n- linkedin\n\n` +
      `Just reply with the platform names, e.g. \`remoteok, remotive, github\`\n` +
      `<!--PARSED:${JSON.stringify({ ...parsed, raw_query: lastText })}-->`;

    return textToStream(responseText);
  }

  // ── FLOW 3: Generic conversational chat via Groq ────────────────────────────
  return handleGenericGroq(messages, system);
}
