"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { T } from "@/components/Translated";

interface FeedbackItem {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

const PER_PAGE = 2;

/** A two-up testimonial carousel — colored quote cards with the name/date below, no photo (the
 * feedback table has no avatar field, and it wasn't asked for). Pages through approved feedback
 * two at a time with arrow buttons and dot indicators, wrapping around at either end. */
export function TestimonialCarousel({ items }: { items: FeedbackItem[] }) {
  const [page, setPage] = useState(0);

  if (items.length === 0) {
    return (
      <p style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>
        <T>No testimonials yet — be the first to share your experience.</T>
      </p>
    );
  }

  const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const visible = items.slice(clampedPage * PER_PAGE, clampedPage * PER_PAGE + PER_PAGE);

  function goTo(next: number) {
    setPage((next + pageCount) % pageCount);
  }

  return (
    <div style={{ position: "relative", padding: "0 2.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: visible.length > 1 ? "1fr 1fr" : "1fr", gap: "1rem" }}>
        {visible.map((item) => (
          <div
            key={item.id}
            style={{
              position: "relative",
              padding: "1.4rem 1.4rem 1.1rem",
              borderRadius: "0.9rem",
              background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
              color: "white",
              minHeight: 150,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Quote size={24} style={{ opacity: 0.4, marginBottom: "0.4rem", flexShrink: 0 }} fill="white" />
            <p style={{ fontSize: "0.88rem", lineHeight: 1.6 }}>
              <T>{item.message}</T>
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: visible.length > 1 ? "1fr 1fr" : "1fr", gap: "1rem", marginTop: "0.7rem" }}>
        {visible.map((item) => (
          <div key={item.id}>
            <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--foreground)" }}>{item.name}</p>
            <p style={{ fontSize: "0.7rem", color: "var(--foreground-muted)" }}>
              {new Date(item.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <>
          <button onClick={() => goTo(clampedPage - 1)} aria-label="Previous" style={{ ...arrowBtnStyle, left: 0 }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => goTo(clampedPage + 1)} aria-label="Next" style={{ ...arrowBtnStyle, right: 0 }}>
            <ChevronRight size={16} />
          </button>
          <div style={{ display: "flex", justifyContent: "center", gap: "0.4rem", marginTop: "1rem" }}>
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to page ${i + 1}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  border: "none",
                  padding: 0,
                  background: i === clampedPage ? "var(--accent)" : "var(--border)",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const arrowBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: "40%",
  transform: "translateY(-50%)",
  width: 30,
  height: 30,
  borderRadius: "50%",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
};
