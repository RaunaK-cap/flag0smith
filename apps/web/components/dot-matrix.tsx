// A field of dots whose size follows a soft wave. Pure SVG. Same as the landing page.

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
  const gap = 8;
  const dots = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const wave = Math.sin((x + seed * 3) / 4) * Math.cos((y - seed) / 3);
      const noise = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
      const strength = ((wave + 1) / 2) * 0.8 + (noise - Math.floor(noise)) * 0.2;
      if (strength < 0.35) continue;
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={x * gap + 4}
          cy={y * gap + 4}
          r={strength * 1.7}
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
