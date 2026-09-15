"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TulipLogo } from "./TulipLogo";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileMenu } from "./ProfileMenu";
import { ShieldAlert, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/journey", label: "Journey" },
  { href: "/safety", label: "Safety Tools" },
  { href: "/contacts", label: "Contacts" },
  { href: "/bot", label: "HerLane Bot" },
];

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

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
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }} onClick={() => setMenuOpen(false)}>
        <TulipLogo size={28} />
        <span style={{ fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.15em" }}>HERLANE</span>
      </Link>

      <nav className="app-nav-desktop" style={{ alignItems: "center", gap: "1.1rem" }}>
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: "0.9rem",
                fontWeight: active ? 700 : 400,
                color: active ? "var(--accent)" : "var(--foreground-muted)",
                whiteSpace: "nowrap",
                padding: "0.4rem 0.7rem",
                borderRadius: "999px",
                background: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              {link.label}
            </Link>
          );
        })}
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
            whiteSpace: "nowrap",
          }}
        >
          <ShieldAlert size={14} /> SOS
        </a>
        <ThemeToggle />
        <ProfileMenu />
      </nav>

      <div className="app-nav-mobile-controls" style={{ alignItems: "center", gap: "0.6rem" }}>
        <a
          href="tel:112"
          title="Quick SOS: call 112"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.4rem 0.6rem",
            borderRadius: "999px",
            background: "#ef4444",
            color: "white",
            fontSize: "0.75rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          <ShieldAlert size={13} /> SOS
        </a>
        <ProfileMenu />
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2.2rem",
            height: "2.2rem",
            borderRadius: "0.6rem",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--foreground)",
            cursor: "pointer",
          }}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              top: "3.6rem",
              background: "rgba(0, 0, 0, 0.55)",
              zIndex: 39,
            }}
          />
          <div
            className="app-nav-mobile-panel"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 41,
              display: "flex",
              flexDirection: "column",
              padding: "0.75rem 1.5rem 1.25rem",
              gap: "0.9rem",
              background: "var(--background-solid)",
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
              boxShadow: "0 12px 24px rgba(0, 0, 0, 0.35)",
            }}
          >
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontSize: "1rem",
                  color: active ? "var(--accent)" : "var(--foreground)",
                  fontWeight: active ? 800 : 600,
                  padding: "0.3rem 0.6rem",
                  borderRadius: "0.6rem",
                  background: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                  width: "fit-content",
                }}
              >
                {link.label}
              </Link>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.4rem", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </>
      )}
    </header>
  );
}
