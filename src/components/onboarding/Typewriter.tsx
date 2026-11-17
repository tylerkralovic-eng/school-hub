"use client";
import { useEffect, useState } from "react";

/** Reveals text like it's being written. Instant when the user prefers reduced motion. */
export function Typewriter({ text, onDone, speed = 16 }: { text: string; onDone?: () => void; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(text.length); onDone?.(); return; }
    setN(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1 + (text[i] === " " ? 1 : 0);
      setN(i);
      if (i >= text.length) { clearInterval(t); onDone?.(); }
    }, speed);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <span>
      <span aria-hidden="true">{text.slice(0, n)}</span>
      {n < text.length && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-indigo-500" aria-hidden="true" />}
      <span className="sr-only">{text}</span>
    </span>
  );
}
