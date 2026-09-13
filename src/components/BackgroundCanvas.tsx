"use client";

import { useEffect, useRef } from "react";

const PETAL_COLORS = ["#FFB7D5", "#FF69B4", "#FFC0CB"];
const STAR_COLORS = ["#FF77BC", "#FEF08A"];

interface Petal {
  baseX: number;
  y: number;
  size: number;
  speedY: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  rotation: number;
  rotationSpeed: number;
  colorIdx: number;
  scalePhase: number;
}

interface SparkleStar {
  x: number;
  y: number;
  phase: number;
  speed: number;
  colorIdx: number;
}

type IconKind = "train" | "bus" | "car";

interface TransportIcon {
  x: number;
  y: number;
  speed: number;
  iconIdx: number;
  scale: number;
  direction: 1 | -1;
}

/** Rasterize a shape once to an offscreen canvas and blit it every frame instead of re-tracing
 * bezier/path geometry per particle per frame — the difference between a canvas particle system
 * that's cheap enough for a phone and one that isn't. */
function makePetalSprite(color: string, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size * 2.4;
  c.height = size * 3;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  // Organic curved petal — two bezier curves meeting at a point top and bottom.
  ctx.moveTo(0, -size * 1.25);
  ctx.bezierCurveTo(size * 0.95, -size * 0.85, size * 0.7, size * 0.65, 0, size * 1.25);
  ctx.bezierCurveTo(-size * 0.7, size * 0.65, -size * 0.95, -size * 0.85, 0, -size * 1.25);
  ctx.closePath();
  ctx.fill();
  return c;
}

function makeStarSprite(color: string, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const s = size * 4;
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.translate(s / 2, s / 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 1.4;
  // Four-pointed diamond sparkle (✦), drawn with quadratic curves for soft concave points.
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size * 0.18, -size * 0.18, size, 0);
  ctx.quadraticCurveTo(size * 0.18, size * 0.18, 0, size);
  ctx.quadraticCurveTo(-size * 0.18, size * 0.18, -size, 0);
  ctx.quadraticCurveTo(-size * 0.18, -size * 0.18, 0, -size);
  ctx.closePath();
  ctx.fill();
  return c;
}

/** Minimal, stylized transport silhouettes — deliberately simple geometric shapes (not detailed
 * icons) since they render at low opacity/size as ambient texture, not a focal element. */
