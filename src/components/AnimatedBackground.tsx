"use client";

import { useMemo } from "react";

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

export function AnimatedBackground() {
  // Deterministic layout (seeded) so server/client render match and it never causes hydration mismatches.
  const stars = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      top: `${(rand() * 100).toFixed(2)}%`,
      left: `${(rand() * 100).toFixed(2)}%`,
      size: `${(1 + rand() * 2).toFixed(1)}px`,
      duration: `${(3 + rand() * 4).toFixed(1)}s`,
      delay: `${(rand() * 5).toFixed(1)}s`,
    }));
  }, []);

  const petals = useMemo(() => {
    const rand = seededRandom(7);
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: `${(rand() * 100).toFixed(2)}%`,
      size: `${(14 + rand() * 14).toFixed(0)}px`,
      duration: `${(14 + rand() * 12).toFixed(1)}s`,
      delay: `${(rand() * 15).toFixed(1)}s`,
      drift: `${(rand() * 120 - 60).toFixed(0)}px`,
    }));
  }, []);

  return (
    <div className="tulip-bg" aria-hidden="true">
      {stars.map((s) => (
        <span
          key={s.id}
          className="star"
          style={
            {
              top: s.top,
              left: s.left,
              "--size": s.size,
              "--duration": s.duration,
              "--delay": s.delay,
            } as React.CSSProperties
          }
        />
      ))}
      {petals.map((p) => (
        <span
          key={p.id}
          className="petal"
          style={
            {
              "--x": p.x,
              "--size": p.size,
              "--duration": p.duration,
              "--delay": p.delay,
              "--drift": p.drift,
            } as React.CSSProperties
          }
        >
          🌷
        </span>
      ))}
    </div>
  );
}
