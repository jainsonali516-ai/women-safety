"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { AuthModal } from "@/components/AuthModal";
import { T } from "@/components/Translated";

/**
 * Wraps a safety action that needs an account (saving a contact, triggering SOS) — renders the
 * real feature once signed in, or a friendly "sign in to continue" card + AuthModal for a guest,
 * instead of letting the guest hit the action and get a raw "Unauthorized" API error.
 */
export function RequireAuthGate({ message, children }: { message: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (loading) return null;
  if (user) return <>{children}</>;

  return (
    <div className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", textAlign: "center" }}>
      <LogIn size={22} color="var(--accent-strong)" />
      <p style={{ fontSize: "0.9rem", color: "var(--foreground-muted)", maxWidth: 340 }}>
        <T>{message}</T>
      </p>
      <button onClick={() => setShowModal(true)} className="btn-accent" style={{ padding: "0.6rem 1.2rem", border: "none", fontWeight: 700, cursor: "pointer" }}>
        <T>Sign In</T>
      </button>
      {showModal && <AuthModal message={message} onClose={() => setShowModal(false)} />}
    </div>
  );
}
