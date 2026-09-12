import Link from "next/link";
import { TulipLogo } from "./TulipLogo";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 1.5rem",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <TulipLogo size={28} />
        <span style={{ fontWeight: 700, fontSize: "1.15rem", letterSpacing: "-0.02em" }}>Tulip</span>
      </Link>
      <nav style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        <Link href="/journey" style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
          Journey
        </Link>
        <Link href="/contacts" style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
          Contacts
        </Link>
        <Link href="/bot" style={{ fontSize: "0.9rem", color: "var(--foreground-muted)" }}>
          Tulip Bot
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
