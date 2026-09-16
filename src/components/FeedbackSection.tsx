"use client";

import { useEffect, useState } from "react";
import { MessageSquareQuote, Send } from "lucide-react";
import { T } from "@/components/Translated";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";

interface FeedbackItem {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

/**
 * Public feedback + testimonials — no sign-in required in either direction, matching the
 * feedback table's RLS (anyone can insert; only status='approved' rows are ever readable).
 * A submitted piece of feedback starts as 'pending' and won't appear below until someone flips
 * it to 'approved' directly in the Supabase table editor — there's no in-app moderation UI (by
 * design, for now), and no email notification of any kind is sent to anyone on submission.
 */
export function FeedbackSection() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function loadFeedback() {
    try {
      const res = await fetch("/api/feedback");
      if (res.ok) setItems((await res.json()).feedback ?? []);
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadFeedback();
  }, []);

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setForm({ name: "", email: "", message: "" });
      setSubmitted(true);
    } catch {
      setError("Network error while sending your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h2 style={{ fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <MessageSquareQuote size={18} style={{ color: "var(--accent-strong)" }} />
          <T>User Feedback</T>
        </h2>
        <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
          <T>Tell us what you think of HerLane. Approved feedback appears publicly below — no sign-in needed to share yours.</T>
        </p>
      </div>

      {submitted ? (
        <p style={{ fontSize: "0.85rem", color: "var(--accent-strong)", fontWeight: 600 }}>
          <T>{"Thanks for the feedback! It'll appear below once it's been reviewed."}</T>
        </p>
      ) : (
        <form onSubmit={submitFeedback} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div className="mobile-stack" style={{ display: "flex", gap: "0.5rem" }}>
            <input
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="field"
              style={inputStyle}
            />
            <input
              type="email"
              placeholder="Your email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="field"
              style={inputStyle}
            />
          </div>
          <textarea
            placeholder="What did you think?"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
            rows={3}
            className="field"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
          {error && (
            <p style={{ color: "#ef4444", fontSize: "0.8rem" }}>
              <T>{error}</T>
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn-accent"
            style={{
              alignSelf: "flex-start",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              fontWeight: 600,
              fontSize: "0.85rem",
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            <Send size={14} />
            <T>{submitting ? "Sending..." : "Send Feedback"}</T>
          </button>
        </form>
      )}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--foreground-muted)" }}>
          <T>What people are saying</T>
        </h3>
        {!loadingItems && <TestimonialCarousel items={items} />}
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 120,
  padding: "0.55rem 0.7rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: "0.85rem",
};
