import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { safeParse, freeTextSchema } from "@/lib/validation";
import { forecastJourney } from "@/lib/peakHours";
import { checkForDisruptiveEvents } from "@/lib/events";

const bodySchema = z.object({
  message: freeTextSchema(400),
  departure_iso: z.string().datetime().optional(),
});

// Ground rules for the natural-language layer — the spirit of a "zero hallucination / no false
// safety guarantees / no neighborhood profiling" policy, kept honest about what this app
// actually has (a real-time OSM-based heuristic, not a Mapbox/TomTom/Earth Engine "recommendation
// engine" — inventing a fake stack in the bot's own instructions would be exactly the kind of
// thing rule 1 tells it not to do to a user).
const SYSTEM_PROMPT = `You are Tulip Bot, a concise safety-focused journey assistant for female commuters in Delhi NCR.

Ground rules:
- Never invent safety scores, foot-traffic numbers, lighting data, or routing details beyond what's given to you below. Only reference the heuristic forecast provided in this conversation.
- Never claim a route or area is "100% safe" or "guaranteed safe." Use grounded phrasing like "a safer option based on available signals," never a guarantee.
- Never characterize a neighborhood's reputation, demographics, or character. Only reference measurable infrastructure signals (lighting, foot traffic, proximity to Metro/police/hospitals) when explaining a recommendation.
- This app's live signals reflect real-time-of-search conditions, not a scheduled future time. If asked about a trip days or hours ahead, say plainly that the live signals shown are as of now, not a forecast for that specific future time — don't imply a capability that doesn't exist.
- If asked something outside your data (e.g. real-time crime reports, something this app doesn't track), say so plainly and point to the relevant part of the app instead of guessing.

Use the given heuristic forecast as ground truth and phrase a short, friendly, helpful reply (max 4 sentences). Never invent live traffic numbers.`;

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

  const disruption = await checkForDisruptiveEvents(departureDate);
  let recommendation = forecast.recommendation;
  const reasoning = [...forecast.reasoning];
  if (disruption?.detected) {
    recommendation = "metro";
    reasoning.unshift(
      `🚨 Possible rally/road closure reported near that date ("${disruption.headline}"). Recommendation: use Delhi Metro to avoid surface-route disruption.`
    );
  }

  const ruleBasedReply = [
    `For that time, I'd recommend **${modeLabel[recommendation]}**.`,
    ...reasoning,
  ].join(" ");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: ruleBasedReply, forecast: { ...forecast, recommendation }, disruption, source: "heuristic" });
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
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `User asked: "${message}"\nHeuristic forecast: recommend ${recommendation}, reasoning: ${reasoning.join(" ")}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (!res.ok || !text) {
      return NextResponse.json({ reply: ruleBasedReply, forecast: { ...forecast, recommendation }, disruption, source: "heuristic" });
    }
    return NextResponse.json({ reply: text, forecast: { ...forecast, recommendation }, disruption, source: "claude" });
  } catch {
    return NextResponse.json({ reply: ruleBasedReply, forecast: { ...forecast, recommendation }, disruption, source: "heuristic" });
  }
}
