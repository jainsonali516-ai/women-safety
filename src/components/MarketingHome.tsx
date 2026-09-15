"use client";

import Link from "next/link";
import {
  ArrowRight,
  Lock,
  Brain,
  MapPin,
  Zap,
  Shield,
  Leaf,
  Lightbulb,
  Users2,
  Building2,
  CheckCircle2,
  ArrowLeftRight,
  GraduationCap,
  Bell,
  UserPlus,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { TulipLogo } from "@/components/TulipLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The logged-out landing page. Kept separate from AppHeader/the logged-in home dashboard
 * (src/app/page.tsx) since this is a different audience (a visitor deciding whether to sign up)
 * with a different job: sell the product, not act as an in-app dashboard. Every "route",
 * "signal", and safety claim shown here is clearly labeled as illustrative — this page has no
 * live data of its own, unlike the real /journey planner it links to.
 */
export function MarketingHome() {
  return (
    <div style={{ width: "100%", maxWidth: "100vw", overflowX: "clip" }}>
      <MarketingNav />
      <Hero />
      <FeatureBento />
    </div>
  );
}

function MarketingNav() {
  return (
    <header
      className="glass"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.9rem 1.5rem",
        borderLeft: "none",
        borderRight: "none",
        borderTop: "none",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <TulipLogo size={30} />
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontWeight: 800, fontSize: "1.15rem", letterSpacing: "0.02em" }}>HerLane</span>
          <span style={{ fontSize: "0.62rem", color: "var(--foreground-muted)", fontWeight: 600 }}>
            Safer journeys. Stronger you.
          </span>
        </span>
      </Link>

      <nav className="app-nav-desktop" style={{ alignItems: "center", gap: "1.4rem" }}>
        <Link href="#features" style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
          Features
        </Link>
        <Link href="/safety" style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
          Safety
        </Link>
        <Link href="/about" style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
          About
        </Link>
        <ThemeToggle />
        <Link
          href="/auth"
          className="btn-accent"
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.1rem", fontWeight: 700, fontSize: "0.85rem", border: "none" }}
        >
          Open App <ArrowRight size={15} />
        </Link>
      </nav>

      <div className="app-nav-mobile-controls" style={{ alignItems: "center", gap: "0.6rem" }}>
        <ThemeToggle />
        <Link href="/auth" className="btn-accent" style={{ padding: "0.5rem 0.9rem", fontWeight: 700, fontSize: "0.8rem", border: "none" }}>
          Open App
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "clamp(2.5rem, 6vw, 5rem) 1.5rem",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
        gap: "clamp(2rem, 5vw, 4rem)",
        alignItems: "center",
        maxWidth: 1280,
        margin: "0 auto",
      }}
      className="herlane-hero-grid"
    >
      {/* Ambient glow — slow drifting radial blooms in the accent colors, not a static gradient. */}
      <div aria-hidden="true" className="herlane-hero-glow herlane-hero-glow-a" />
      <div aria-hidden="true" className="herlane-hero-glow herlane-hero-glow-b" />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            width: "fit-content",
            padding: "0.35rem 0.8rem",
            borderRadius: "999px",
            border: "1px solid var(--border)",
            background: "var(--surface-glass)",
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--foreground-muted)",
          }}
        >
          <Zap size={13} color="var(--accent)" /> AI SAFETY &amp; JOURNEY PLANNER
        </span>

        <h1 style={{ fontSize: "clamp(2.3rem, 6vw, 3.6rem)", lineHeight: 1.05, margin: 0 }}>
          Smarter Routes.
          <br />
          <span style={{ color: "var(--accent)" }}>Safer You.</span>
        </h1>

        <p style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)", margin: 0 }}>
          The fastest route is not always the right route.
        </p>

        <p style={{ fontSize: "0.98rem", color: "var(--foreground-muted)", lineHeight: 1.65, maxWidth: 520, margin: 0 }}>
          HerLane is an AI-powered journey companion that considers context, privacy, accessibility, and
          real-time safety signals to help you travel with confidence.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
          <Link
            href="/auth"
            className="btn-accent"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.85rem 1.5rem", fontWeight: 700, fontSize: "0.95rem", border: "none" }}
          >
            Plan a Safer Route <ArrowRight size={17} />
          </Link>
          <Link
            href="#features"
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", padding: "0.85rem 1.5rem", fontWeight: 700, fontSize: "0.95rem" }}
          >
            Explore HerLane
          </Link>
        </div>

        <div style={{ display: "flex", gap: "1.1rem", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--foreground-muted)", marginTop: "0.4rem" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Lock size={13} /> Privacy-first
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Brain size={13} /> AI-assisted
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <MapPin size={13} /> Delhi NCR focused
          </span>
        </div>
      </div>

      <HeroVisual />
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="herlane-hero-visual" style={{ position: "relative", zIndex: 1, maxWidth: 330, margin: "0 0 0 auto" }}>
      <svg
        viewBox="0 0 420 480"
        role="img"
        aria-label="A commuter walking a lit route through the city at dusk"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          <radialGradient id="herlane-sky" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="55%" stopColor="var(--accent-strong)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="herlane-route-line" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-strong)" />
          </linearGradient>
          <linearGradient id="herlane-figure" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.92" />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        <circle cx="180" cy="240" r="210" fill="url(#herlane-sky)" />

        {/* City skyline silhouette — sits behind her, all flush to one street-level baseline */}
        <g opacity="0.45" fill="var(--foreground)" className="herlane-skyline">
          {[
            [0, 300, 38, 180],
            [40, 260, 34, 220],
            [78, 330, 30, 150],
            [280, 270, 34, 210],
            [318, 320, 40, 160],
            [362, 250, 30, 230],
            [396, 300, 24, 180],
          ].map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx="2" opacity={0.45 + (i % 3) * 0.1} />
          ))}
        </g>

        {/* Ground line — the one consistent baseline everything (buildings, figure, route) stands on */}
        <line x1="0" y1="480" x2="420" y2="480" stroke="var(--foreground)" strokeOpacity="0.12" strokeWidth="1.5" />

        {/* Animated route line — a curved stem at street level, leading right to her feet */}
        <path
          id="herlane-route-path"
          d="M10,472 C60,458 88,440 112,458 C138,477 160,462 172,438"
          fill="none"
          stroke="url(#herlane-route-line)"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.95"
          className="herlane-route-path"
        />

        {/* Commuter silhouette, standing at street level (feet on the same baseline as the
            skyline and the route line) rather than floating above the buildings — confident,
            walking posture, backpack, ponytail catching a bit of motion. */}
        <g className="herlane-figure" transform="translate(180 320)">
          {/* back leg (mid-stride) */}
          <path d="M-6,118 C-10,140 -14,160 -20,178 L-10,178 C-4,160 2,140 4,118 Z" fill="url(#herlane-figure)" opacity="0.85" />
          {/* front leg */}
          <path d="M6,118 C8,142 8,162 6,180 L16,180 C20,160 18,138 14,118 Z" fill="url(#herlane-figure)" />
          {/* torso + skirt-coat silhouette */}
          <path
            d="M-15,20 C-19,45 -18,78 -8,118 L14,118 C16,80 15,46 13,20 C13,8 10,-2 0,-4 C-9,-2 -14,8 -15,20 Z"
            fill="url(#herlane-figure)"
          />
          {/* backpack */}
          <rect x="-16" y="18" width="20" height="32" rx="7" fill="var(--accent)" opacity="0.9" />
          {/* far arm, slightly swinging */}
          <path d="M11,22 Q26,38 20,64" fill="none" stroke="url(#herlane-figure)" strokeWidth="7" strokeLinecap="round" opacity="0.9" />
          {/* head + ponytail */}
          <ellipse cx="0" cy="-16" rx="15" ry="17" fill="url(#herlane-figure)" />
          <path d="M11,-22 Q30,-8 20,24 Q15,36 9,22" fill="url(#herlane-figure)" opacity="0.85" />
        </g>
      </svg>

      <RouteIntelligenceCard />
    </div>
  );
}

