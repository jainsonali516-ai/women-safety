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
  // mismatches. These twinkle in place (fixed position); falling motion lives in the separate
  // fallingPetals layer below.
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

  // Falling petals, active in both themes — drifting down the screen with a gentle sway,
  // layered on top of the twinkling stars (also both themes now) and, in light mode, the
  // growing garden blooms.
  const fallingPetals = useMemo(() => {
    const rand = seededRandom(77);
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: `${(rand() * 100).toFixed(2)}%`,
      size: `${(10 + rand() * 12).toFixed(1)}px`,
      duration: `${(8 + rand() * 7).toFixed(1)}s`,
      delay: `${(rand() * 10).toFixed(1)}s`,
      drift: `${(rand() * 60 - 30).toFixed(0)}px`,
      colorClass: STAR_COLOR_CLASSES[i % STAR_COLOR_CLASSES.length],
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
      {fallingPetals.map((p) => (
        <TulipGlyph
          key={p.id}
          className={`falling-petal ${p.colorClass}`}
          style={
            {
              left: p.left,
              "--size": p.size,
              "--duration": p.duration,
              "--delay": p.delay,
              "--drift": p.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