function makeIconSprite(kind: IconKind): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const w = kind === "bus" ? 46 : kind === "train" ? 40 : 32;
  const h = 22;
  c.width = w + 4;
  c.height = h + 10;
  const ctx = c.getContext("2d")!;
  ctx.translate(2, 2);
  ctx.fillStyle = "#EC4899";
  ctx.strokeStyle = "#EC4899";

  const bodyR = 6;
  ctx.beginPath();
  ctx.moveTo(bodyR, 0);
  ctx.arcTo(w, 0, w, h, bodyR);
  ctx.arcTo(w, h, 0, h, bodyR);
  ctx.arcTo(0, h, 0, 0, bodyR);
  ctx.arcTo(0, 0, w, 0, bodyR);
  ctx.closePath();
  ctx.fill();

  // Windows — a lighter cut-out row (drawn with reduced alpha over the body).
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#ffffff";
  const windowCount = kind === "bus" ? 4 : kind === "train" ? 3 : 1;
  const windowW = kind === "car" ? w * 0.45 : (w - 8) / windowCount - 3;
  for (let i = 0; i < windowCount; i++) {
    const wx = kind === "car" ? w * 0.3 : 4 + i * (windowW + 3);
    ctx.fillRect(wx, 4, windowW, 8);
  }
  ctx.globalAlpha = 1;

  // Wheels.
  ctx.fillStyle = "#EC4899";
  const wheelY = h + 3;
  const wheelR = 3.5;
  ctx.beginPath();
  ctx.arc(w * 0.22, wheelY, wheelR, 0, Math.PI * 2);
  ctx.arc(w * 0.78, wheelY, wheelR, 0, Math.PI * 2);
  if (kind === "bus") ctx.arc(w * 0.5, wheelY, wheelR, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/**
 * Hand-drawn canvas background: falling organic tulip petals (sway + rotation + flip), pulsing
 * sparkle stars, and a few slow-drifting transport silhouettes (metro/bus/auto — this app is a
 * commute planner) as subtle ambient texture. Deliberately kept behind everything and
 * non-interactive (fixed, negative z-index, pointer-events:none) so it never visually competes
 * with or blocks real UI — it's texture, not a UI layer.
 *
 * This replaced a CSS/SVG version of the same idea. A JS canvas redraw loop is genuinely more
 * phone-CPU-expensive than CSS transform/opacity animation (which can run off the main thread),
 * so this keeps costs down deliberately: every shape is rasterized once to an offscreen sprite
 * and blitted (not re-traced) each frame, particle counts are modest and roughly halved on
 * narrow screens, the loop pauses via visibilitychange when the tab isn't visible, and it
 * renders one static frame instead of animating at all under prefers-reduced-motion.
 */
export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    }
    window.addEventListener("resize", onResize);

    const petalSprites = PETAL_COLORS.map((color) => makePetalSprite(color, 14));
    const starSprites = STAR_COLORS.map((color) => makeStarSprite(color, 6));
    const iconKinds: IconKind[] = ["train", "bus", "car"];
    const iconSprites = iconKinds.map((k) => makeIconSprite(k));

    const isNarrow = width < 640;
    const petalCount = isNarrow ? 8 : 15;
    const starCount = isNarrow ? 12 : 22;

    const petals: Petal[] = Array.from({ length: petalCount }, () => ({
      baseX: Math.random() * width,
      y: Math.random() * height * 2 - height,
      size: 12 + Math.random() * 10,
      speedY: 0.8 + Math.random() * 1.0,
      swayAmp: 18 + Math.random() * 22,
      swayFreq: 0.0006 + Math.random() * 0.0006,
      swayPhase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.03,
      colorIdx: Math.floor(Math.random() * PETAL_COLORS.length),
      scalePhase: Math.random() * Math.PI * 2,
    }));

    const stars: SparkleStar[] = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0015 + Math.random() * 0.0015,
      colorIdx: Math.floor(Math.random() * STAR_COLORS.length),
    }));

    // Slow horizontal drift, staying in the upper third of the screen so this ambient texture
    // never crowds the vertical center where the main content/cards usually sit.
    const icons: TransportIcon[] = Array.from({ length: 4 }, (_, i) => ({
      x: Math.random() * width,
      y: height * (0.06 + 0.09 * i),
      speed: 0.12 + Math.random() * 0.13,
      iconIdx: i % iconSprites.length,
      scale: 0.85 + Math.random() * 0.5,
      direction: i % 2 === 0 ? 1 : -1,
    }));

    let raf = 0;
    let visible = document.visibilityState === "visible";

    function onVisibility() {
      visible = document.visibilityState === "visible";
      if (visible && !reduceMotion) raf = requestAnimationFrame(loop);
    }
    document.addEventListener("visibilitychange", onVisibility);

    function loop(time: number) {
      if (!visible) return;
      ctx!.clearRect(0, 0, width, height);

      for (const icon of icons) {
        icon.x += icon.speed * icon.direction;
        const sprite = iconSprites[icon.iconIdx];
        const w = sprite.width * icon.scale;
        if (icon.direction === 1 && icon.x > width + w) icon.x = -w;
        if (icon.direction === -1 && icon.x < -w) icon.x = width + w;
        ctx!.globalAlpha = 0.14;
        ctx!.drawImage(sprite, icon.x - w / 2, icon.y, w, sprite.height * icon.scale);
      }

      for (const star of stars) {
        const glow = 0.2 + 0.75 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
        ctx!.globalAlpha = glow;
        const sprite = starSprites[star.colorIdx];
        ctx!.drawImage(sprite, star.x - sprite.width / 2, star.y - sprite.height / 2);
      }

      for (const p of petals) {
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;
        if (p.y - p.size > height) {
          p.y = -p.size * 2;
          p.baseX = Math.random() * width;
        }
        const x = p.baseX + Math.sin(time * p.swayFreq + p.swayPhase) * p.swayAmp;
        const flip = Math.cos(time * 0.0015 + p.scalePhase);
        const sprite = petalSprites[p.colorIdx];
        ctx!.save();
        ctx!.globalAlpha = 0.55 + 0.25 * Math.abs(flip);
        ctx!.translate(x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.scale(Math.max(0.05, Math.abs(flip)) * Math.sign(flip || 1), 1);
        ctx!.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        ctx!.restore();
      }

      raf = requestAnimationFrame(loop);
    }

    if (reduceMotion) {
      // Draw one static frame — sparkle stars only, at a fixed calm opacity — rather than a
      // blank canvas or a fully animated one.
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        ctx.globalAlpha = 0.5;
        const sprite = starSprites[star.colorIdx];
        ctx.drawImage(sprite, star.x - sprite.width / 2, star.y - sprite.height / 2);
      }
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  // .tulip-bg (globals.css) supplies the theme-reactive gradient background plus the fixed/
  // inset-0/negative-z-index/pointer-events-none positioning that keeps this behind and out of
  // the way of every real UI element on the page.
  return <canvas ref={canvasRef} className="tulip-bg" aria-hidden="true" />;
}
