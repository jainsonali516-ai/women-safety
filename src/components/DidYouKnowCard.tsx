"use client";

import { useEffect, useState } from "react";
import { Lightbulb, ExternalLink } from "lucide-react";
import { T } from "@/components/Translated";

interface PlaceFactResponse {
  found: boolean;
  place?: string;
  fact?: string | null;
  wikipediaUrl?: string | null;
}

/**
 * A short Wikipedia-sourced "Did You Know?" fact about the selected destination — renders nothing
 * at all if no suitable fact was found or the request failed, so a Wikipedia hiccup never affects
 * the rest of the journey-planning page (see /api/place-fact and lib/placeFact.ts).
 */
export function DidYouKnowCard({ place, context }: { place: string; context?: string }) {
  const [result, setResult] = useState<PlaceFactResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ place });
    if (context) params.set("context", context);
    fetch(`/api/place-fact?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PlaceFactResponse | null) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [place, context]);

  if (!result?.found || !result.fact || !result.wikipediaUrl) return null;
  const fact = { fact: result.fact, sourceUrl: result.wikipediaUrl };

  return (
    <div
      className="card"
      style={{
        padding: "0.9rem 1.1rem",
        display: "flex",
        gap: "0.7rem",
        alignItems: "flex-start",
      }}
    >
      <Lightbulb size={18} color="var(--accent-strong)" style={{ flexShrink: 0, marginTop: "0.15rem" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 0 }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-strong)" }}>
          <T>Did You Know?</T>
        </p>
        <p style={{ fontSize: "0.85rem", color: "var(--foreground)", lineHeight: 1.5 }}>
          <T>{fact.fact}</T>
        </p>
        <a
          href={fact.sourceUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: "0.74rem", color: "var(--accent-strong)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
        >
          <T>Source</T>: Wikipedia <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
