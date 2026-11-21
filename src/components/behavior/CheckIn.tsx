"use client";

import { useState, useTransition } from "react";
import { clearDay, logDay } from "@/app/actions/behavior";
import { Mark, type MarkShape } from "@/components/behavior/Mark";
import { formatPoints } from "@/lib/behavior";

export interface ChoiceView { key: string; label: string; color: string; stroke: string; points: number; meaning: string }

/** One-tap check-in for a child's day. Shows a confirmation with Undo. */
export function CheckIn({ childId, prompt, choices, shape, max, day, current, compact = false, onDone }: {
  childId: string; prompt?: string; choices: ChoiceView[]; shape: MarkShape; max?: number | null; day?: string; current?: string | null; compact?: boolean; onDone?: (key: string | null) => void;
}) {
  const [picked, setPicked] = useState<string | null>(current ?? null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pick = (key: string) =>
    start(async () => {
      setError(null);
      const prev = picked;
      setPicked(key);
      const r = await logDay(childId, key, day);
      if (r.error) { setPicked(prev); setError(r.error); } else onDone?.(key);
    });

  const chosen = choices.find((c) => c.key === picked);
  return (
    <div className="space-y-2">
      {prompt && <p className="text-[15px] font-semibold">{prompt}</p>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(choices.length, 5)}, minmax(0, 1fr))` }} role="group" aria-label={prompt ?? "Choose"}>
        {choices.map((c) => {
          const on = picked === c.key;
          return (
            <button key={c.key} type="button" disabled={pending} aria-pressed={on} onClick={() => pick(c.key)} title={c.meaning || undefined}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border bg-white transition-all active:scale-95 ${compact ? "py-2" : "py-3"} ${on ? "border-indigo-600 ring-2 ring-indigo-600" : "border-slate-200"}`}>
              <Mark shape={shape} fill={c.color} stroke={c.stroke} count={shape === "dots" ? Number(c.key) : undefined} max={max} size={compact ? 24 : 30} />
              <span className="text-xs font-semibold text-slate-700">{c.label}</span>
              {!compact && <span className={`text-[11px] font-medium ${c.points < 0 ? "text-rose-600" : "text-slate-500"}`}>{formatPoints(c.points)}</span>}
            </button>
          );
        })}
      </div>
      {chosen && !pending && (
        <p role="status" className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span>Saved · {chosen.label}{chosen.points ? ` · ${formatPoints(chosen.points)} points` : ""}</span>
          <button type="button" className="font-semibold" onClick={() => start(async () => { await clearDay(childId, day ?? ""); setPicked(null); onDone?.(null); })} hidden={!day}>Undo</button>
        </p>
      )}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
