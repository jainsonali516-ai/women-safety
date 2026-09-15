"use client";

import Image from "next/image";

/**
 * The app's identity mark: the theme-swapped circular "HerLane" badge (girl silhouette against
 * the city skyline, wordmark below) supplied directly as artwork — same theme-swap mechanism as
 * PhotoHeroBackground (pure CSS via [data-theme], so there's no flash of the wrong image).
 * The source images carry their own black margin around the circle, so they're scaled up and
 * clipped to a circular frame here to show the badge edge-to-edge instead of inset in dead space.
 */
export function TulipLogo({ size = 32 }: { size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, transform: "scale(1.28)" }} className="herlane-logo-light">
        <Image src="/images/logo-light.jpg" alt="HerLane logo" fill sizes={`${size}px`} style={{ objectFit: "cover" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, transform: "scale(1.28)" }} className="herlane-logo-dark">
        <Image src="/images/logo-dark.jpg" alt="HerLane logo" fill sizes={`${size}px`} style={{ objectFit: "cover" }} />
      </div>
    </div>
  );
}
