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

const STAR_COLOR_CLASSES = ["tulip-star-pink", "tulip-star-magenta", "tulip-star-violet"];

export function AnimatedBackground() {
  // Deterministic layout (seeded) so server/client render match and it never causes hydration
  // mismatches. Stars stay fixed in place and only twinkle in place — no falling/drifting motion.
  const starTulips = useMemo(() => {
    const rand = seededRandom(42);
    return Array.from({ length: 42 }, (_, i) => ({
      id: i,
      top: `${(rand() * 100).toFixed(2)}%`,
      left: `${(rand() * 100).toFixed(2)}%`,
      size: `${(8 + rand() * 10).toFixed(1)}px`,
      duration: `${(3 + rand() * 4).toFixed(1)}s`,
      delay: `${(rand() * 5).toFixed(1)}s`,
      colorClass: STAR_COLOR_CLASSES[i % STAR_COLOR_CLASSES.length],
    }));
  }, []);

  const blooms = useMemo(() => {
    const rand = seededRandom(19);
    return Array.from({ length: 9 }, (_, i) => ({
      id: i,
      x: `${(5 + rand() * 90).toFixed(2)}%`,
      size: `${(28 + rand() * 22).toFixed(0)}px`,
      duration: `${(4 + rand() * 3).toFixed(1)}s`,
      delay: `${(rand() * 2).toFixed(1)}s`,
    }));
  }, []);

  return (
    <div className="tulip-bg" aria-hidden="true">
      {starTulips.map((s) => (
        <TulipGlyph
          key={s.id}
          className={`star-tulip ${s.colorClass}`}
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
      {blooms.map((b) => (
        <TulipGlyph
          key={b.id}
          withStem
          className="garden-bloom"
          style={
            {
              "--x": b.x,
              "--size": b.size,
              "--duration": b.duration,
              "--delay": b.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
