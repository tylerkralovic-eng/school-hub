"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveTracking, understandTracking } from "@/app/actions/behavior";
import { Mark } from "@/components/behavior/Mark";
import { MicIcon } from "@/components/onboarding/MicIcon";
import { Typewriter } from "@/components/onboarding/Typewriter";
import { useVoice } from "@/components/onboarding/useVoice";
import { buttonClass, inputClass } from "@/components/ui";
import type { ParsedSystem } from "@/lib/behavior-ai";

const light = (hex: string) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 200; };

export function TrackingSetup({ kidNames }: { kidNames: string[] }) {
  const router = useRouter();
  const voice = useVoice();
  const [text, setText] = useState("");
  const [systems, setSystems] = useState<ParsedSystem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const names = kidNames.length > 1 ? `${kidNames.slice(0, -1).join(", ")} and ${kidNames.at(-1)}` : kidNames[0];
  const question = `How do ${names}'s ${kidNames.length > 1 ? "schools" : "school"} track how the day went? Tell me like you'd tell a friend — colors, stars, Skittles, what's best and worst. Pick-up times help too.`;

  const understand = () => start(async () => {
    setError(null);
    const r = await understandTracking(text);
    if (r.error) setError(r.error); else setSystems(r.systems!);
  });

  const save = () => start(async () => {
    const r = await saveTracking(systems!.map((s) => ({ child_id: s.child_id, name: s.name, kind: s.kind, levels: s.levels, count_max: s.count_max, count_unit: s.count_unit, check_in_time: s.check_in_time })), text);
    if (r.error) setError(r.error); else router.push("/points?setup=done");
  });

  const update = (i: number, patch: Partial<ParsedSystem>) => setSystems((ss) => ss!.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-4">
      <div className="max-w-[92%] rounded-3xl rounded-tl-lg bg-white px-4 py-3 text-[17px] leading-relaxed shadow-sm">
        <Typewriter text={question} />
      </div>

      {!systems ? (
        <div className="space-y-3">
          <div className="relative">
            <label htmlFor="desc" className="sr-only">How the schools track behavior</label>
            <textarea id="desc" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={`e.g. “${kidNames[0] ?? "Everley"}'s school gives a star each day: white is normal, yellow means talked to a few times, red is bad, purple is a superb day. Pick-up at 2:30.”`} className={`${inputClass} pb-16 leading-relaxed`} />
            {voice.canListen && (
              <button type="button" onClick={() => { const before = text ? text.trimEnd() + " " : ""; voice.listen((t) => setText(before + t)); }} aria-label={voice.listening ? "Stop listening" : "Say it"} className={`absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full text-white ${voice.listening ? "animate-pulse bg-rose-500" : "bg-indigo-600"}`}>
                <MicIcon />
              </button>
            )}
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button type="button" disabled={pending || text.trim().length < 10} onClick={understand} className={`${buttonClass.primary} w-full !py-3.5 text-base`}>
            {pending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Understanding…</> : "Set it up"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-w-[92%] rounded-3xl rounded-tl-lg bg-white px-4 py-3 text-[17px] leading-relaxed shadow-sm">Got it. Here&apos;s how I&apos;ll track {systems.length > 1 ? "them" : "it"} — change anything that&apos;s off.</div>
          {systems.map((s, i) => (
            <section key={s.child_id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[16px] font-semibold">{s.child_name} · {s.name}</h2>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">Ask at
                  <input type="time" value={s.check_in_time ?? "15:00"} onChange={(e) => update(i, { check_in_time: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" aria-label={`Check-in time for ${s.child_name}`} />
                </label>
              </div>
              {s.kind === "levels" ? (
                <ul className="divide-y divide-slate-100">
                  {s.levels.map((l, j) => (
                    <li key={l.key} className="flex items-center gap-3 py-2">
                      <Mark shape={/star/i.test(s.name) ? "star" : "token"} fill={l.color} stroke={light(l.color) ? "#94a3b8" : l.color} size={26} />
                      <span className="min-w-0 flex-1 text-[15px]"><b>{l.label}</b>{l.meaning ? <span className="text-slate-500"> · {l.meaning}</span> : null}</span>
                      <label className="flex items-center gap-1 text-sm text-slate-600">
                        <input type="number" min={0} max={10} value={l.points} onChange={(e) => update(i, { levels: s.levels.map((x, k) => (k === j ? { ...x, points: Math.max(0, Math.min(10, Number(e.target.value) || 0)) } : x)) })} className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-right" aria-label={`Points for ${l.label}`} />pts
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-3 text-[15px]">
                  <Mark shape="dots" fill="#0f766e" count={s.count_max} max={s.count_max} size={28} />
                  <span>Counts {s.count_unit ?? "points"} kept, 0–{s.count_max}. <b>{s.count_max} is best.</b> Points = {s.count_unit ?? "count"} kept.</span>
                </div>
              )}
            </section>
          ))}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setSystems(null)} className={buttonClass.secondary}>Change</button>
            <button type="button" disabled={pending} onClick={save} className={`${buttonClass.primary} flex-1 !py-3.5 text-base`}>{pending ? "Saving…" : "Looks right — start tracking"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
