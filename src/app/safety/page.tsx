import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { QuickDial } from "@/components/QuickDial";
import { ShareLocationButton } from "@/components/ShareLocationButton";
import { SosTracker } from "@/components/SosTracker";
import { ChatbotWidget } from "@/components/ChatbotWidget";

export default async function SafetyToolsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  return (
    <>
      <AppHeader />
      <main style={{ flex: 1, padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "2rem", maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1.5rem 0" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Safety Tools</h1>
          <p style={{ color: "var(--foreground-muted)", fontSize: "1rem", maxWidth: 560 }}>
            Quick access to emergency help, live location sharing, and journey tracking.
          </p>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <QuickDial />
          <ShareLocationButton />
          <SosTracker />
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
