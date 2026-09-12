import { Clock, IndianRupee, Navigation, Shield } from "lucide-react";

export interface RouteOption {
  mode: string;
  label: string;
  duration_min: number;
  fare_inr: number;
  safety_score: number;
  rush_score: number;
  final_score: number;
  deep_link?: string;
  web_link?: string;
}

export function RouteCardGrid({ options }: { options: RouteOption[] }) {
  if (options.length === 0) {
    return <p style={{ color: "var(--foreground-muted)", fontSize: "0.9rem" }}>No routes match the selected filters.</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
      {options.map((opt) => (
        <div key={opt.mode} className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
            <strong style={{ fontSize: "0.95rem" }}>{opt.label}</strong>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                padding: "0.2rem 0.5rem",
                borderRadius: "999px",
                background: "var(--accent)",
                color: "white",
                whiteSpace: "nowrap",
              }}
            >
              {opt.final_score}/100
            </span>
          </div>
          <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "var(--foreground-muted)", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Clock size={14} /> {opt.duration_min} min
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <IndianRupee size={14} /> {opt.fare_inr}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Shield size={14} /> Safety {opt.safety_score}
            </span>
          </div>
          {opt.deep_link && (
            <a
              href={opt.web_link}
              target="_blank"
              rel="noreferrer"
              className="btn-accent"
              style={{ alignSelf: "flex-start", padding: "0.5rem 1rem", borderRadius: "0.6rem", fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Navigation size={14} /> Book {opt.label}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
