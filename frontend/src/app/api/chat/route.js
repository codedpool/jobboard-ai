import { getAuth } from "@clerk/nextjs/server";
import { streamText, convertToModelMessages } from "ai";
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
 * Extract plain text from a message object.
 * Supports both { content: string } and AI SDK v6 { parts: [...] } format.
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
 * Return a static text as a streaming response.
 * Chunks the text to simulate token-by-token streaming (typing effect).
 */
function textResponse(text) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Split into chunks (words or sentences) for a more natural typing effect
      // Split by spaces and punctuation
      const chunks = text.match(/\S+\s*/g) || [];

      let index = 0;
      const push = () => {
        if (index < chunks.length) {
          const chunk = chunks[index++];
          controller.enqueue(encoder.encode(chunk));
          // Small delay to simulate typing
          setTimeout(push, 10);
        } else {
          controller.close();
        }
      };
      push();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Forward the conversation to Groq and stream back the response
 * as a plain text stream that the custom useChat hook can consume.
 */
async function handleGenericGroq(messages, system) {
  const systemPrompt =
    system ||
    "You are a job board AI assistant. Help users find jobs, refine their search, and manage job-search agents.";

  // Convert messages to CoreMessage format for streamText
  // Our custom hook sends { role, content } — convert to the format streamText expects
  const modelMessages = messages.map((m) => ({
    role: m.role,
    content: m.content || "",
  }));

  const result = streamText({
    model: groqProvider("llama-3.3-70b-versatile"),
    system: systemPrompt,
    messages: modelMessages,
  });

  // Use toTextStreamResponse() for proper streaming
  return result.toTextStreamResponse();
}

// --- Main route ---

export async function POST(req) {
  const body = await req.json();
  const { messages, system, threadId } = body;

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
    lowerText.includes("find jobs") ||
    lowerText.includes("get jobs") ||
    lowerText.includes("list jobs");

  if (wantsJobs) {
    if (!clerkToken) {
      return textResponse("⚠️ You need to sign in to see your saved jobs.");
    }
    try {
      // Look for config ID in conversation context first
      let configId = null;
      for (const msg of messages) {
        const text = getMessageText(msg);
        const configMatch = text.match(/<!--CONFIG_ID:([a-f0-9-]+)-->/);
        if (configMatch) {
          configId = configMatch[1];
        }
      }

      // If no config in conversation, get the most recent one
      if (!configId) {
        const configsRes = await fetch(`${BACKEND_URL}/api/configs`, {
          headers: authHeaders,
        });
        if (!configsRes.ok) throw new Error("Failed to fetch configs");
        const configs = await configsRes.json();

        if (!configs || configs.length === 0) {
          return textResponse(
            "You haven't set up any job tracking agents yet! Try saying something like:\n\n" +
              '• "Find me remote Python jobs"\n' +
              '• "Search for frontend developer positions"\n' +
              '• "Look for backend engineer roles"',
          );
        }

        // Use the most recent config
        configId = configs[0].id;
      }

      // Step 1: Fetch fresh jobs from platforms
      const fetchRes = await fetch(
        `${BACKEND_URL}/api/configs/${configId}/fetch`,
        {
          method: "POST",
          headers: authHeaders,
        },
      );

      let fetchData = { total_inserted: 0 };
      if (fetchRes.ok) {
        fetchData = await fetchRes.json();
      }

      // Step 2: Evaluate the jobs (use total_inserted to ensure all are evaluated)
      const evalLimit = Math.max(20, fetchData.total_inserted || 0);
      const evalRes = await fetch(
        `${BACKEND_URL}/api/configs/${configId}/evaluate?limit=${evalLimit}`,
        {
          method: "POST",
          headers: authHeaders,
        },
      );

      let evalData = { evaluated: 0 };
      if (evalRes.ok) {
        evalData = await evalRes.json();
      }

      // Step 3: Get the results (sorted by score)
      const resultsRes = await fetch(
        `${BACKEND_URL}/api/configs/${configId}/results?limit=50`,
        {
          headers: authHeaders,
        },
      );
      if (!resultsRes.ok) throw new Error("Failed to fetch results");
      const results = await resultsRes.json();

      const rawJobs = results.jobs || [];
      if (rawJobs.length === 0) {
        return textResponse(
          `I searched the platforms but didn't find any matching jobs yet.\n\n` +
            `Fetched: ${fetchData.total_inserted || 0} new listings\n` +
            `Try broadening your search criteria or check back later!`,
        );
      }

      // Sort by score (highest first) and filter to good matches
      const sortedJobs = rawJobs
        .filter((j) => j.score !== null)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 10);

      const jobsPayload = {
        config_id: configId,
        jobs: sortedJobs.map((job) => ({
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
      const statusLine =
        fetchData.total_inserted > 0
          ? `🔍 Found **${fetchData.total_inserted}** new listings, evaluated **${evalData.evaluated}** jobs.\n\n`
          : "";
      const content = `${statusLine}Here are your top ${jobsPayload.jobs.length} matching jobs:\n\n${hidden}`;

      return textResponse(content);
    } catch (err) {
      console.error("Error fetching jobs:", err);
      return textResponse(
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
        return textResponse(
          "⚠️ I couldn't reach the server to save your job config. Please try again in a moment.",
        );
      }

      if (configRes.ok) {
        const configData = await configRes.json();
        const platformList = platforms.join(", ");
        return textResponse(
          `✅ Agent created for **${parsedData.parsed_role}** on **${platformList}**.\n\n` +
            `Say **"show jobs"** to fetch and see matching positions!\n\n` +
            `<!--CONFIG_ID:${configData.id}-->`,
        );
      } else {
        return textResponse(
          "⚠️ I couldn't save your job config. Make sure you're signed in and try again.",
        );
      }
    }

    const platformList = platforms.join(", ") || lastText;
    return textResponse(
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

    return textResponse(responseText);
  }

  // ── FLOW 3: Generic conversational chat via Groq ────────────────────────────
  return handleGenericGroq(messages, system);
}