function RouteIntelligenceCard() {
  const routes = [
    { key: "fastest", label: "Fastest", time: "32 min", via: "Delhi Metro + Cab", icon: <Zap size={15} />, emphasis: false },
    { key: "safer", label: "Safer", time: "36 min", via: "Metro + Walk", icon: <Shield size={15} />, emphasis: true },
    { key: "balanced", label: "Balanced", time: "34 min", via: "Bus + Metro", icon: <Leaf size={15} />, emphasis: false },
  ];
  const signals = [
    { label: "Better lighting", icon: <Lightbulb size={14} /> },
    { label: "Higher footfall", icon: <Users2 size={14} /> },
    { label: "Metro proximity", icon: <Building2 size={14} /> },
    { label: "Verified locations", icon: <CheckCircle2 size={14} /> },
  ];

  return (
    <div className="card herlane-float" style={{ padding: "1.1rem", marginTop: "-1.5rem", position: "relative", zIndex: 2 }}>
      <p style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em", color: "var(--foreground-muted)", marginBottom: "0.6rem" }}>
        ROUTE INTELLIGENCE <span style={{ opacity: 0.6, fontWeight: 600 }}>· sample</span>
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", marginBottom: "0.8rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", flex: 1, minWidth: 0 }}>
          <MapPin size={13} color="var(--accent)" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Connaught Place</span>
        </span>
        <ArrowLeftRight size={13} color="var(--foreground-muted)" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", marginBottom: "0.9rem" }}>
        <MapPin size={13} color="var(--accent-strong)" />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Gurugram Cyber Hub</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.9rem" }}>
        {routes.map((r) => (
          <div
            key={r.key}
            className="herlane-route-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.55rem 0.7rem",
              borderRadius: "0.7rem",
              border: r.emphasis ? "1.5px solid var(--accent)" : "1px solid var(--border)",
              background: r.emphasis ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: r.emphasis ? "var(--accent)" : "var(--surface)",
                color: r.emphasis ? "white" : "var(--foreground-muted)",
                border: r.emphasis ? "none" : "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              {r.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.05em", color: "var(--foreground-muted)" }}>
                {r.label.toUpperCase()}
              </span>
              <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 700 }}>{r.time}</span>
              <span style={{ display: "block", fontSize: "0.68rem", color: "var(--foreground-muted)" }}>via {r.via}</span>
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: "0.06em", color: "var(--foreground-muted)", marginBottom: "0.5rem" }}>
        SAFETY SIGNALS <span style={{ opacity: 0.7, fontWeight: 600 }}>(illustrative)</span>
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
        {signals.map((s, i) => (
          <div
            key={s.label}
            className="herlane-signal-icon"
            style={{ animationDelay: `${i * 0.15}s`, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", textAlign: "center" }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--accent-strong)",
              }}
            >
              {s.icon}
            </span>
            <span style={{ fontSize: "0.6rem", color: "var(--foreground-muted)", lineHeight: 1.2 }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BentoItem {
  title: string;
  desc: string;
  icon: React.ReactNode;
  href: string;
  cta: string;
  large?: boolean;
}

const BENTO_ITEMS: BentoItem[] = [
  {
    title: "AI-Aware Safety Route Planner",
    desc: "Route recommendations that weigh lighting, foot traffic, and how monitored each mode is — not just travel time.",
    icon: <Brain size={20} />,
    href: "/journey",
    cta: "Explore Route Intelligence",
    large: true,
  },
  {
    title: "Smarter Campus Safety",
    desc: "Context-aware support for students navigating campus routes and daily commutes.",
    icon: <GraduationCap size={20} />,
    href: "/about",
    cta: "Learn more",
  },
  {
    title: "Emergency Assistance",
    desc: "One-tap SOS with live location shared straight to your trusted circle.",
    icon: <Bell size={20} />,
    href: "/safety",
    cta: "See safety tools",
  },
  {
    title: "Trusted Contacts",
    desc: "Build your circle of protection — notified instantly the moment you need them.",
    icon: <UserPlus size={20} />,
    href: "/contacts",
    cta: "Add contacts",
  },
  {
    title: "Live Journey Signals",
    desc: "Real-time tracking your circle can follow, for as long as you choose to share it.",
    icon: <Radio size={20} />,
    href: "/safety",
    cta: "Start tracking",
  },
  {
    title: "Privacy-first AI",
    desc: "Your location is never sold or shared with advertisers — full stop.",
    icon: <ShieldCheck size={20} />,
    href: "/about",
    cta: "Read our privacy stance",
  },
];

function FeatureBento() {
  return (
    <section id="features" style={{ padding: "1rem 1.5rem clamp(3rem, 6vw, 5rem)", maxWidth: 1280, margin: "0 auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {BENTO_ITEMS.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className={`card herlane-bento-card${item.large ? " herlane-bento-large" : ""}`}
            style={{
              padding: item.large ? "2rem" : "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--accent) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                color: "var(--accent)",
              }}
            >
              {item.icon}
            </span>
            <h3 style={{ fontSize: item.large ? "1.3rem" : "1.05rem", margin: 0 }}>{item.title}</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: 1.55, margin: 0, flex: 1 }}>{item.desc}</p>
            <span className="herlane-bento-cta" style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)" }}>
              {item.cta} <ArrowRight size={14} className="herlane-bento-cta-arrow" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
