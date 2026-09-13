"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  title: string;
  items: FaqItem[];
}

export function FaqAccordion({ categories }: { categories: FaqCategory[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {categories.map((cat) => (
        <div key={cat.title}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent-strong)", marginBottom: "0.6rem" }}>{cat.title}</h3>
          <div className="card" style={{ padding: "0.25rem 1rem", display: "flex", flexDirection: "column" }}>
            {cat.items.map((item, i) => {
              const key = `${cat.title}-${i}`;
              const open = openKey === key;
              return (
                <div key={key} style={{ borderBottom: i < cat.items.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <button
                    onClick={() => setOpenKey(open ? null : key)}
                    aria-expanded={open}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      padding: "0.85rem 0",
                      background: "none",
                      border: "none",
                      textAlign: "left",
                      color: "var(--foreground)",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {item.q}
                    <ChevronDown size={16} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                  </button>
                  {open && (
                    <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: 1.6, paddingBottom: "0.9rem" }}>{item.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
