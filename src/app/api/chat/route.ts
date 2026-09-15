import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { freeTextSchema, safeParse } from "@/lib/validation";

export const maxDuration = 60;

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

const SYSTEM_PROMPT = `You are Ally, the AI safety assistant built into HerLane — a safety-first
journey planner for female commuters across Delhi, Noida, Gurugram, Ghaziabad, and Faridabad.
Help with trip timing, transit mode choice, and general safety considerations for getting around.
Be warm, concise, and practical.

Never fabricate specific real-time facts you cannot actually know — live traffic conditions,
today's news, a specific street's current safety situation, exact Metro/DTC schedules. If asked
about something you can't verify, say so plainly rather than guessing or inventing a confident-
sounding answer.

You are not a substitute for emergency services. If someone describes being in immediate danger,
tell them clearly to call 112 (or their local emergency number) or use HerLane's SOS button —
don't just offer general advice in that situation.`;

const historyTurnSchema = z.object({
  role: z.enum(["user", "bot"]),
  text: freeTextSchema(2000),
});

// Only the most recent turns are sent — enough for real continuity without the request growing
// without bound across a long conversation.
const MAX_HISTORY_TURNS = 10;

const bodySchema = z.object({
  query: freeTextSchema(1000),
  history: z.array(historyTurnSchema).max(MAX_HISTORY_TURNS).optional(),
});

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
}

/**
 * Proxies a query to Google's Gemini API directly (no third-party multi-agent layer). Deliberately
 * stateless: every request carries its own full conversation context (the client's `history`) and
 * nothing is persisted server-side afterward — not in this app's database, and not as a Gemini
 * "session"/thread either, since a plain generateContent call never creates one. That means there
 * is nothing left to delete once a user closes the chat; the conversation simply stops existing
 * anywhere once the browser tab does, by construction rather than as a cleanup step.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return jsonError("Ally isn't configured on this server yet.", 503);

  const { query, history } = parsed.data;

  const contents = [
    ...(history ?? []).map((turn) => ({
      role: turn.role === "user" ? "user" : "model",
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: query }] },
  ];

  let res: Response;
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return jsonError("Network error while reaching Ally.", 502);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Gemini API error:", res.status, text);
    if (res.status === 429) {
      return jsonError("Ally is a bit busy right now — please try again in a minute.", 429);
    }
    return jsonError("Sorry, Ally couldn't respond right now. Please try again shortly.", 502);
  }

  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const answer = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";

  if (!answer) {
    // A blocked/empty response (e.g. finishReason "SAFETY") still comes back as a 200 from Gemini —
    // this is not a network/server error, just nothing usable to show.
    console.error("Gemini returned no usable content, finishReason:", candidate?.finishReason);
    return jsonError("Sorry, Ally couldn't respond to that. Please try rephrasing.", 502);
  }

  return NextResponse.json({ answer });
}
