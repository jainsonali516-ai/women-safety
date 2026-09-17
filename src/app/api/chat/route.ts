import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { freeTextSchema, safeParse } from "@/lib/validation";

export const maxDuration = 60;

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

const SYSTEM_PROMPT = `You are Ally, the AI safety assistant built into HerLane — a safety-first
journey planner for female commuters across Delhi, Noida, Gurugram, Ghaziabad, and Faridabad.
Help with trip timing, transit mode choice, and general safety considerations for getting around.
Be warm, concise, and practical. Default to 2-4 short sentences — only write more when a genuine
multi-option comparison needs a table, or the user explicitly asks for more detail.

When an answer naturally compares multiple options — transit modes, routes, times, safety levels,
costs — format that part as a Markdown table (a header row, a "| --- | --- |" separator row, then
data rows) instead of a paragraph or bullet list, so it's easy to scan. Use plain prose or a short
bullet list for anything that isn't naturally tabular; don't force a table where it doesn't fit.

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

// Told to Gemini by name rather than by its raw BCP-47 code (e.g. "hi-IN") — the model follows a
// plain language name far more reliably than a locale code, which it sometimes echoes back
// literally instead of treating as an instruction.
const LANGUAGE_NAMES: Record<string, string> = {
  "hi-IN": "Hindi",
  "bn-IN": "Bengali",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "mr-IN": "Marathi",
  "gu-IN": "Gujarati",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "pa-IN": "Punjabi",
};

const bodySchema = z.object({
  query: freeTextSchema(1000),
  history: z.array(historyTurnSchema).max(MAX_HISTORY_TURNS).optional(),
  language: z.string().max(10).optional(),
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

  // Multiple keys, tried in order — a failover chain, not load-balanced round-robin: stay on the
  // first key until it actually fails (network error, rate limit, or a 5xx from Google) before
  // falling back to the next one, so a single working key handles all traffic on its own until
  // it's genuinely exhausted. GEMINI_API_KEY is kept as a last-resort fallback for any deployment
  // that only ever set the single legacy variable.
  const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY,
  ].filter((key, index, all): key is string => Boolean(key) && all.indexOf(key) === index);
  if (apiKeys.length === 0) return jsonError("Ally isn't configured on this server yet.", 503);

  const { query, history, language } = parsed.data;

  const languageName = language ? LANGUAGE_NAMES[language] : undefined;
  const systemInstruction = languageName
    ? `${SYSTEM_PROMPT}\n\nRespond in ${languageName}, regardless of what language the user writes in. Keep "HerLane" and "Ally" themselves in English — they're names, not words to translate.`
    : SYSTEM_PROMPT;

  const contents = [
    ...(history ?? []).map((turn) => ({
      role: turn.role === "user" ? "user" : "model",
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: query }] },
  ];

  const requestBody = JSON.stringify({
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    // Caps how much Gemini can generate per reply — keeps answers on the shorter side by
    // construction (not just by instruction) and uses less of the free-tier's daily quota.
    // thinkingBudget: 0 disables this model's internal "reasoning" tokens, which otherwise count
    // against maxOutputTokens too — confirmed by direct testing that a real query burned 385 of
    // the 400-token budget on invisible thinking, leaving only 11 tokens for the actual answer
    // and truncating it mid-sentence (finishReason "MAX_TOKENS"). Ally's replies are short,
    // conversational safety/travel advice, not the kind of multi-step reasoning this budget is
    // for, so disabling it fixes the truncation and uses noticeably fewer tokens per reply.
    generationConfig: { temperature: 0.7, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
  });

  let res: Response | null = null;
  let lastNetworkError = false;
  for (let i = 0; i < apiKeys.length; i++) {
    try {
      const attempt = await fetch(`${GEMINI_URL}?key=${apiKeys[i]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: AbortSignal.timeout(30000),
      });
      lastNetworkError = false;
      if (attempt.ok) {
        res = attempt;
        break;
      }
      const text = await attempt.text().catch(() => "");
      console.error(`Gemini API error (key ${i + 1}/${apiKeys.length}):`, attempt.status, text);
      // A 429 (rate limit) or 5xx from Google is exactly the failure this key rotation exists
      // for — try the next key. Google also returns a plain 400 "API key not valid" for a bad
      // key (not 401/403 as you'd expect), which is just as much a per-key problem and needs the
      // same fallback — confirmed by testing with a deliberately invalid key. Anything else
      // (e.g. a 400 for genuinely malformed request content) would fail identically on every
      // key, so there's no point burning through the rest of them.
      const isKeyProblem = /api key/i.test(text);
      if (attempt.status === 429 || attempt.status >= 500 || isKeyProblem) {
        res = attempt;
        continue;
      }
      res = attempt;
      break;
    } catch (err) {
      lastNetworkError = true;
      console.error(`Gemini network error (key ${i + 1}/${apiKeys.length}):`, err instanceof Error ? err.message : err);
    }
  }

  if (lastNetworkError) return jsonError("Network error while reaching Ally.", 502);
  if (!res) return jsonError("Sorry, Ally couldn't respond right now. Please try again shortly.", 502);

  if (!res.ok) {
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
