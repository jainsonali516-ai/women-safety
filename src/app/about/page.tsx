import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { TulipLogo } from "@/components/TulipLogo";
import { Shield, MapPinned, Users, Bot, Lock } from "lucide-react";

export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      {user && <AppHeader />}
      <main style={{ flex: 1, padding: "3rem 1.5rem", maxWidth: 760, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "2rem" }}>
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", textAlign: "center" }}>
          <TulipLogo size={48} />
          <h1 style={{ fontSize: "clamp(1.8rem, 5vw, 2.4rem)", fontWeight: 800 }}>About Tulip</h1>
          <p style={{ color: "var(--foreground-muted)", fontSize: "1.05rem", lineHeight: 1.6, maxWidth: 560 }}>
            Tulip is a safety-first journey planner built for female commuters across Delhi, Noida,
            Gurugram, Ghaziabad, and Faridabad — helping you get where you&apos;re going with a route
            that&apos;s not just fast, but genuinely safer.
          </p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          <AboutCard icon={<MapPinned size={20} />} title="Safety-Scored Routing" desc="Routes across Metro, DTC buses, autos, and cabs are ranked using real street-light density and foot-traffic signals, not guesswork." />
          <AboutCard icon={<Shield size={20} />} title="Built for Emergencies" desc="One-tap SOS dialing, instant location sharing, and live journey tracking that keeps working even if your connection drops." />
          <AboutCard icon={<Users size={20} />} title="Your Trusted Circle" desc="Keep a list of emergency contacts you can reach — or who can reach you — in one tap." />
          <AboutCard icon={<Bot size={20} />} title="Tulip Bot" desc="Ask about an upcoming trip and get a safety-aware forecast for the best time and mode to travel." />
        </section>

        <section className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Lock size={18} /> Built on free, transparent data
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--foreground-muted)", lineHeight: 1.6 }}>
            Tulip&apos;s routing and safety signals run on OpenStreetMap-based services (Nominatim, OSRM,
            Overpass) — no paid API keys or billing accounts required to use the core app. Where a
            feature depends on an optional service (like SMS delivery), it&apos;s clearly labeled and
            degrades gracefully rather than pretending to work when it can&apos;t.
          </p>
        </section>
      </main>
    </>
  );
}

function AboutCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "0.65rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
          color: "white",
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</h3>
      <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)", lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}
