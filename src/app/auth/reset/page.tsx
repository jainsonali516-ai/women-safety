"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TulipLogo } from "@/components/TulipLogo";
import { T } from "@/components/Translated";

function ResetPasswordForm() {
  const router = useRouter();
  const emailParam = useSearchParams().get("email");
  const [email, setEmail] = useState(emailParam ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      setTimeout(() => router.push("/auth"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p style={{ fontSize: "0.9rem", textAlign: "center", color: "var(--foreground)" }}>
        <T>Password updated! Taking you to log in...</T>
      </p>
    );
  }

  return (
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
      <input
        type="text"
        required
        inputMode="numeric"
        maxLength={6}
        placeholder="6-digit code"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        className="field"
        style={{ padding: "0.65rem 0.8rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem", letterSpacing: "0.3em" }}
      />
      <input
        type="password"
        required
        minLength={8}
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
        <T>{loading ? "Saving..." : "Set new password"}</T>
      </button>
      <Link href="/auth/forgot" style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
        <T>{"Didn't get a code? Request a new one"}</T>
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <TulipLogo size={40} />
          <h1 style={{ fontWeight: 700, fontSize: "1.4rem" }}>
            <T>Set a new password</T>
          </h1>
        </div>

        <Suspense
          fallback={
            <p style={{ fontSize: "0.85rem", textAlign: "center", color: "var(--foreground-muted)" }}>
              <T>Loading...</T>
            </p>
          }
        >
          <ResetPasswordForm />
        </Suspense>

        <Link href="/auth" style={{ display: "block", textAlign: "center", marginTop: "1rem", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
          <T>Back to log in</T>
        </Link>
      </div>
    </main>
  );
}
