"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

/** Shared login/signup form + submit logic — used standalone on the full /auth page and inside
 * AuthModal, so the two don't drift into two different auth implementations. */
export function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login"
          ? { identifier, password }
          : { email: identifier, password, full_name: fullName, phone: phone || undefined };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {mode === "signup" && (
        <>
          <input
            type="text"
            required
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="field"
            style={inputStyle}
          />
          <input
            type="tel"
            placeholder="Phone number (optional — lets you log in with it too)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="field"
            style={inputStyle}
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="field"
            style={inputStyle}
          />
        </>
      )}
      {mode === "login" && (
        <input
          type="text"
          required
          placeholder="Email or phone number"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="field"
          style={inputStyle}
        />
      )}
      <input
        type="password"
        required
        minLength={8}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="field"
        style={inputStyle}
      />
      {error && <p style={errorStyle}>{error}</p>}
      <button type="submit" disabled={loading} className="btn-accent" style={buttonStyle}>
        {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
        }}
        style={{ background: "none", border: "none", color: "var(--foreground-muted)", fontSize: "0.8rem", cursor: "pointer" }}
      >
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.65rem 0.8rem",
  borderRadius: "0.6rem",
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: "0.95rem",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.75rem",
  borderRadius: "0.7rem",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = { color: "#ef4444", fontSize: "0.8rem" };
