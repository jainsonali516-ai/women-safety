"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Send } from "lucide-react";
import { TulipLogo } from "@/components/TulipLogo";
import { T } from "@/components/Translated";
import { useLanguage } from "@/components/LanguageProvider";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
  // true only for hardcoded UI copy (the seed greeting, a client-side error fallback) — the
  // user's own typed text and Ally's answer (already generated in the selected language server-
  // side, see /api/chat) render as-is instead of being run back through the Sarvam translator.
  translatable?: boolean;
}

export default function BotPage() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", text: "Hi, I'm Ally. Ask me anything.", translatable: true },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage = input.trim();
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: "user", text: userMessage }]);
    setInput("");
    setLoading(true);
    try {
      // Stateless by design — every request sends its own full history, and nothing is kept
      // server-side afterward (see src/app/api/chat/route.ts), so there's no session id to track.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage, history, language }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "bot", text: res.ok ? data.answer || "..." : data.error, translatable: !res.ok }]);
    } catch (err) {
      console.error("Ally request failed:", err);
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      setMessages((m) => [
        ...m,
        { role: "bot", text: timedOut ? "Ally is taking a while, please try again." : "Sorry, something went wrong. Please try again.", translatable: true },
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
          <TulipLogo size={30} /> Ally
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
              {m.translatable ? <T>{m.text}</T> : m.text}
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--foreground-muted)" }}>
              <span className="tulip-bloom-breathe" style={{ display: "inline-flex" }}>
                <TulipLogo size={18} />
              </span>{" "}
              <T>Ally is thinking...</T>
            </div>
          )}
        </div>
        <form onSubmit={send} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Ally..."
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
