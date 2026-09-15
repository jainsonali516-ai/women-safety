import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { freeTextSchema, safeParse } from "@/lib/validation";

// on-demand.io's own session memory has proven unreliable in practice, so instead of trusting it
// to recall earlier turns, the caller sends recent turns explicitly and this route folds them into
// the query text itself — that way "does it remember" no longer depends on their infra.
export const maxDuration = 60;

const BASE_URL = "https://api.on-demand.io/chat/v1";

// Same agent chain as the reference script — kept as server-side constants, not something a
// caller can override, same reasoning as every other third-party config in this app (fares,
// safety-signal radii, etc.): the client only ever sends what it actually needs to (the query).
const AGENT_IDS = [
  "agent-1713962163",
  "agent-1712327325",
  "agent-1722260873",
  "agent-1775547203",
  "agent-1743257072",
  "agent-1789134730",
  "agent-1789316337",
  "agent-1789316739",
  "agent-1789316762",
];
const ENDPOINT_ID = "predefined-gemini-3.5-flash-lite";

const BUSY_MESSAGE = "HerLane Bot is a bit busy right now — please try again in a minute.";

// on-demand.io's rate-limit errors have shown up both as a flat non-2xx response and as an event
// inside the SSE stream, and the exact JSON shape isn't guaranteed — so this matches on the
// wording rather than a specific field, to catch it either way.
function looksLikeRateLimit(text: string): boolean {
  return /rate.?limit|too many requests|TPM limit/i.test(text);
}

const historyTurnSchema = z.object({
  role: z.enum(["user", "bot"]),
  text: freeTextSchema(2000),
});

// Only the most recent turns are folded into the query — enough for real continuity without the
// prompt growing without bound across a long conversation.
const MAX_HISTORY_TURNS = 10;

const bodySchema = z.object({
  query: freeTextSchema(1000),
  // Optional: lets a caller keep the same identity across multiple calls (on-demand.io's
  // contextMetadata/session history is keyed on this). Generated per-request otherwise.
  externalUserId: z.string().trim().max(100).optional(),
  // Optional: reuse an existing on-demand.io session so a multi-turn conversation (like the
  // chat widget) keeps context between messages, instead of the reference script's behavior of
  // starting a brand-new session — and therefore forgetting everything — on every single call.
  sessionId: z.string().trim().max(200).optional(),
  // Prior turns of this conversation, oldest first. Sent explicitly because relying on
  // on-demand.io's own session memory has proven unreliable — folding history into the query
  // ourselves guarantees the agent actually sees it.
  history: z.array(historyTurnSchema).max(MAX_HISTORY_TURNS).optional(),
});

function buildContextualQuery(history: { role: "user" | "bot"; text: string }[] | undefined, query: string): string {
  if (!history || history.length === 0) return query;
  const transcript = history
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => `${turn.role === "user" ? "User" : "HerLane Bot"}: ${turn.text}`)
    .join("\n");
  return `Here is the conversation so far, for context:\n${transcript}\n\nNow answer the user's latest message:\n${query}`;
}

interface CreateSessionResponse {
  data: {
    id: string;
    contextMetadata: { key: string; value: string }[];
  };
}

async function createChatSession(apiKey: string, externalUserId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/sessions`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ agentIds: AGENT_IDS, externalUserId, contextMetadata: [] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as CreateSessionResponse;
    return data.data.id;
  } catch {
    return null;
  }
}

/**
 * Proxies a query to on-demand.io's multi-agent chat API. Adapted from a Node CLI script (which
 * used node-fetch/process.exit/console.log — none of which exist in a browser, or belong in a
 * server request handler that must return a response rather than exit the whole process) into a
 * proper Next.js route handler: native fetch, zod-validated input, and errors returned as JSON
 * rather than printed. The API key stays in this server-only file — the browser only ever calls
 * this route, never on-demand.io directly, same pattern as every other proxied service here.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const apiKey = process.env.ON_DEMAND_API_KEY;
  if (!apiKey) return jsonError("Chat isn't configured on this server yet.", 503);

  const { query, externalUserId, sessionId: existingSessionId, history } = parsed.data;
  const userId = externalUserId ?? randomUUID();
  const contextualQuery = buildContextualQuery(history, query);

  const sessionId = existingSessionId ?? (await createChatSession(apiKey, userId));
  if (!sessionId) return jsonError("Couldn't start a chat session.", 502);

  let queryRes: Response;
  try {
    queryRes = await fetch(`${BASE_URL}/sessions/${sessionId}/query`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        endpointId: ENDPOINT_ID,
        query: contextualQuery,
        agentIds: AGENT_IDS,
        skillNames: [],
        responseMode: "stream",
        modelConfigs: {
          fulfillmentPrompt: "",
          stopSequences: [],
          temperature: 0.7,
          topP: 1,
          maxTokens: 0,
          presencePenalty: 0,
          frequencyPenalty: 0,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return jsonError("Network error while reaching the chat service.", 502);
  }

  if (!queryRes.ok || !queryRes.body) {
    const text = await queryRes.text().catch(() => "");
    if (looksLikeRateLimit(text)) {
      return jsonError(BUSY_MESSAGE, 429);
    }
    return jsonError("Sorry, HerLane Bot couldn't respond right now. Please try again shortly.", 502);
  }

  // on-demand.io streams Server-Sent Events; this buffers them into one assembled answer rather
  // than proxying raw SSE to the browser — the reference script did the same (it only ever
  // printed one final assembled result), and there's no incremental UI on this app's side yet
  // to stream partial tokens into. Buffering here keeps the response a plain, cacheable JSON
  // object like every other API route in this app.
  const reader = queryRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullAnswer = "";
  let finalSessionId = sessionId;
  let finalMessageId = "";
  let streamRateLimited = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep a partial trailing line for the next chunk

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();
      if (dataStr === "[DONE]") continue;
      if (looksLikeRateLimit(dataStr)) {
        streamRateLimited = true;
        continue;
      }
      try {
        const event = JSON.parse(dataStr);
        if (event.eventType === "fulfillment") {
          if (event.answer) fullAnswer += event.answer;
          if (event.sessionId) finalSessionId = event.sessionId;
          if (event.messageId) finalMessageId = event.messageId;
        } else if (event.eventType === "error" || event.error) {
          streamRateLimited = streamRateLimited || looksLikeRateLimit(JSON.stringify(event));
        }
      } catch {
        /* an incomplete/malformed SSE chunk — safe to skip */
      }
    }
  }

  if (!fullAnswer.trim() && streamRateLimited) {
    return jsonError(BUSY_MESSAGE, 429);
  }
  if (!fullAnswer.trim()) {
    return jsonError("Sorry, HerLane Bot couldn't respond right now. Please try again shortly.", 502);
  }

  return NextResponse.json({ sessionId: finalSessionId, messageId: finalMessageId, answer: fullAnswer });
}
