"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Zap, MapPin, Navigation, Calendar, Bus, Train, Car, Sparkles } from "lucide-react";
import { TrustBadges } from "@/components/TrustBadges";
import { PhotoHeroBackground } from "@/components/PhotoHeroBackground";
import { PlaceField, type Suggestion } from "@/components/JourneySearchHero";

/**
 * The hero for the About page — same full-bleed photo treatment as the homepage (for a
 * consistent, professional first impression across both entry points), headline, and a
 * glass preview of the real /journey planner form floating over the photo. Every field/state
 * shown is static and explicitly labeled "preview" — this component has no logic of its own,
 * unlike the real planner its primary CTA and card button both link to.
 */
export function AboutHero() {
  return (
    <section className="herlane-photo-hero herlane-photo-hero--compact">
      <PhotoHeroBackground objectPosition="70% 40%" />

      <div className="herlane-photo-hero-content">
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <span className="herlane-hero-eyebrow">
            <Zap size={13} /> AI SAFETY &amp; JOURNEY PLANNER
          </span>

          <h1 className="herlane-hero-photo-title" style={{ maxWidth: 560 }}>
            Smarter Routes.
            <br />
            <span style={{ color: "var(--brand-pink)" }}>Safer You.</span>
          </h1>

          <p style={{ fontSize: "1.02rem", fontWeight: 700, color: "#fff", margin: 0 }}>
            The fastest route is not always the right route.
          </p>

          <p className="herlane-hero-photo-subtitle">
            HerLane is an AI-powered journey companion that considers context, privacy, accessibility, and
            real-time safety signals to help you travel with confidence.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
            <Link
              href="/journey"
              className="btn-accent"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.85rem 1.5rem", fontWeight: 700, fontSize: "0.95rem", border: "none" }}
            >
              Plan a Safer Route <ArrowRight size={17} />
            </Link>
            <Link href="#features" className="herlane-hero-btn-ghost" style={{ padding: "0.85rem 1.5rem", fontSize: "0.95rem" }}>
              Explore HerLane
            </Link>
          </div>

          <div style={{ marginTop: "0.4rem" }}>
            <TrustBadges tone="onPhoto" />
          </div>
        </div>

        <JourneyPreviewCard />
      </div>
    </section>
  );
}

function JourneyPreviewCard() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [pinkSaheliActive, setPinkSaheliActive] = useState(true);

  // Filling both fields here and hitting the button takes you straight to the real planner with
  // a search already running, instead of landing on an empty form and having to retype everything.
  // The Pink Saheli choice made here carries over too, instead of always defaulting once you land.
  const journeyHref =
    origin.trim() && destination.trim()
      ? `/journey?origin=${encodeURIComponent(origin.trim())}&destination=${encodeURIComponent(destination.trim())}&concession=${pinkSaheliActive}`
      : "/journey";

  return (
    <div className="card herlane-float" style={{ padding: "1.25rem", position: "relative", zIndex: 2, maxWidth: 400, margin: "0 0 0 auto", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <p style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em", color: "var(--foreground-muted)" }}>
        JOURNEY PLANNER <span style={{ opacity: 0.6, fontWeight: 600 }}>· preview</span>
      </p>

      <PlaceField
        label="Starting Point / Current Location"
        placeholder="Enter station or landmark..."
        value={origin}
        onChange={setOrigin}
        onSelect={(s: Suggestion) => setOrigin(s.name)}
        icon={<MapPin className="absolute left-4 w-5 h-5 pointer-events-none" style={{ color: "var(--accent)" }} />}
        ringColor="focus:ring-pink-500/50"
      />
      <PlaceField
        label="Destination Point"
        placeholder="Where are you heading?"
        value={destination}
        onChange={setDestination}
        onSelect={(s: Suggestion) => setDestination(s.name)}
        icon={<Navigation className="absolute left-4 w-5 h-5 pointer-events-none" style={{ color: "var(--accent-violet)" }} />}
        ringColor="focus:ring-rose-500/50"
      />

      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "var(--foreground-muted)", fontWeight: 600, paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
        <Calendar size={13} /> Travel Date: <span style={{ color: "var(--foreground)", fontWeight: 700 }}>15/09/2026</span>
      </div>

      <div
        onClick={() => setPinkSaheliActive((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.6rem",
          padding: "0.6rem 0.8rem",
          borderRadius: "var(--radius-md)",
          background: "color-mix(in srgb, var(--accent) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Bus size={15} color="var(--accent)" />
          <span>
            <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700 }}>Pink Saheli Smart Card</span>
            <span style={{ display: "block", fontSize: "0.62rem", color: "var(--foreground-muted)" }}>
              {pinkSaheliActive ? "₹0 Fare active for DTC Buses" : "Standard DTC Fare applied"}
            </span>
          </span>
        </span>
        <span style={{ width: 32, height: 18, borderRadius: 999, background: pinkSaheliActive ? "var(--accent)" : "var(--border)", position: "relative", flexShrink: 0, transition: "background 0.2s ease" }}>
          <span
            style={{
              position: "absolute",
              top: 2,
              left: pinkSaheliActive ? 16 : 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s ease",
            }}
          />
        </span>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.06em", color: "var(--foreground-muted)" }}>FILTER SAFE TRANSIT MODES</span>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--accent-amber)" }}>🚫 Two-Wheelers Excluded</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          <ModePill icon={<Train size={13} />} label="Delhi Metro" color="var(--accent-violet)" />
          <ModePill icon={<Bus size={13} />} label="DTC Bus (₹0)" color="var(--accent)" />
          <ModePill icon={<Car size={13} />} label="Verified Cabs" />
        </div>
      </div>

      <Link
        href={journeyHref}
        className="btn-accent"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.8rem", fontWeight: 700, fontSize: "0.85rem", border: "none", marginTop: "0.2rem" }}
      >
        <Sparkles size={15} /> Calculate Safest Route Options
      </Link>
    </div>
  );
}

function ModePill({ icon, label, color }: { icon: React.ReactNode; label: string; color?: string }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.4rem 0.7rem",
        borderRadius: "var(--radius-sm)",
        fontSize: "0.7rem",
        fontWeight: 700,
        background: color ?? "var(--surface)",
        color: color ? "#fff" : "var(--foreground-muted)",
        border: color ? "none" : "1px solid var(--border)",
      }}
    >
      {icon} {label}
    </span>
  );
}
