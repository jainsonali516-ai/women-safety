import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { TulipLogo } from "@/components/TulipLogo";
import { JourneyHome } from "@/components/JourneyHome";
import { ChatbotWidget } from "@/components/ChatbotWidget";

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
          gap: "1.25rem",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <TulipLogo size={64} />
        <h1 style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "0.08em" }}>TULIP</h1>
        <p style={{ color: "var(--foreground-muted)", maxWidth: 460, fontSize: "1.05rem" }}>
          AI-powered safety and journey planning for female commuters across Delhi NCR.
        </p>
        <Link href="/auth" className="btn-accent" style={{ padding: "0.9rem 2rem", borderRadius: "0.9rem", fontWeight: 600, fontSize: "1rem" }}>
          Get Started
        </Link>
      </main>
    );
  }

  return (
    <>
      <AppHeader />
      <JourneyHome />
      <ChatbotWidget />
    </>
  );
}
