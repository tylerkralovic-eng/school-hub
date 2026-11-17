"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerGap, dismissGap } from "@/app/actions/gaps";
import { Icon } from "@/components/Icon";
import { Typewriter } from "@/components/onboarding/Typewriter";
import { buttonClass, inputClass } from "@/components/ui";
import type { Gap } from "@/lib/server/gaps";

/** One conversational question at a time, to fill gaps in what School Hub knows. */
export function QuickQuestion({ gap }: { gap: Gap }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [reply, setReply] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  const send = (v: string) =>
    start(async () => {
      const r = await answerGap(gap.id, v);
      setReply({ text: r.reply, error: r.error });
      if (!r.error) setTimeout(() => { setReply(null); setValue(""); setPicked([]); router.refresh(); }, r.reply.includes("Link:") ? 15000 : 2600);
    });

  return (
    <section aria-label="Quick question" className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white"><Icon name="sparkle" className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Quick question</p>
          <p className="mt-0.5 text-[16px] leading-relaxed text-slate-900"><Typewriter key={gap.id} text={gap.text} /></p>
        </div>
        <button type="button" onClick={() => start(() => dismissGap(gap.id))} aria-label="Not now" className="p-1 text-slate-400"><Icon name="x" className="h-4 w-4" /></button>
      </div>

      {reply ? (
        <p role="status" className={`mt-3 break-words rounded-2xl px-3 py-2 text-[15px] ${reply.error ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{reply.text}</p>
      ) : pending && gap.kind === "action" ? (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-indigo-700"><span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />Searching official school websites… this can take a minute.</p>
      ) : (
        <div className="mt-3">
          {gap.kind === "text" && (
            <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) send(value); }} className="flex gap-2">
              <label htmlFor={`gap-${gap.id}`} className="sr-only">Your answer</label>
              <input id={`gap-${gap.id}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder={gap.placeholder} className={`${inputClass} !rounded-full`} />
              <button type="submit" disabled={pending || !value.trim()} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white disabled:bg-slate-300">
                {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon name="chevronRight" className="h-5 w-5" strokeWidth={2.5} />}
              </button>
            </form>
          )}
          {gap.kind === "multi" && (
            <div className="flex flex-wrap items-center gap-2">
              {gap.options!.map((o) => {
                const on = picked.includes(o.value);
                return <button key={o.value} type="button" aria-pressed={on} onClick={() => setPicked(on ? picked.filter((x) => x !== o.value) : [...picked, o.value])} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white"}`}>{on ? "✓ " : ""}{o.label}</button>;
              })}
              <button type="button" disabled={!picked.length || pending} onClick={() => send(picked.join("|"))} className={`${buttonClass.primary} !px-3.5 !py-1.5 text-sm`}>Save</button>
            </div>
          )}
          {gap.kind === "action" && <button type="button" disabled={pending} onClick={() => send("yes")} className={`${buttonClass.primary} !py-2 text-sm`}>{gap.cta}</button>}
          {gap.kind === "link" && gap.href && (gap.href.startsWith("/api/") ? <a href={gap.href} className={`${buttonClass.primary} !py-2 text-sm`}>{gap.cta}</a> : <Link href={gap.href} className={`${buttonClass.primary} !py-2 text-sm`}>{gap.cta}</Link>)}
        </div>
      )}
    </section>
  );
}
