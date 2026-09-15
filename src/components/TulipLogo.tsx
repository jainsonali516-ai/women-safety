"use client";

import { useId } from "react";

/**
 * The app's identity mark: a pink heart containing a simple side-profile face silhouette with a
 * ponytail — matching the brand's "HerLane" wordmark treatment used across the photo heroes.
 * Kept as the same component name/signature (TulipLogo) that every page already imports, so this
 * is purely a visual swap of what renders inside, not a rename across the app.
 */
export function TulipLogo({ size = 32 }: { size?: number }) {
  const gradientId = useId();
  const padding = Math.max(4, Math.round(size * 0.16));

  return (
    <div
      className="relative flex items-center justify-center rounded-2xl border transition-all duration-300
                 bg-white/70 border-pink-300/60 shadow-[0_0_10px_rgba(230,79,108,0.25)]
                 dark:bg-slate-950/80 dark:border-pink-500/40 dark:shadow-[0_0_15px_rgba(230,79,108,0.4)]"
      style={{ padding }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="HerLane logo">
        <defs>
          <linearGradient id={gradientId} x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff6f91" />
            <stop offset="100%" stopColor="#e83a5a" />
          </linearGradient>
        </defs>
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill={`url(#${gradientId})`}
        />
        {/* Side-profile face silhouette with a small ponytail, sitting inside the upper lobe. */}
        <path
          d="M13.3,5.7 C14.5,5.9 15.3,6.9 15.1,8 C15,8.5 15.6,8.7 15.9,9.2 C16.2,9.7 16,10.4 15.4,10.6 C15.2,10.7 15.1,10.8 15.1,11 L15.1,12.1 C15.1,12.4 14.9,12.6 14.6,12.6 L13.4,12.6 C13.1,12.6 12.9,12.4 12.9,12.1 L12.9,11.4 C12,11.1 11.4,10.3 11.4,9.4 L11.4,8.4 C11.4,6.9 12,5.5 13.3,5.7 Z"
          fill="#1b1420"
          opacity="0.92"
        />
        <path d="M14.6,6 C15.5,5.7 16,4.8 15.8,3.9 C16.6,4.4 16.9,5.4 16.4,6.2 C16,6.8 15.3,7.1 14.6,6.9 Z" fill="#1b1420" opacity="0.8" />
      </svg>
    </div>
  );
}
