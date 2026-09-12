"use client";

import { useState } from "react";
import { MessageSquareText, X, Send } from "lucide-react";
import { useEmergencyMode } from "@/components/EmergencyModeProvider";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

export function ChatbotWidget() {
  const { active: lowPower } = useEmergencyMode();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: "Ask me about an upcoming trip and I'll forecast the safest, fastest mode for that time." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "bot", text: res.ok ? data.reply : data.error }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Sorry, something went wrong." }]);
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
        aria-label="Open Tulip Bot"
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
          zIndex: 50,
        }}
      >
        <MessageSquareText size={22} />
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
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1rem", borderBottom: "1px solid var(--border)" }}>
        <strong style={{ fontSize: "0.9rem" }}>Tulip Bot</strong>
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
        {loading && <div style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Thinking...</div>}
      </div>
      <form onSubmit={send} style={{ display: "flex", gap: "0.4rem", padding: "0.7rem", borderTop: "1px solid var(--border)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a trip..."
          style={{ flex: 1, padding: "0.5rem 0.7rem", borderRadius: "0.6rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", fontSize: "0.85rem" }}
        />
        <button type="submit" className="btn-accent" style={{ padding: "0.5rem 0.8rem", borderRadius: "0.6rem", border: "none", cursor: "pointer" }}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
