"use client";

import { X } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { TulipLogo } from "@/components/TulipLogo";

interface Props {
  /** Why the modal opened — shown above the form (e.g. "Sign in to save your emergency
   * contacts & enable automatic alerts."). Omit for a plain "sign in to continue" open. */
  message?: string;
  onClose: () => void;
}

/** The shared gate for every guest-blocked action (saving a contact, triggering SOS) and for
 * the header's "Sign In" entry point — one modal, not a separate one per gated feature. */
export function AuthModal({ message, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(10, 4, 14, 0.6)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: "2rem", width: "100%", maxWidth: 380, position: "relative" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            color: "var(--foreground-muted)",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <TulipLogo size={36} />
          <h2 style={{ fontWeight: 700, fontSize: "1.25rem", textAlign: "center" }}>
            {message ? "Sign in to continue" : "Welcome to HerLane"}
          </h2>
          {message && (
            <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", textAlign: "center" }}>{message}</p>
          )}
        </div>

        <AuthForm onSuccess={onClose} />
      </div>
    </div>
  );
}
