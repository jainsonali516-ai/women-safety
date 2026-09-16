"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TulipLogo } from "@/components/TulipLogo";
import { T } from "@/components/Translated";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/auth/reset?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <TulipLogo size={40} />
          <h1 style={{ fontWeight: 700, fontSize: "1.4rem" }}>
            <T>Reset your password</T>
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", textAlign: "center" }}>
            <T>{"Enter the email on your account and we'll send you a 6-digit code to reset your password."}</T>
          </p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            style={{ padding: "0.65rem 0.8rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem" }}
          />
          {error && (
            <p style={{ color: "#ef4444", fontSize: "0.8rem" }}>
              <T>{error}</T>
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-accent"
            style={{ padding: "0.75rem", borderRadius: "0.7rem", fontWeight: 600, border: "none", cursor: loading ? "wait" : "pointer" }}
          >
            <T>{loading ? "Sending..." : "Send code"}</T>
          </button>
        </form>

        <Link href="/auth" style={{ display: "block", textAlign: "center", marginTop: "1rem", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
          <T>Back to log in</T>
        </Link>
      </div>
    </main>
  );
}
