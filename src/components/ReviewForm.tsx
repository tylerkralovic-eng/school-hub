"use client";

import { useActionState, useMemo, useState } from "react";
import { approveReview } from "@/app/actions/ingest";
import { Icon } from "@/components/Icon";
import { FormError, SubmitButton } from "@/components/forms";
import { inputClass } from "@/components/ui";
import { SECTION_INFO, SECTION_ORDER, type Section } from "@/lib/review-model";

export interface ReviewCandidate {
  id: string;
  kind: "event" | "task" | "announcement";
  category: string;
  categoryLabel: string;
  title: string;
  details: string | null;
  who: string;
  date: string | null;
  time: string | null;
  endDate: string | null;
  endTime: string | null;
  location: string | null;
  amount: string | null;
  evidence: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  duplicateTitle: string | null;
  section: Section;
  flag: string | null;
  sourceLabel: string;
  members: { id: string; label: string }[];
}

const KINDS = [
  { v: "event", l: "Event" },
  { v: "task", l: "To do" },
  { v: "announcement", l: "Notice" },
] as const;

function prettyDate(d: string | null, t: string | null) {
  if (!d) return "No date";
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  const s = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (!t) return s;
  const [hh, mm] = t.split(":").map(Number);
  return `${s} · ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}

export function ReviewForm({ batchId, candidates, whoOptions }: { batchId: string; candidates: ReviewCandidate[]; whoOptions: { value: string; label: string }[] }) {
  const [state, action] = useActionState(approveReview, undefined);
  const [include, setInclude] = useState<Record<string, boolean>>(() => Object.fromEntries(candidates.map((c) => [c.id, SECTION_INFO[c.section].defaultOn])));
  const [showPast, setShowPast] = useState(false);
  const [kinds, setKinds] = useState<Record<string, string>>(() => Object.fromEntries(candidates.map((c) => [c.id, c.kind])));
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(candidates.map((c) => [c.id, c.needsReview])));
  const count = useMemo(() => Object.values(include).filter(Boolean).length, [include]);
  const flagged = candidates.filter((c) => c.needsReview).length;
  const extraSources = candidates.reduce((n, c) => n + c.members.length, 0);
  const whoLabel = (v: string) => whoOptions.find((o) => o.value === v)?.label ?? "Whole family";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="batch" value={batchId} />
      <div className="flex items-center justify-between px-1 text-sm">
        <span className="text-slate-600">
          {candidates.length} found{extraSources ? ` · ${extraSources} duplicate${extraSources === 1 ? "" : "s"} combined` : ""}{flagged ? <> · <span className="font-semibold text-amber-700">{flagged} need a look</span></> : null}
        </span>
        <span className="flex gap-3">
          <button type="button" className="font-medium text-indigo-600" onClick={() => setInclude(Object.fromEntries(candidates.map((c) => [c.id, true])))}>All</button>
          <button type="button" className="font-medium text-indigo-600" onClick={() => setInclude(Object.fromEntries(candidates.map((c) => [c.id, false])))}>None</button>
        </span>
      </div>

      {SECTION_ORDER.filter((sec) => candidates.some((c) => c.section === sec)).map((sec) => {
        const list = candidates.filter((c) => c.section === sec);
        const hidden = sec === "past" && !showPast;
        const allOn = list.every((x) => include[x.id]);
        return (
          <section key={sec} className="space-y-2" aria-label={SECTION_INFO[sec].title}>
            <div className="flex items-end justify-between px-1 pt-2">
              <div>
                <h2 className={`text-[13px] font-semibold uppercase tracking-wider ${sec === "attention" ? "text-rose-600" : "text-slate-500"}`}>{SECTION_INFO[sec].title} · {list.length}</h2>
                <p className="text-xs text-slate-500">{SECTION_INFO[sec].hint}</p>
              </div>
              {sec === "past" ? (
                <button type="button" className="text-sm font-medium text-indigo-600" onClick={() => setShowPast(!showPast)}>{showPast ? "Hide" : "Show"}</button>
              ) : (
                <button type="button" className="text-sm font-medium text-indigo-600" onClick={() => setInclude({ ...include, ...Object.fromEntries(list.map((c) => [c.id, !allOn])) })}>{allOn ? "None" : "All"}</button>
              )}
            </div>
            {list.map((c) => {
        const on = include[c.id];
        const isOpen = open[c.id];
        const kind = kinds[c.id];
        return (
          <div key={c.id} data-testid="candidate" hidden={hidden} className={`rounded-2xl border bg-white p-3.5 shadow-sm transition-opacity ${c.needsReview ? "border-amber-300" : "border-slate-200"} ${on ? "" : "opacity-55"}`}>
            <input type="hidden" name="candidate" value={c.id} />
            {c.members.map((m) => <input key={m.id} type="hidden" name="member" value={`${m.id}:${c.id}`} />)}
            <div className="flex items-start gap-3">
              <label className="mt-0.5 flex cursor-pointer items-center">
                <input type="checkbox" name={`include.${c.id}`} checked={on} onChange={(e) => setInclude({ ...include, [c.id]: e.target.checked })} className="h-6 w-6 rounded-md border-slate-300 accent-indigo-600" aria-label={`Include "${c.title}"`} />
              </label>
              <button type="button" onClick={() => setOpen({ ...open, [c.id]: !isOpen })} className="min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                <p className="text-[15px] font-semibold leading-snug">{c.title}</p>
                <p className="mt-0.5 text-[13px] text-slate-600">
                  <span className={kind === "task" ? "text-rose-600" : kind === "event" ? "text-sky-700" : "text-amber-700"}>{KINDS.find((k) => k.v === kind)?.l}</span>
                  {" · "}{kind === "task" && c.date ? `Due ${prettyDate(c.date, c.time)}` : kind !== "announcement" || c.date ? prettyDate(c.date, c.time) : ""}
                  {" · "}{whoLabel(c.who)}
                  {c.amount ? ` · $${c.amount}` : ""}
                </p>
                {c.flag && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${/past due/i.test(c.flag) ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{c.flag}</span>}
                <p className="mt-1 truncate text-[11px] text-slate-500">{c.members.length ? `Found in ${c.members.length + 1} places: ${[c.sourceLabel, ...c.members.map((m) => m.label)].join(" · ")}` : c.sourceLabel}</p>
              </button>
              <button type="button" onClick={() => setOpen({ ...open, [c.id]: !isOpen })} className="p-1 text-slate-400" aria-label={isOpen ? "Collapse" : "Edit"}>
                <Icon name={isOpen ? "chevronDown" : "edit"} className="h-4 w-4" />
              </button>
            </div>

            {c.needsReview && c.reviewReason && (
              <p className="mt-2 flex gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[13px] text-amber-900">
                <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{c.reviewReason}
              </p>
            )}
            {c.duplicateTitle && (
              <label className="mt-2 flex items-start gap-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[13px] text-sky-950">
                <input type="checkbox" name={`merge.${c.id}`} defaultChecked className="mt-0.5 h-4 w-4 accent-sky-600" />
                <span>Looks like <b>{c.duplicateTitle}</b>, already in School Hub. Keep checked to link this as another source instead of adding a duplicate.</span>
              </label>
            )}

            <div className={isOpen ? "mt-3 space-y-3 border-t border-slate-100 pt-3" : "hidden"}>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Type">
                {KINDS.map((k) => (
                  <label key={k.v} className={`cursor-pointer rounded-md py-1 text-center text-sm font-medium ${kind === k.v ? "bg-white shadow-sm" : "text-slate-600"}`}>
                    <input type="radio" name={`kind.${c.id}`} value={k.v} checked={kind === k.v} onChange={() => setKinds({ ...kinds, [c.id]: k.v })} className="sr-only" />
                    {k.l}
                  </label>
                ))}
              </div>
              <label className="block text-xs font-medium text-slate-600">Title
                <input name={`title.${c.id}`} defaultValue={c.title} className={`${inputClass} mt-1`} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-slate-600">{kind === "task" ? "Due date" : "Date"}
                  <input type="date" name={`date.${c.id}`} defaultValue={c.date ?? ""} className={`${inputClass} mt-1`} />
                </label>
                <label className="block text-xs font-medium text-slate-600">Time <span className="font-normal text-slate-400">(optional)</span>
                  <input type="time" name={`time.${c.id}`} defaultValue={c.time ?? ""} className={`${inputClass} mt-1`} />
                </label>
              </div>
              {kind === "event" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-slate-600">Ends <span className="font-normal text-slate-400">(date)</span>
                    <input type="date" name={`endDate.${c.id}`} defaultValue={c.endDate ?? ""} className={`${inputClass} mt-1`} />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">End time
                    <input type="time" name={`endTime.${c.id}`} defaultValue={c.endTime ?? ""} className={`${inputClass} mt-1`} />
                  </label>
                </div>
              )}
              <label className="block text-xs font-medium text-slate-600">For
                <select name={`who.${c.id}`} defaultValue={c.who} className={`${inputClass} mt-1`}>
                  <option value="">Whole family</option>
                  {whoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">Location
                <input name={`location.${c.id}`} defaultValue={c.location ?? ""} className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-xs font-medium text-slate-600">Details
                <textarea name={`details.${c.id}`} defaultValue={c.details ?? ""} rows={3} className={`${inputClass} mt-1`} />
              </label>
              {c.evidence && <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs italic text-slate-600">Source: “{c.evidence}”</p>}
            </div>
          </div>
        );
      })}
          </section>
        );
      })}

      <div className="sticky bottom-24 z-10 space-y-2 pt-2 md:bottom-4">
        <FormError message={state?.error} />
        <SubmitButton className="w-full shadow-lg" pendingText="Saving…">
          {count ? `Add ${count} ${count === 1 ? "item" : "items"}` : "Skip all"}
        </SubmitButton>
      </div>
    </form>
  );
}
