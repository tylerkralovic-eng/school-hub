"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { approveSenders, discoverSenders } from "@/app/actions/connections";
import { buttonClass } from "@/components/ui";
import type { SenderSuggestion } from "@/lib/integrations/discover";
import { platformName } from "@/lib/platforms";

/** One tap: find school senders in the parent's inbox, approve with checkboxes. */
export function SenderDiscovery({ hasRules }: { hasRules: boolean }) {
  const [list, setList] = useState<SenderSuggestion[] | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [scanned, setScanned] = useState(0);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  const find = () => start(async () => {
    setMsg(null);
    const r = await discoverSenders();
    if (r.error) return setMsg({ text: r.error, error: true });
    setList(r.suggestions!);
    setScanned(r.scanned ?? 0);
    setOn(Object.fromEntries(r.suggestions!.map((s) => [s.pattern, s.confidence === "high"])));
  });

  const save = () => start(async () => {
    const picks = list!.filter((s) => on[s.pattern]).map((s) => ({ pattern: s.pattern, platform_key: s.platform_key, child_name: s.child_name }));
    const r = await approveSenders(picks);
    if (r.error) return setMsg({ text: r.error, error: true });
    setList(null);
    setMsg({ text: `Watching ${r.added} ${r.added === 1 ? "sender" : "senders"}. ${r.found ? `Found ${r.found} recent school ${r.found === 1 ? "email" : "emails"} — they're ready for review.` : "New school emails will show up for review."}` });
  });

  const count = list ? list.filter((s) => on[s.pattern]).length : 0;

  if (!list)
    return (
      <div className="space-y-2">
        {msg && <p role={msg.error ? "alert" : "status"} className={`rounded-xl px-3 py-2 text-sm ${msg.error ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{msg.text} {!msg.error && <Link href="/add#recent" className="font-semibold underline">See them</Link>}</p>}
        <button type="button" disabled={pending} onClick={find} className={`${hasRules ? buttonClass.secondary : buttonClass.primary} w-full`}>
          {pending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Looking through the last 60 days…</> : hasRules ? "Find more school senders" : "Find my school senders"}
        </button>
        <p className="text-xs text-slate-500">Looks only at who emailed you and subject lines — not the messages themselves. Nothing is saved except the senders you approve.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-slate-700">{list.length ? <>Checked {scanned} recent emails. These look like school — <b>uncheck anything that isn&apos;t</b>:</> : `Checked ${scanned} recent emails and didn't spot new school senders. You can add one by hand under Advanced settings.`}</p>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {list.map((s) => (
          <li key={s.pattern}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
              <input type="checkbox" checked={!!on[s.pattern]} onChange={(e) => setOn({ ...on, [s.pattern]: e.target.checked })} className="mt-1 h-5 w-5 accent-indigo-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-slate-900">{s.platform_key ? platformName(s.platform_key) : s.name || s.address}{s.child_name ? <span className="font-normal text-slate-500"> · {s.child_name}</span> : null}</span>
                <span className="block truncate text-xs text-slate-500">{s.pattern} · {s.count} {s.count === 1 ? "email" : "emails"} · {s.reason}</span>
                {s.subjects[0] && <span className="block truncate text-xs italic text-slate-500">“{s.subjects[0]}”</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {msg && <p role="alert" className="text-sm text-rose-700">{msg.text}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setList(null)} className={buttonClass.secondary}>Cancel</button>
        <button type="button" disabled={pending || !count} onClick={save} className={`${buttonClass.primary} flex-1`}>{pending ? "Saving and checking email…" : `Watch ${count} ${count === 1 ? "sender" : "senders"}`}</button>
      </div>
    </div>
  );
}
