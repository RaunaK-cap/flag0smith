"use client";

import { useEffect, useRef } from "react";

// Full-size animated dot background, drawn on a <canvas>.
// A canvas redraws thousands of dots cheaply, where thousands of animated SVG
// elements made the page lag. The dot colour comes from the CSS `color` of the canvas,
// so it follows the light/dark theme (e.g. className="text-muted-foreground/25").

const GAP = 22; // px between dots
const FPS = 30; // a slow wave doesn't need 60fps
const LEVELS = 8; // opacity steps

export function DotField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = 0;
    let color = getComputedStyle(canvas).color;
    // Re-read the colour when the theme changes (next-themes sets a class on <html>).
    const themeWatcher = new MutationObserver(() => {
      color = getComputedStyle(canvas).color;
      draw(last);
    });
    themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(last);
    }

    function draw(time: number) {
      const t = time / 2500;
      const cols = Math.ceil(canvas.clientWidth / GAP);
      const rows = Math.ceil(canvas.clientHeight / GAP);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.fillStyle = color;

      // Group dots by opacity (rounded to LEVELS steps) so each group is one fill() call.
      const groups: Path2D[] = Array.from({ length: LEVELS + 1 }, () => new Path2D());
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const wave = Math.sin(x / 4 + t) * Math.cos(y / 3 - t * 0.6);
          const noise = ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % 1000;
          const strength = ((wave + 1) / 2) * 0.8 + (noise / 1000) * 0.2;
          if (strength < 0.35) continue;
          const cx = x * GAP + GAP / 2;
          const cy = y * GAP + GAP / 2;
          const r = strength * 2.4;
          const path = groups[Math.round(strength * LEVELS)];
          path.moveTo(cx + r, cy);
          path.arc(cx, cy, r, 0, Math.PI * 2);
        }
      }
      groups.forEach((path, level) => {
        ctx.globalAlpha = level / LEVELS;
        ctx.fill(path);
      });
      ctx.globalAlpha = 1;
    }

    function loop(time: number) {
      frame = requestAnimationFrame(loop);
      if (time - last < 1000 / FPS) return;
      last = time;
      draw(time);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!still) frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeWatcher.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
