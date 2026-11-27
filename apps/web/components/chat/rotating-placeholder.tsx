"use client";

import { useEffect, useState, type ReactNode } from "react";

// Cycles through placeholder lines. Every letter fades in one after another,
// stays a while, then fades out the same way before the next line comes in.
// Only CSS opacity/transform animations, so the browser runs them off the main thread.

// A line is a list of parts so one part can have its own colour.
export type PlaceholderLine = { text: string; className?: string }[];

const STAGGER_IN = 14; // ms between letters fading in
const STAGGER_OUT = 6; // ms between letters fading out
const LETTER_MS = 450; // how long one letter takes to fade
const HOLD_MS = 2800; // how long a full line stays

export function RotatingPlaceholder({ lines }: { lines: PlaceholderLine[] }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  const length = lines[index].reduce((sum, part) => sum + part.text.length, 0);

  useEffect(() => {
    if (lines.length < 2) return;
    const delay =
      phase === "in"
        ? length * STAGGER_IN + LETTER_MS + HOLD_MS
        : length * STAGGER_OUT + LETTER_MS;
    const timer = setTimeout(() => {
      if (phase === "in") return setPhase("out");
      setIndex((current) => (current + 1) % lines.length);
      setPhase("in");
    }, delay);
    return () => clearTimeout(timer);
  }, [phase, length, lines.length]);

  // Split into words (so lines only wrap between words), then letters.
  let letter = 0;
  const words: ReactNode[] = [];
  for (const [p, part] of lines[index].entries()) {
    for (const [w, word] of part.text.split(" ").entries()) {
      if (w > 0 || p > 0) words.push(" ");
      words.push(
        <span key={`${p}-${w}`} className={`inline-block whitespace-nowrap ${part.className ?? ""}`}>
          {[...word].map((char, c) => {
            const i = letter++;
            const stagger = phase === "in" ? i * STAGGER_IN : i * STAGGER_OUT;
            return (
              <span
                key={c}
                className={`inline-block ${phase === "in" ? "anim-letter-in" : "anim-letter-out"}`}
                style={{ animationDelay: `${stagger}ms`, animationDuration: `${LETTER_MS}ms` }}
              >
                {char}
              </span>
            );
          })}
        </span>,
      );
      letter++; // the space
    }
  }

  return (
    <span
      aria-hidden
      key={`${index}-${phase}`}
      className="pointer-events-none absolute top-3 right-3.5 left-3.5 block text-[13px] leading-normal text-muted-foreground"
    >
      {words}
    </span>
  );
}
