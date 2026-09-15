"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { useLanguage, LANGUAGES } from "@/components/LanguageProvider";

/** Same visual language as ThemeToggle (a small "card" button) — opens a dropdown of the
 * languages Sarvam AI's translation API supports rather than a two-state toggle, since there
 * isn't just an "on/off" here. */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-expanded={open}
        className="card"
        style={{
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Languages size={18} color="var(--accent-strong)" />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div
            className="card"
            style={{
              position: "absolute",
              top: "calc(100% + 0.5rem)",
              right: 0,
              zIndex: 91,
              minWidth: 160,
              maxHeight: 280,
              overflowY: "auto",
              padding: "0.4rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.15rem",
            }}
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLanguage(lang.code);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.7rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: lang.code === language ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                  color: lang.code === language ? "var(--accent)" : "var(--foreground)",
                  fontWeight: lang.code === language ? 700 : 500,
                  fontSize: "0.85rem",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
