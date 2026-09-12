"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TulipLogo } from "@/components/TulipLogo";

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, token: otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
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
          <h1 style={{ fontWeight: 700, fontSize: "1.4rem" }}>Welcome to Tulip</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", textAlign: "center" }}>
            Safety-first journey planning for Delhi NCR
          </p>
        </div>

        {step === "phone" ? (
          <form onSubmit={sendOtp} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 500 }}>Mobile number</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ padding: "0.65rem 0.5rem", color: "var(--foreground-muted)" }}>+91</span>
              <input
                type="tel"
                inputMode="numeric"
                required
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
            </div>
            {error && <p style={errorStyle}>{error}</p>}
            <button type="submit" disabled={loading} className="btn-accent" style={buttonStyle}>
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 500 }}>Enter the OTP sent to +91{phone}</label>
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={inputStyle}
            />
            {error && <p style={errorStyle}>{error}</p>}
            <button type="submit" disabled={loading} className="btn-accent" style={buttonStyle}>
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              style={{ background: "none", border: "none", color: "var(--foreground-muted)", fontSize: "0.8rem", cursor: "pointer" }}
            >
              Change number
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
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
