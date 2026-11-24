"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shows the meeting slides as a scrollable list; "Present" goes full screen one
 * slide at a time (arrows, space, tap or swipe); "Save PDF" uses the browser's
 * print dialog with one slide per landscape page.
 */
export function DeckViewer({ slides, titles, title, settingsHref }: { slides: React.ReactNode[]; titles: string[]; title: string; settingsHref: string }) {
  const [present, setPresent] = useState<number | null>(null);
  const touch = useRef<number | null>(null);
  const n = slides.length;

  const go = useCallback((d: number) => setPresent((i) => (i === null ? i : Math.max(0, Math.min(n - 1, i + d)))), [n]);
  const close = useCallback(() => {
    setPresent(null);
    if (typeof document !== "undefined" && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (present === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Escape") close();
    };
    const onFs = () => { if (!document.fullscreenElement) setPresent(null); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  }, [present, go, close]);

  const start = (i = 0) => {
    setPresent(i);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <>
      <div className="no-print sticky top-0 z-30 border-b border-slate-200 bg-[#f4f3ef]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Link href="/points" className="rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/60">← Back</Link>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h1>
          <Link href={settingsHref} className="hidden rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/60 sm:inline">Settings</Link>
          <button type="button" onClick={() => window.print()} className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800">Save PDF</button>
          <button type="button" onClick={() => start(0)} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Present</button>
        </div>
      </div>

      <div className="deck-list mx-auto max-w-5xl space-y-5 px-4 py-5">
        {slides.map((s, i) => (
          <div key={i} className="group relative">
            <p className="no-print mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{i + 1} · {titles[i]}</p>
            <button type="button" onClick={() => start(i)} className="block w-full text-left" aria-label={`Present from slide ${i + 1}: ${titles[i]}`}>
              {s}
            </button>
          </div>
        ))}
      </div>

      {present !== null && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950"
          role="dialog"
          aria-modal="true"
          aria-label={`Slide ${present + 1} of ${n}: ${titles[present]}`}
          onClick={(e) => go(e.clientX > window.innerWidth / 3 ? 1 : -1)}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) > 40) { e.preventDefault(); go(dx < 0 ? 1 : -1); }
          }}
        >
          <div className="w-[min(100vw,177.78dvh)]">{slides[present]}</div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] text-sm text-white/70">
            <button type="button" onClick={(e) => { e.stopPropagation(); close(); }} className="rounded-full bg-white/10 px-3 py-1.5 font-medium text-white">Done</button>
            <span>{present + 1} / {n}</span>
          </div>
        </div>
      )}
    </>
  );
}
