"use client";

import { BackgroundCanvas } from "./BackgroundCanvas";
import { useEmergencyMode } from "./EmergencyModeProvider";

/** Stops the animated background (canvas rAF loop) entirely in low-power mode. */
export function ConditionalBackground() {
  const { active } = useEmergencyMode();
  if (active) return null;
  return <BackgroundCanvas />;
}
