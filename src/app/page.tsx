import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { TrustBadges } from "@/components/TrustBadges";
import { PhotoHeroBackground } from "@/components/PhotoHeroBackground";
import { ChatbotWidget } from "@/components/ChatbotWidget";
import { Compass, ShieldCheck, Users, MessageSquareText, Zap, ArrowRight } from "lucide-react";

export default async function Home() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <>
        <AppHeader />
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <section className="herlane-photo-hero">
            <PhotoHeroBackground />

            <div className="herlane-photo-hero-content">
              <span className="herlane-hero-eyebrow">
                <Zap size={13} /> AI SAFETY &amp; JOURNEY PLANNER
              </span>
              <h1 className="herlane-hero-photo-title">
                Walk your city,
                <br />
                <span style={{ color: "var(--brand-pink)" }}>fearlessly.</span>
              </h1>
              <p className="herlane-hero-photo-subtitle">
                AI-powered safety and journey planning for female commuters across Delhi NCR —
                safer routes, instant help, and your trusted circle always in the loop.
              </p>
              <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap", marginTop: "1.6rem" }}>
                <Link
                  href="/auth"
                  className="btn-accent"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.95rem 2rem", fontWeight: 700, fontSize: "1rem", border: "none" }}
                >
                  Get Started <ArrowRight size={18} />
                </Link>
                <Link href="/about" className="herlane-hero-btn-ghost">
                  Learn more
                </Link>
              </div>
              <div style={{ marginTop: "1.6rem" }}>
                <TrustBadges tone="onPhoto" />
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3rem",
          padding: "3.5rem 1.5rem 3rem",
        }}
      >
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.1rem", textAlign: "center", maxWidth: 620 }}>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 2.8rem)" }}>
            Welcome back to <span style={{ color: "var(--accent)" }}>HerLane</span>
          </h1>
          <p style={{ color: "var(--foreground-muted)", fontSize: "1.05rem", lineHeight: 1.6 }}>
            Your safety-first companion for getting around Delhi NCR — plan safer routes, reach help
            instantly, and keep your trusted circle in the loop.
          </p>
          <Link
            href="/journey"
            className="btn-accent"
            style={{ padding: "0.9rem 2.2rem", borderRadius: "0.9rem", fontWeight: 700, fontSize: "1rem", marginTop: "0.5rem" }}
          >
            Plan a Journey
          </Link>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.25rem",
            width: "100%",
            maxWidth: 1000,
          }}
        >
          <HomeCard
            href="/journey"
            icon={<Compass size={22} />}
            title="Plan a Journey"
            desc="Safety-scored routes across Metro, bus, auto & cabs, with a live corridor map."
            gradient="linear-gradient(135deg, var(--accent), var(--accent-strong))"
          />
          <HomeCard
            href="/safety"
            icon={<ShieldCheck size={22} />}
            title="Safety Tools"
            desc="SOS quick-dial, share your live location, and journey tracking."
            gradient="linear-gradient(135deg, var(--accent-strong), var(--accent-violet))"
          />
          <HomeCard
            href="/contacts"
            icon={<Users size={22} />}
            title="Trusted Contacts"
            desc="Manage emergency contacts and location-reminder alarms."
            gradient="linear-gradient(135deg, var(--accent-amber), var(--accent))"
          />
          <HomeCard
            href="/bot"
            icon={<MessageSquareText size={22} />}
            title="HerLane Bot"
            desc="Ask about an upcoming trip and get a safety-aware forecast."
            gradient="linear-gradient(135deg, var(--accent-violet), var(--accent))"
          />
        </section>
      </main>
      <ChatbotWidget />
    </>
  );
}

function HomeCard({
  href,
  icon,
  title,
  desc,
  gradient,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className="card"
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        transition: "transform 0.15s ease, border-color 0.15s ease",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "var(--radius-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: gradient,
          color: "white",
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>{title}</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: 1.5 }}>{desc}</p>
    </Link>
  );
}
