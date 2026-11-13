"use client";

import Link from "next/link";
import { useFamily } from "@/components/FamilyProvider";
import { Icon } from "@/components/Icon";
import { ItemCard, TaskCheckbox } from "@/components/ItemCard";
import { SourceHealth } from "@/components/SourceHealth";
import { Card, ChildChip, EmptyState, SectionHeader } from "@/components/ui";
import { formatDue, formatEventWhen, greeting } from "@/lib/format";
import {
  buildAgenda,
  childrenForItem,
  filterItemsByChild,
  sortFeed,
  sortTasks,
  startOfDay,
} from "@/lib/selectors";

export default function HomePage() {
  const { snapshot, filter, now, isDone, resetDemo } = useFamily();
  const items = filterItemsByChild(snapshot, filter);
  const child = snapshot.children.find((c) => c.id === filter);
  const parent = snapshot.members[0];

  const tasks = sortTasks(items);
  const openTasks = tasks.filter((t) => !isDone(t.id));
  const doneTasks = tasks.filter((t) => isDone(t.id));
  const weekEnd = startOfDay(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const dueThisWeek = openTasks.filter((t) => t.dueAt && new Date(t.dueAt) < weekEnd);
  const upcoming = buildAgenda(items, now, 14).filter((e) => e.type === "event");
  const eventsThisWeek = upcoming.filter((e) => e.at < weekEnd);
  const needsReview = items.filter((i) => i.reviewStatus === "needs_review");
  const latest = sortFeed(items.filter((i) => i.kind === "announcement" && i.reviewStatus === "published")).slice(0, 3);

  return (
    <div className="space-y-7 pb-4">
      {/* Briefing */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-600/20">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-white/5" />
        <p className="text-sm text-indigo-100">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {greeting(now)}, {parent?.displayName}
        </h1>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-indigo-50">
          {child ? `For ${child.firstName} this week: ` : "This week: "}
          <strong className="font-semibold text-white">
            {dueThisWeek.length} {dueThisWeek.length === 1 ? "thing" : "things"} to do
          </strong>{" "}
          and{" "}
          <strong className="font-semibold text-white">
            {eventsThisWeek.length} {eventsThisWeek.length === 1 ? "event" : "events"}
          </strong>
          .
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat value={openTasks.length} label="Open tasks" />
          <Stat value={upcoming.length} label="Events · 2 wks" />
          <Stat value={needsReview.length} label="To review" highlight={needsReview.length > 0} />
        </div>
      </section>

      {needsReview.length > 0 && (
        <section aria-label="Needs review" className="space-y-3">
          <SectionHeader title="Check before relying on" />
          {needsReview.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </section>
      )}

      {/* Priorities */}
      <section>
        <SectionHeader
          title="To do"
          action={
            <Link href="/inbox?kind=task" className="text-sm font-medium text-indigo-600">
              All tasks
            </Link>
          }
        />
        {openTasks.length === 0 ? (
          <EmptyState title="All tasks done 🎉" body="Nothing left on the list from connected sources." />
        ) : (
          <Card className="divide-y divide-slate-100">
            {openTasks.map((t) => {
              const due = t.dueAt ? formatDue(t.dueAt, now) : null;
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <TaskCheckbox item={t} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium leading-snug text-slate-900">{t.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      {due && (
                        <span className={due.urgent ? "font-semibold text-rose-600" : "text-slate-500"}>
                          {due.label}
                        </span>
                      )}
                      {childrenForItem(snapshot, t).map((c) => (
                        <ChildChip key={c.id} child={c} />
                      ))}
                    </div>
                  </div>
                  {t.priority === "high" && (
                    <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                      Priority
                    </span>
                  )}
                </div>
              );
            })}
          </Card>
        )}
        {doneTasks.length > 0 && (
          <details className="group mt-2 px-1">
            <summary className="cursor-pointer list-none text-sm text-slate-500 marker:hidden">
              <span className="inline-flex items-center gap-1">
                <Icon name="chevronRight" className="h-4 w-4 transition-transform group-open:rotate-90" />
                {doneTasks.length} done
              </span>
            </summary>
            <ul className="mt-2 space-y-1">
              {doneTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                  <TaskCheckbox item={t} />
                  <span className="text-sm text-slate-500 line-through">{t.title}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Coming up */}
      <section>
        <SectionHeader
          title="Coming up"
          action={
            <Link href="/calendar" className="text-sm font-medium text-indigo-600">
              Calendar
            </Link>
          }
        />
        {upcoming.length === 0 ? (
          <EmptyState title="No events in the next 2 weeks" body="From connected calendars and emails." />
        ) : (
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {upcoming.slice(0, 6).map((e) => {
              const d = e.at;
              return (
                <Card key={e.key} className="w-56 shrink-0 snap-start p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100">
                      <span className="text-[10px] font-semibold uppercase text-rose-600">
                        {d.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-lg font-semibold leading-none">{d.getDate()}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {childrenForItem(snapshot, e.item).map((c) => (
                        <ChildChip key={c.id} child={c} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug">{e.item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatEventWhen(e.item, now)}</p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Latest */}
      <section className="space-y-3">
        <SectionHeader
          title="Latest notices"
          action={
            <Link href="/inbox" className="text-sm font-medium text-indigo-600">
              Inbox
            </Link>
          }
        />
        {latest.length === 0 ? (
          <EmptyState title="No notices" body="Nothing new from connected sources." />
        ) : (
          latest.map((item) => <ItemCard key={item.id} item={item} compact />)
        )}
      </section>

      <SourceHealth />

      <div className="text-center">
        <button type="button" onClick={resetDemo} className="text-xs font-medium text-slate-400 underline-offset-2 hover:underline">
          Reset demo
        </button>
      </div>
    </div>
  );
}

function Stat({ value, label, highlight = false }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl px-2 py-2.5 ${highlight ? "bg-amber-300/95 text-amber-950" : "bg-white/15"}`}>
      <div className="text-xl font-semibold leading-none">{value}</div>
      <div className={`mt-1 text-[11px] ${highlight ? "text-amber-900" : "text-indigo-100"}`}>{label}</div>
    </div>
  );
}
