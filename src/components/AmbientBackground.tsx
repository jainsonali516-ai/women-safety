"use client";

import { useEmergencyMode } from "@/components/EmergencyModeProvider";

/**
 * A slow, ambient glow-streak animation behind all page content — inspired by (not copied from)
 * a reference site's sweeping light-ray hero effect, adapted into something subtle enough to sit
 * behind real UI on every page rather than dominate a single hero. Pure CSS (no canvas/WebGL): a
 * few large blurred gradient shapes drifting and rotating slowly. Colors are theme-aware — bolder
 * crimson streaks on the dark "night" surface, much softer blush tones on the light "ivory" one,
 * since the same intensity would read as murky/dirty on a light background.
 */
export function AmbientBackground() {
  const { active: lowPower } = useEmergencyMode();
  if (lowPower) return null;

  return (
    <div className="herlane-ambient-bg" aria-hidden="true">
      <div className="herlane-ambient-streak herlane-ambient-streak-a" />
      <div className="herlane-ambient-streak herlane-ambient-streak-b" />
      <div className="herlane-ambient-streak herlane-ambient-streak-c" />
    </div>
  );
}
