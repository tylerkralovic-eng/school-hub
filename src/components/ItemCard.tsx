"use client";

import { useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Icon } from "@/components/Icon";
import { ChildChip, KindIcon, StatusDot, statusMeta } from "@/components/ui";
import { formatAgo, formatDue, formatEventWhen, formatReceived } from "@/lib/format";
import { childrenForItem, latestReceivedAt, schoolById, sourceById } from "@/lib/selectors";
import type { SchoolItem } from "@/lib/types";

export function TaskCheckbox({ item }: { item: SchoolItem }) {
  const { isDone, toggleDone } = useFamily();
  const done = isDone(item.id);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Mark "${item.title}" as not done` : `Mark "${item.title}" as done`}
      onClick={() => toggleDone(item.id)}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90 ${
        done
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-slate-300 bg-white text-transparent hover:border-emerald-400 hover:text-emerald-300"
      }`}
    >
      <Icon name="check" className="h-4 w-4" strokeWidth={3} />
    </button>
  );
}

export function WhenLine({ item }: { item: SchoolItem }) {
  const { now, isDone } = useFamily();
  const parts: React.ReactNode[] = [];

  if (item.kind === "task" && item.dueAt) {
    const due = formatDue(item.dueAt, now);
    const urgent = due.urgent && !isDone(item.id);
    parts.push(
      <span
        key="due"
        className={`inline-flex items-center gap-1 font-medium ${urgent ? "text-rose-600" : "text-slate-600"}`}
      >
        <Icon name="clock" className="h-3.5 w-3.5" />
        {isDone(item.id) ? "Done" : due.label}
      </span>,
    );
  }
  if (item.eventAt) {
    parts.push(
      <span key="when" className="inline-flex items-center gap-1 font-medium text-slate-600">
        <Icon name="calendar" className="h-3.5 w-3.5" />
        {formatEventWhen(item, now)}
      </span>,
    );
  }
  if (item.location) {
    parts.push(
      <span key="loc" className="inline-flex items-center gap-1 text-slate-500">
        <Icon name="pin" className="h-3.5 w-3.5" />
        {item.location}
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">{parts}</div>;
}

export function ItemCard({ item, compact = false }: { item: SchoolItem; compact?: boolean }) {
  const { snapshot, now, isDone } = useFamily();
  const [open, setOpen] = useState(false);
  const kids = childrenForItem(snapshot, item);
  const school = schoolById(snapshot, item.schoolId);
  const primary = item.sources[0];
  const primarySource = primary ? sourceById(snapshot, primary.sourceId) : undefined;
  const staleSource = item.sources
    .map((s) => sourceById(snapshot, s.sourceId))
    .find((s) => s?.status === "stale");
  const done = item.kind === "task" && isDone(item.id);
  const evidenceId = `evidence-${item.id}`;

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-opacity ${
        item.reviewStatus === "needs_review" ? "border-amber-300" : "border-slate-200/80"
      } ${done ? "opacity-60" : ""}`}
    >
      <div className="flex gap-3">
        <KindIcon kind={item.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <h3
              className={`flex-1 text-[15px] font-semibold leading-snug text-slate-900 ${done ? "line-through decoration-slate-400" : ""}`}
            >
              {item.title}
            </h3>
            {item.kind === "task" && <TaskCheckbox item={item} />}
          </div>
          {!compact && <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.summary}</p>}
          <WhenLine item={item} />

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {kids.map((c) => (
              <ChildChip key={c.id} child={c} />
            ))}
            {school && <span>{item.childId ? school.shortName : `${school.shortName} · school-wide`}</span>}
          </div>

          {item.reviewStatus === "needs_review" && (
            <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">Unconfirmed.</span> {item.reviewNote}
              </span>
            </div>
          )}
          {staleSource && (
            <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                From a source last checked {formatAgo(staleSource.lastSyncedAt, now)}. Details may have changed.
              </span>
            </div>
          )}

          {/* Source line: every update shows where it came from and when. */}
          <div className="mt-3 border-t border-slate-100 pt-2.5">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={evidenceId}
              className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg px-1 py-0.5 text-left text-xs text-slate-500 hover:bg-slate-50"
            >
              {primarySource && <StatusDot status={primarySource.status} />}
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-slate-600">{primarySource?.name ?? "Unknown source"}</span>
                {" · "}
                {formatReceived(latestReceivedAt(item), now)}
                {item.sources.length > 1 && ` · ${item.sources.length} sources`}
              </span>
              <span className="shrink-0 font-medium text-indigo-600">{open ? "Hide" : "Source"}</span>
              <Icon
                name="chevronDown"
                className={`h-3.5 w-3.5 shrink-0 text-indigo-600 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <div id={evidenceId} className="mt-2 space-y-2">
                {item.sources.length > 1 && (
                  <p className="text-xs text-slate-500">
                    Merged from {item.sources.length} sources that described the same update.
                  </p>
                )}
                {item.sources.map((ref, i) => {
                  const src = sourceById(snapshot, ref.sourceId);
                  return (
                    <figure key={i} className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <blockquote className="text-[13px] italic leading-relaxed text-slate-700">
                        “{ref.excerpt}”
                      </blockquote>
                      <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                        {src && <StatusDot status={src.status} />}
                        <span className="font-medium">{src?.name}</span>
                        {ref.from && <span>· {ref.from}</span>}
                        <span>
                          · Received{" "}
                          {new Date(ref.receivedAt).toLocaleString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        {src && src.status !== "connected" && (
                          <span className={statusMeta[src.status].text}>· {statusMeta[src.status].label}</span>
                        )}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
