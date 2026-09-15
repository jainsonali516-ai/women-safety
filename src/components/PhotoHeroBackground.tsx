import Image from "next/image";

/** The theme-swapped photo layer + legibility scrim shared by every full-bleed photo hero
 * (homepage, About). Theme swap is pure CSS (data-theme, set pre-hydration) so there's no flash
 * of the wrong image and this works from a Server Component with zero client JS. */
export function PhotoHeroBackground({ objectPosition = "64% 55%" }: { objectPosition?: string }) {
  return (
    <>
      <div className="herlane-photo-hero-bg herlane-photo-hero-bg-light" aria-hidden="true">
        <Image src="/images/hero-light.jpg" alt="" fill priority quality={95} sizes="100vw" style={{ objectFit: "cover", objectPosition }} />
      </div>
      <div className="herlane-photo-hero-bg herlane-photo-hero-bg-dark" aria-hidden="true">
        <Image src="/images/hero-dark.jpg" alt="" fill priority quality={95} sizes="100vw" style={{ objectFit: "cover", objectPosition }} />
      </div>
      <div className="herlane-photo-hero-scrim" aria-hidden="true" />
    </>
  );
}
