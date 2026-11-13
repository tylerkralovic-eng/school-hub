"use client";

import { useFamily } from "@/components/FamilyProvider";
import { Icon } from "@/components/Icon";
import { Card, ChildChip, EmptyState, childColors } from "@/components/ui";
import { formatEventWhen, formatTime } from "@/lib/format";
import {
  buildAgenda,
  childrenForItem,
  dayKey,
  filterItemsByChild,
  sourceById,
  startOfDay,
  type AgendaEntry,
} from "@/lib/selectors";

const DAYS_AHEAD = 30;
const STRIP_DAYS = 14;

export default function CalendarPage() {
  const { snapshot, filter, now, isDone } = useFamily();
  const items = filterItemsByChild(snapshot, filter);
  const agenda = buildAgenda(items, now, DAYS_AHEAD);

  const byDay = new Map<string, AgendaEntry[]>();
  for (const e of agenda) {
    const k = dayKey(e.at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }

  const strip = Array.from({ length: STRIP_DAYS }, (_, i) => {
    const d = startOfDay(now);
    d.setDate(d.getDate() + i);
    return d;
  });

  const jumpTo = (k: string) => {
    document.getElementById(`day-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-baseline justify-between px-1 pt-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <span className="text-sm text-slate-500">Next {DAYS_AHEAD} days</span>
      </div>

      {/* Two-week strip */}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
        {strip.map((d, i) => {
          const k = dayKey(d);
          const entries = byDay.get(k) ?? [];
          const kids = [...new Set(entries.flatMap((e) => childrenForItem(snapshot, e.item)))];
          return (
            <button
              key={k}
              type="button"
              disabled={entries.length === 0}
              onClick={() => jumpTo(k)}
              aria-label={`${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}: ${entries.length} items`}
              className={`flex w-12 shrink-0 flex-col items-center rounded-2xl py-2 transition-colors ${
                i === 0 ? "bg-slate-900 text-white" : "bg-white text-slate-800 enabled:hover:bg-slate-50"
              } ${entries.length === 0 && i !== 0 ? "opacity-50" : ""}`}
            >
              <span className={`text-[10px] font-semibold uppercase ${i === 0 ? "text-slate-300" : "text-slate-400"}`}>
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className="text-lg font-semibold">{d.getDate()}</span>
              <span className="flex h-1.5 gap-0.5">
                {kids.map((c) => (
                  <span key={c.id} className={`h-1.5 w-1.5 rounded-full ${childColors[c.color].dot}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 px-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Event
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Deadline
        </span>
      </div>

      {byDay.size === 0 ? (
        <EmptyState title="Nothing scheduled" body="No events or deadlines from connected sources." />
      ) : (
        [...byDay.entries()].map(([k, entries]) => (
          <section key={k} id={`day-${k}`} className="scroll-mt-28 space-y-2">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
              {dayLabel(entries[0].at, now)}
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                {entries[0].at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </h2>
            <Card className="divide-y divide-slate-100">
              {entries.map((e) => {
                const done = e.type === "deadline" && isDone(e.item.id);
                const src = sourceById(snapshot, e.item.sources[0]?.sourceId ?? "");
                return (
                  <div key={e.key} className={`flex gap-3 px-4 py-3 ${done ? "opacity-50" : ""}`}>
                    <div className="w-16 shrink-0 pt-0.5 text-right">
                      <div className="text-sm font-semibold text-slate-800">
                        {e.item.allDay ? "All day" : formatTime(e.at)}
                      </div>
                      <div
                        className={`mt-0.5 text-[11px] font-semibold uppercase ${
                          e.type === "deadline" ? "text-rose-600" : "text-sky-600"
                        }`}
                      >
                        {e.type === "deadline" ? (done ? "Done" : "Due") : "Event"}
                      </div>
                    </div>
                    <div
                      className={`w-1 shrink-0 rounded-full ${e.type === "deadline" ? "bg-rose-500" : "bg-sky-500"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[15px] font-semibold leading-snug ${done ? "line-through" : ""}`}>
                        {e.item.title}
                      </p>
                      {e.item.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-[13px] text-slate-500">
                          <Icon name="pin" className="h-3.5 w-3.5" /> {e.item.location}
                        </p>
                      )}
                      {e.item.allDay && e.item.eventEndAt && (
                        <p className="mt-0.5 text-[13px] text-slate-500">{formatEventWhen(e.item, now)}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {childrenForItem(snapshot, e.item).map((c) => (
                          <ChildChip key={c.id} child={c} />
                        ))}
                        {src && (
                          <span className={src.status === "stale" ? "font-medium text-amber-700" : ""}>
                            via {src.name}
                            {src.status === "stale" && " · may be out of date"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

function dayLabel(d: Date, now: Date): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long" });
}
