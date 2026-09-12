import Link from "next/link";
import { TulipLogo } from "./TulipLogo";
import { ThemeToggle } from "./ThemeToggle";
import { ShieldAlert } from "lucide-react";

export function AppHeader() {
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
        <TulipLogo size={28} />
        <span style={{ fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.15em" }}>TULIP</span>
      </Link>
      <nav style={{ display: "flex", alignItems: "center", gap: "1.1rem" }}>
        <Link href="/" style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
          Journey
        </Link>
        <Link href="/safety" style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
          Safety Tools
        </Link>
        <Link href="/contacts" style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
          Contacts
        </Link>
        <a
          href="tel:112"
          title="Quick SOS: call 112"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.4rem 0.7rem",
            borderRadius: "999px",
            background: "#ef4444",
            color: "white",
            fontSize: "0.8rem",
            fontWeight: 700,
          }}
        >
          <ShieldAlert size={14} /> SOS
        </a>
        <ThemeToggle />
      </nav>
    </header>
  );
}
