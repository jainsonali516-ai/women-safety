"use client";

import { TulipBloom } from "@/components/TulipBloom";

/**
 * The app's identity mark: a full-open TulipBloom (petals radiating from a center point) in a
 * rounded glass badge. Kept as a thin wrapper around TulipBloom rather than its own bespoke SVG
 * so the logo, the route safety indicator, the bot avatar, and the arrival animation all trace
 * back to the exact same petal shape — one motif, reused, not four different flowers.
 */
export function TulipLogo({ size = 32 }: { size?: number }) {
  const padding = Math.max(6, Math.round(size * 0.25));

  return (
    <div
      className="relative flex items-center justify-center rounded-2xl border transition-all duration-300
                 bg-white/70 border-pink-300/60 shadow-[0_0_10px_rgba(230,79,108,0.25)]
                 dark:bg-slate-950/80 dark:border-pink-500/40 dark:shadow-[0_0_15px_rgba(230,79,108,0.4)]"
      style={{ padding }}
    >
      <TulipBloom size={size} openness={1} title="HerLane logo" />
    </div>
  );
}
