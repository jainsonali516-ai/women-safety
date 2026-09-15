// src/app/api/translate/route.ts
import { NextRequest, NextResponse } from "next/server";

const SARVAM_TRANSLATE_URL = "https://api.sarvam.ai/translate";
const MAX_CHUNK_LENGTH = 1800; // Safe threshold under the 2000 character hard cap

/**
 * Splits text into chunks <= maxLength using Intl.Segmenter for reliable,
 * multi-language sentence boundary detection.
 */
function chunkTextBySentence(text: string, maxLength: number = MAX_CHUNK_LENGTH): string[] {
  // Use native Intl.Segmenter for language-aware sentence splitting
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  const sentences = Array.from(segmenter.segment(text)).map((s) => s.segment);

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());

      if (sentence.length > maxLength) {
        // Fallback for single sentences exceeding the character cap
        for (let i = 0; i < sentence.length; i += maxLength) {
          chunks.push(sentence.slice(i, i + maxLength).trim());
        }
        currentChunk = "";
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguageCode, sourceLanguageCode } = await req.json();

    if (!text || typeof text !== "string" || !targetLanguageCode) {
      return NextResponse.json(
        { error: "Missing or invalid 'text' or 'targetLanguageCode'." },
        { status: 400 }
      );
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Translation service is not configured on the server." },
        { status: 500 }
      );
    }

    const chunks = chunkTextBySentence(text);

    // Translate all chunks in parallel using Promise.all to prevent high latency
    const translatedChunks = await Promise.all(
      chunks.map(async (chunk) => {
        const res = await fetch(SARVAM_TRANSLATE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": apiKey,
          },
          body: JSON.stringify({
            input: chunk,
            source_language_code: sourceLanguageCode ?? "auto",
            target_language_code: targetLanguageCode,
            mode: "formal", // Optional Sarvam translation mode
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Sarvam API returned status ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return data.translated_text as string;
      })
    );

    return NextResponse.json({ translatedText: translatedChunks.join(" ") });
  } catch (err) {
    console.error("Sarvam Translation API error:", err);
    return NextResponse.json(
      { error: "Translation request failed. Please try again later." },
      { status: 500 }
    );
  }
}
