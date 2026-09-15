"use client";

import { Phone } from "lucide-react";
import { T } from "@/components/Translated";

const EMERGENCY_NUMBERS = [
  { label: "Women Helpline", number: "1091" },
  { label: "Police / Emergency", number: "112" },
  { label: "Police", number: "100" },
  { label: "Ambulance", number: "102" },
  { label: "Ambulance (alt)", number: "108" },
];

export function QuickDial() {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>
        <T>Emergency SOS Quick Dial</T>
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.6rem" }}>
        {EMERGENCY_NUMBERS.map((e) => (
          <a
            key={e.number}
            href={`tel:${e.number}`}
            className="btn-accent"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.7rem 0.9rem",
              borderRadius: "0.75rem",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            <Phone size={16} />
            <T>{e.label}</T> ({e.number})
          </a>
        ))}
      </div>
    </div>
  );
}
