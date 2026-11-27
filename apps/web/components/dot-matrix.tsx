"use client";

import { useEffect, useState } from "react";

// A field of dots whose size follows a soft wave. Pure SVG.
// Drawn only in the browser: Math.sin() gives slightly different decimals on the server and in the
// browser, which made React's hydration complain. It's decoration, so skipping it on the server is fine.

export function DotMatrix({
  cols = 32,
  rows = 12,
  seed = 1,
  animated = false,
  className = "",
}: {
  cols?: number;
  rows?: number;
  seed?: number;
  animated?: boolean;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const gap = 8;
  const dots = [];

  for (let y = 0; mounted && y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const wave = Math.sin((x + seed * 3) / 4) * Math.cos((y - seed) / 3);
      const noise = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
      const strength = round(((wave + 1) / 2) * 0.8 + ((noise % 1000) / 1000) * 0.2);
      if (strength < 0.35) continue;
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={x * gap + 4}
          cy={y * gap + 4}
          r={round(strength * 1.7)}
          fill="currentColor"
          opacity={strength}
          className={animated ? "anim-twinkle" : undefined}
          style={animated ? { animationDelay: `${((x + y) % 12) * 0.25}s` } : undefined}
        />,
      );
    }
  }

  return (
    <svg aria-hidden viewBox={`0 0 ${cols * gap} ${rows * gap}`} className={className}>
      {dots}
    </svg>
  );
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
