"use client";

import { useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Send } from "lucide-react";
import { TulipBloom } from "@/components/TulipBloom";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

export default function BotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: "Hi, I'm HerLane Bot. Ask me anything." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Kept for the whole conversation so on-demand.io's session remembers earlier turns instead
  // of starting fresh on every message — same pattern as the floating widget version.
  const sessionIdRef = useRef<string | null>(null);
  const externalUserIdRef = useRef<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage = input.trim();
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: "user", text: userMessage }]);
    setInput("");
    setLoading(true);
    try {
      if (!externalUserIdRef.current) externalUserIdRef.current = crypto.randomUUID();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          externalUserId: externalUserIdRef.current,
          sessionId: sessionIdRef.current ?? undefined,
          history,
        }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await res.json();
      if (res.ok && data.sessionId) sessionIdRef.current = data.sessionId;
      setMessages((m) => [...m, { role: "bot", text: res.ok ? data.answer || "..." : data.error }]);
    } catch (err) {
      console.error("HerLane Bot request failed:", err);
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      setMessages((m) => [
        ...m,
        { role: "bot", text: timedOut ? "HerLane Bot is taking a while — please try again." : "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main style={{ flex: 1, padding: "1.5rem", maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <TulipBloom size={26} openness={1} title="HerLane Bot" /> HerLane Bot
        </h1>
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
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
              <TulipBloom size={18} openness={0.6} animated title="Thinking" /> HerLane Bot is thinking...
            </div>
          )}
        </div>
        <form onSubmit={send} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask HerLane Bot..."
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
