"use client";

import { useState } from "react";
import { CheckIn, type ChoiceView } from "@/components/behavior/CheckIn";
import { Mark, type MarkShape } from "@/components/behavior/Mark";

/** Month grid of school days. Tap a day to set or change it — for filling in history. */
export function DayEditor({ childId, childName, days, values, choices, shape, max, today }: {
  childId: string; childName: string; days: string[]; values: Record<string, string>; choices: ChoiceView[]; shape: MarkShape; max: number | null; today: string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [vals, setVals] = useState(values);
  const first = days[0];
  const lead = first ? (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7 : 0; // Mon = 0
  const label = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-semibold uppercase text-slate-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: Math.min(lead, 4) }, (_, i) => <div key={`pad${i}`} />)}
        {days.map((d) => {
          const v = vals[d];
          const c = choices.find((x) => x.key === v);
          return (
            <button key={d} type="button" onClick={() => setSel(sel === d ? null : d)} aria-pressed={sel === d} aria-label={`${label(d)}: ${c ? c.label : "not logged"}`}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 ${sel === d ? "bg-indigo-100 ring-2 ring-indigo-600" : d === today ? "bg-indigo-50" : "bg-slate-50 hover:bg-slate-100"}`}>
              <span className="text-[11px] text-slate-500">{Number(d.slice(8))}</span>
              <Mark shape={shape} fill={c?.color} stroke={c?.stroke} count={shape === "dots" ? (v != null ? Number(v) : null) : undefined} max={max} size={20} />
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="rounded-2xl bg-slate-50 p-3">
          <CheckIn key={sel} childId={childId} day={sel} prompt={`${childName} · ${label(sel)}`} choices={choices} shape={shape} max={max} current={vals[sel] ?? null} compact
            onDone={(k) => setVals((v) => { const next = { ...v }; if (k == null) delete next[sel]; else next[sel] = k; return next; })} />
          <p className="mt-2 text-xs text-slate-500">Tap another day to keep filling in. Changes save instantly.</p>
        </div>
      )}
    </div>
  );
}
