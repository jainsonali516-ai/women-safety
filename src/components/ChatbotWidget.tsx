"use client";

import { useState } from "react";
import { X, Send } from "lucide-react";
import { useEmergencyMode } from "@/components/EmergencyModeProvider";
import { TulipLogo } from "@/components/TulipLogo";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

export function ChatbotWidget() {
  const { active: lowPower } = useEmergencyMode();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: "Ask me anything." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      // Stateless by design — every request sends its own full history, and nothing is kept
      // server-side afterward (see src/app/api/chat/route.ts), so there's no session id to track.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, history }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "bot", text: res.ok ? data.answer || "..." : data.error }]);
    } catch (err) {
      console.error("Ally request failed:", err);
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      setMessages((m) => [
        ...m,
        { role: "bot", text: timedOut ? "Ally is taking a while — please try again." : "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (lowPower) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-accent"
        aria-label="Open Ally"
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          zIndex: 2000,
        }}
      >
        <TulipLogo size={40} />
      </button>
    );
  }

  return (
    <div
      className="glass"
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        width: "min(340px, calc(100vw - 2rem))",
        maxHeight: "min(480px, calc(100vh - 4rem))",
        borderRadius: "1rem",
        // The shared .glass background (70%/65% opaque) let the page content behind it show
        // through too much on a floating panel like this — readable enough for a sticky nav bar
        // with mostly-empty space behind it, not for a chat window sitting over busy page content.
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
        // The Leaflet map's own floating controls (Night Heatmap/Nearby Amenities/etc.) use
        // z-index 1000 on an element that doesn't establish its own stacking context, so at the
        // page level they were winning over this panel's old z-index of 50 and visually covering
        // it — that's the "chatbot appears behind the map" bug. 2000 clears that (and everything
        // else in the app) with headroom. pointerEvents is explicit here since this panel is a
        // separate DOM subtree from the map (not nested inside it), so once it's stacked on top
        // it already receives its own clicks/typing/scroll directly — no event-propagation
        // workaround needed, just correct stacking.
        pointerEvents: "auto",
        zIndex: 2000,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span className={loading ? "tulip-bloom-breathe" : undefined} style={{ display: "inline-flex" }}>
            <TulipLogo size={18} />
          </span>
          <strong style={{ fontSize: "0.9rem" }}>Ally</strong>
        </span>
        <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--foreground-muted)" }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0.9rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "var(--accent)" : "var(--background-solid)",
              color: m.role === "user" ? "white" : "var(--foreground)",
              border: m.role === "bot" ? "1px solid var(--border)" : "none",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.8rem",
              maxWidth: "85%",
              fontSize: "0.85rem",
              whiteSpace: "pre-wrap",
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
            <span className="tulip-bloom-breathe" style={{ display: "inline-flex" }}>
              <TulipLogo size={16} />
            </span>{" "}
            Thinking...
          </div>
        )}
      </div>
      <form onSubmit={send} style={{ display: "flex", gap: "0.4rem", padding: "0.7rem", borderTop: "1px solid var(--border)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Ally..."
          style={{ flex: 1, padding: "0.5rem 0.7rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}
        />
        <button type="submit" className="btn-accent" style={{ padding: "0.5rem 0.8rem", borderRadius: "0.6rem", border: "none", cursor: "pointer" }}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
