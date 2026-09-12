"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TulipLogo } from "@/components/TulipLogo";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login" ? { email, password } : { email, password, full_name: fullName, phone };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (mode === "signup" && !data.session) {
        setInfo("Account created. Check your email to confirm, then log in.");
        setMode("login");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div className="card" style={{ padding: "2rem", width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <TulipLogo size={40} />
          <h1 style={{ fontWeight: 700, fontSize: "1.4rem" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", textAlign: "center" }}>
            Safety-first journey planning for Delhi NCR
          </p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {mode === "signup" && (
            <>
              <input
                type="text"
                required
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={inputStyle}
              />
              <input
                type="tel"
                placeholder="Phone number (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
            </>
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          {error && <p style={errorStyle}>{error}</p>}
          {info && <p style={{ fontSize: "0.8rem", color: "var(--accent-strong)" }}>{info}</p>}
          <button type="submit" disabled={loading} className="btn-accent" style={buttonStyle}>
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setInfo(null);
            }}
            style={{ background: "none", border: "none", color: "var(--foreground-muted)", fontSize: "0.8rem", cursor: "pointer" }}
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    </main>
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
