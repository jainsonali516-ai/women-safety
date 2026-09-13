import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { QuickDial } from "@/components/QuickDial";
import { ShareLocationButton } from "@/components/ShareLocationButton";
import { SosTracker } from "@/components/SosTracker";
import { ChatbotWidget } from "@/components/ChatbotWidget";
import { LowPowerToggle } from "@/components/LowPowerToggle";
import { RequireAuthGate } from "@/components/RequireAuthGate";

// Guest-accessible page — the emergency dial pad (100/112/1091/etc.) is public information that
// needs no account. Only the actions that write to a personal account (sharing your live
// location, starting an SOS trail) are individually gated below.
export default function SafetyToolsPage() {
  return (
    <>
      <AppHeader />
      <main style={{ flex: 1, padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "2rem", maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.5rem 0" }}>
          <h1 style={{ fontSize: "clamp(1.6rem, 6vw, 2rem)", fontWeight: 800 }}>Safety Tools</h1>
          <p style={{ color: "var(--foreground-muted)", fontSize: "1rem", maxWidth: 560 }}>
            Quick access to emergency help, live location sharing, and journey tracking.
          </p>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <LowPowerToggle />
          <QuickDial />
          <RequireAuthGate message="Sign in to share your live location with trusted contacts.">
            <ShareLocationButton />
          </RequireAuthGate>
          <RequireAuthGate message="Sign in to start an SOS alert and share a live tracking link.">
            <SosTracker />
          </RequireAuthGate>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
          <NavCard href="/contacts" title="Trusted Contacts" desc="Manage emergency contacts and reminder alarms." />
          <NavCard href="/bot" title="Tulip Bot" desc="Ask about your future commute and get a safety-aware forecast." />
        </section>
      </main>
      <ChatbotWidget />
    </>
  );
}

function NavCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card" style={{ padding: "1.5rem", display: "block" }}>
      <h3 style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--accent-strong)" }}>{title}</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>{desc}</p>
    </Link>
  );
}
