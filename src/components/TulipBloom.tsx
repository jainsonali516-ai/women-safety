"use client";

import { useId } from "react";

interface TulipBloomProps {
  size?: number;
  /** 0 = closed bud (low confidence / caution), 1 = fully open bloom (safe / verified). */
  openness?: number;
  petals?: number;
  color?: string;
  centerColor?: string;
  className?: string;
  /** Slow petal-unfurl breathing loop — used for "thinking"/loading states. */
  animated?: boolean;
  title?: string;
}

/**
 * The one recurring brand shape across the app: petals radiating from a center point. Every
 * other use of the tulip motif (logo, route safety indicator, bot avatar/thinking state, the
 * "arrived safely" bloom moment) renders through this single primitive rather than each screen
 * inventing its own flower — `openness` is what actually carries meaning (a closed bud reads as
 * low-confidence/caution, a full bloom reads as safe/verified), everything else is presentation.
 */
export function TulipBloom({
  size = 32,
  openness = 1,
  petals = 5,
  color = "var(--accent)",
  centerColor = "var(--accent-strong)",
  className,
  animated = false,
  title,
}: TulipBloomProps) {
  const gradientId = useId();
  const clamped = Math.min(1, Math.max(0, openness));
  // Closed (0): petals stay short and tucked in near the center, reading as a folded bud.
  // Open (1): petals extend outward and grow, reading as a spread bloom.
  const reach = 3 + clamped * 6;
  const length = 6 + clamped * 8;

  const petalPath = `M -2.6,0 Q -4.4,${-length * 0.55} 0,${-length} Q 4.4,${-length * 0.55} 2.6,0 Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor={color} />
          <stop offset="1" stopColor={centerColor} />
        </linearGradient>
      </defs>
      <g className={animated ? "tulip-bloom-breathe" : undefined} style={{ transformOrigin: "16px 16px" }}>
        {Array.from({ length: petals }).map((_, i) => {
          const angle = (360 / petals) * i;
          return (
            <g key={i} transform={`translate(16 16) rotate(${angle}) translate(0 ${-reach})`}>
              <path d={petalPath} fill={`url(#${gradientId})`} opacity={0.94} />
            </g>
          );
        })}
        <circle cx="16" cy="16" r={2.2 + clamped * 0.8} fill={centerColor} />
      </g>
    </svg>
  );
}
