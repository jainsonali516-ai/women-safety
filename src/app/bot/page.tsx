"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Send } from "lucide-react";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

export default function BotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "Hi, I'm Tulip Bot. Tell me about an upcoming trip — e.g. \"Thursday 8:30 AM from Noida Sector 62 to Cyber Hub, Gurgaon\" — and I'll forecast the safest, fastest mode for that time.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage = input.trim();
    setMessages((m) => [...m, { role: "user", text: userMessage }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "bot", text: res.ok ? data.reply : data.error }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main style={{ flex: 1, padding: "1.5rem", maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Tulip Bot</h1>
        <div className="card" style={{ flex: 1, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: 360 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "var(--accent)" : "var(--background)",
                color: m.role === "user" ? "white" : "var(--foreground)",
                border: m.role === "bot" ? "1px solid var(--border)" : "none",
                padding: "0.6rem 0.9rem",
                borderRadius: "0.9rem",
                maxWidth: "80%",
                fontSize: "0.9rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
            </div>
          ))}
          {loading && <div style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>Tulip Bot is thinking...</div>}
        </div>
        <form onSubmit={send} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about an upcoming trip..."
            style={{ flex: 1, padding: "0.7rem 0.9rem", borderRadius: "0.7rem", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
          />
          <button type="submit" className="btn-accent" style={{ padding: "0.7rem 1rem", borderRadius: "0.7rem", border: "none", cursor: "pointer" }}>
            <Send size={16} />
          </button>
        </form>
      </main>
    </>
  );
}
