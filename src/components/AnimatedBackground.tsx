"use client";

import { useMemo } from "react";
import { TulipGlyph } from "./TulipGlyph";

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

export function AnimatedBackground() {
  // Deterministic layout (seeded) so server/client render match and it never causes hydration mismatches.
  const starTulips = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: 35 }, (_, i) => ({
      id: i,
      top: `${(rand() * 100).toFixed(2)}%`,
      left: `${(rand() * 100).toFixed(2)}%`,
      size: `${(8 + rand() * 10).toFixed(1)}px`,
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

  const blooms = useMemo(() => {
    const rand = seededRandom(19);
    return Array.from({ length: 9 }, (_, i) => ({
      id: i,
      x: `${(5 + rand() * 90).toFixed(2)}%`,
      size: `${(24 + rand() * 20).toFixed(0)}px`,
      duration: `${(5 + rand() * 3).toFixed(1)}s`,
      delay: `${(rand() * 4).toFixed(1)}s`,
    }));
  }, []);

  return (
    <div className="tulip-bg" aria-hidden="true">
      {starTulips.map((s) => (
        <TulipGlyph
          key={s.id}
          className="star-tulip"
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
      {blooms.map((b) => (
        <span
          key={b.id}
          className="garden-bloom"
          style={
            {
              "--x": b.x,
              "--size": b.size,
              "--duration": b.duration,
              "--delay": b.delay,
            } as React.CSSProperties
          }
        >
          🌷
        </span>
      ))}
    </div>
  );
}
