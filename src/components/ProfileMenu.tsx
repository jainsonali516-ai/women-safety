"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Users, User } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { AuthModal } from "@/components/AuthModal";

/** Header auth entry point: a "Sign In" pill for guests, or a rounded avatar + dropdown (email,
 * manage contacts, sign out) once authenticated. One component so both the desktop nav and the
 * mobile menu panel can drop it in without re-implementing the guest/signed-in split. */
export function ProfileMenu() {
  const { user, loading, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSignOut() {
    setDropdownOpen(false);
    await signOut();
    setToast("Signed out");
    setTimeout(() => setToast(null), 2200);
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {loading ? (
        <div style={{ width: 34, height: 34 }} aria-hidden="true" />
      ) : !user ? (
        <button
          onClick={() => setShowAuthModal(true)}
          className="btn-accent"
          style={{
            padding: "0.4rem 0.85rem",
            border: "none",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Sign In
        </button>
      ) : (
        <>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            aria-label="Account menu"
            aria-expanded={dropdownOpen}
            className="glass"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.9rem",
              color: "var(--accent-strong)",
              cursor: "pointer",
            }}
          >
            {user.email.charAt(0).toUpperCase()}
          </button>

          {dropdownOpen && (
            <div
              className="card"
              style={{
                position: "absolute",
                top: "calc(100% + 0.6rem)",
                right: 0,
                zIndex: 60,
                minWidth: 230,
                padding: "0.85rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.6rem", borderBottom: "1px solid var(--border)" }}>
                <User size={15} color="var(--foreground-muted)" />
                <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)", wordBreak: "break-all" }}>{user.email}</span>
              </div>
              <Link
                href="/contacts"
                onClick={() => setDropdownOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", padding: "0.35rem 0.2rem", color: "var(--foreground)" }}
              >
                <Users size={15} /> Manage Emergency Contacts
              </Link>
              <button
                onClick={handleSignOut}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  padding: "0.35rem 0.2rem",
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          )}
        </>
      )}

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {toast && (
        <div
          className="glass"
          role="status"
          style={{
            position: "fixed",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3000,
            padding: "0.6rem 1.1rem",
            borderRadius: "999px",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
