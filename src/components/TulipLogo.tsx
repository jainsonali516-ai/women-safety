"use client";

import { useId } from "react";

/**
 * Neon-glowing pink tulip badge in a rounded glass container — replaces the previous flat
 * black-fill SVG, which didn't match the app's neon-pink "Galactic" visual language elsewhere
 * (route glows, star-tulips, risk badges). Theme-aware via Tailwind's `dark:` variant, which
 * this project wires to `[data-theme="dark"]` (see the `@custom-variant dark` line in
 * globals.css) rather than the OS preference, so it follows the in-app theme toggle.
 */
export function TulipLogo({ size = 32 }: { size?: number }) {
  // Multiple TulipLogo instances can render on the same page (header + hero) — each needs its
  // own gradient id, since SVG <defs> ids aren't otherwise scoped per component instance.
  const gradientId = useId();
  const padding = Math.max(6, Math.round(size * 0.25));

  return (
    <div
      className="relative flex items-center justify-center rounded-2xl border transition-all duration-300
                 bg-white/70 border-pink-300/60 shadow-[0_0_10px_rgba(236,72,153,0.25)]
                 dark:bg-slate-950/80 dark:border-pink-500/40 dark:shadow-[0_0_15px_rgba(236,72,153,0.4)]"
      style={{ padding }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Tulip logo"
        role="img"
        className="drop-shadow-[0_0_8px_rgba(255,77,141,0.7)]"
      >
        <path
          d="M12 2C8.5 2 6 5.5 6 9C6 13 9 15.5 12 18C15 15.5 18 13 18 9C18 5.5 15.5 2 12 2Z"
          fill={`url(#${gradientId})`}
        />
        <path d="M6 9C6 5.5 8.5 2 12 2C9.5 5 8 8 8 11.5" fill="#FF85C0" opacity="0.6" />
        <path d="M18 9C18 5.5 15.5 2 12 2C14.5 5 16 8 16 11.5" fill="#FF85C0" opacity="0.6" />
        <path d="M12 18V22M12 22H9.5M12 22H14.5" stroke="#EC4899" strokeWidth="2.2" strokeLinecap="round" />
        <defs>
          <linearGradient id={gradientId} x1="6" y1="2" x2="18" y2="18" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF77BC" />
            <stop offset="0.5" stopColor="#EC4899" />
            <stop offset="1" stopColor="#D946EF" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
