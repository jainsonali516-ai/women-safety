import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { TulipLogo } from "@/components/TulipLogo";
import { QuickDial } from "@/components/QuickDial";
import { ShareLocationButton } from "@/components/ShareLocationButton";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <TulipLogo size={56} />
        <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Tulip</h1>
        <p style={{ color: "var(--foreground-muted)", maxWidth: 420 }}>
          AI-powered safety and journey planning for female commuters across Delhi NCR.
        </p>
        <Link href="/auth" className="btn-accent" style={{ padding: "0.8rem 1.6rem", borderRadius: "0.75rem", fontWeight: 600 }}>
          Get Started
        </Link>
      </main>
    );
  }

  return (
    <>
      <AppHeader />
      <main style={{ flex: 1, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700 }}>Stay safe on your commute</h1>
          <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>
            Quick access to emergency help, live location sharing, and AI-planned safe routes.
          </p>
        </div>

        <QuickDial />
        <ShareLocationButton />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <NavCard href="/journey" title="Plan a Journey" desc="AI-ranked safest, fastest, and cheapest routes across Metro, bus, auto & cabs." />
          <NavCard href="/contacts" title="Trusted Contacts" desc="Manage emergency contacts and reminder alarms." />
          <NavCard href="/bot" title="Tulip Bot" desc="Ask about your future commute and get a safety-aware forecast." />
        </div>
      </main>
    </>
  );
}

function NavCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card" style={{ padding: "1.25rem", display: "block" }}>
      <h3 style={{ fontWeight: 600, marginBottom: "0.4rem", color: "var(--accent-strong)" }}>{title}</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>{desc}</p>
    </Link>
  );
}
