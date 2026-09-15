import { Lock, Brain, MapPin } from "lucide-react";

const BADGES = [
  { icon: Lock, label: "Privacy-first" },
  { icon: Brain, label: "AI-assisted" },
  { icon: MapPin, label: "Delhi NCR focused" },
];

/** Shared trust-badge row — used on the homepage photo hero and the About page hero. `tone`
 * switches between the theme-aware muted style (over a normal surface) and a white/glass style
 * suited for sitting on top of a photo background regardless of the active theme. */
export function TrustBadges({ tone = "default" }: { tone?: "default" | "onPhoto" }) {
  const color = tone === "onPhoto" ? "rgba(255, 255, 255, 0.85)" : "var(--foreground-muted)";
  return (
    <div style={{ display: "flex", gap: "1.1rem", flexWrap: "wrap", fontSize: "0.78rem", color }}>
      {BADGES.map(({ icon: Icon, label }) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Icon size={13} /> {label}
        </span>
      ))}
    </div>
  );
}
