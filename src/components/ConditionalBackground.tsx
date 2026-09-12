"use client";

import { AnimatedBackground } from "./AnimatedBackground";
import { useEmergencyMode } from "./EmergencyModeProvider";

/** Stops the animated background (CSS animations + DOM nodes) entirely in low-power mode. */
export function ConditionalBackground() {
  const { active } = useEmergencyMode();
  if (active) return null;
  return <AnimatedBackground />;
}
