import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { safeParse, freeTextSchema } from "@/lib/validation";
import { forecastJourney } from "@/lib/peakHours";

const bodySchema = z.object({
  message: freeTextSchema(400),
  departure_iso: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = safeParse(bodySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const { message, departure_iso } = parsed.data;
  const departureDate = departure_iso ? new Date(departure_iso) : new Date();
  const forecast = forecastJourney(departureDate);

  const modeLabel: Record<string, string> = {
    metro: "Delhi Metro",
    auto: "Auto-Rickshaw",
    cab: "Uber/Ola",
  };

  const ruleBasedReply = [
    `For that time, I'd recommend **${modeLabel[forecast.recommendation]}**.`,
    ...forecast.reasoning,
  ].join(" ");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: ruleBasedReply, forecast, source: "heuristic" });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system:
          "You are Tulip Bot, a concise safety-focused journey assistant for female commuters in Delhi NCR. Use the given heuristic forecast as ground truth and phrase a short, friendly, helpful reply (max 4 sentences). Never invent live traffic numbers.",
        messages: [
          {
            role: "user",
            content: `User asked: "${message}"\nHeuristic forecast: recommend ${forecast.recommendation}, reasoning: ${forecast.reasoning.join(" ")}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (!res.ok || !text) {
      return NextResponse.json({ reply: ruleBasedReply, forecast, source: "heuristic" });
    }
    return NextResponse.json({ reply: text, forecast, source: "claude" });
  } catch {
    return NextResponse.json({ reply: ruleBasedReply, forecast, source: "heuristic" });
  }
}
