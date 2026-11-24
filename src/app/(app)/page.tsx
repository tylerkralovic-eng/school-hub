import Link from "next/link";
import { PointsQuickRow } from "@/components/behavior/PointsQuickRow";
import { BehaviorSummary } from "@/components/behavior/BehaviorSummary";
import { Icon } from "@/components/Icon";
import { WhoChips } from "@/components/ItemCard";
import { QuickQuestion } from "@/components/QuickQuestion";
import { TaskToggle } from "@/components/TaskToggle";
import { Card, EmptyState, Notice, SectionHeader, buttonClass } from "@/components/ui";
import { loadBehavior } from "@/lib/server/behavior";
import { requireFamily } from "@/lib/server/context";
import { getChildFilter } from "@/lib/server/filters";
import { nextGap } from "@/lib/server/gaps";
import { ITEM_SELECT, childOrFilter, type ItemView } from "@/lib/server/items";
import { addDays, dueLabel, fmt, fmtTime, todayIn, utcToZoned, zonedToUtc } from "@/lib/time";
import { CATEGORY_LABELS } from "@/lib/types";

export const metadata = { title: "Home · School Hub" };
export const maxDuration = 300; // Quick-question actions (school lookups, re-reading emails)

/** Home: a short, functional version of the app — what needs you, points, today, the week ahead. */
export default async function HomePage() {
  const ctx = await requireFamily();
  const childId = await getChildFilter(ctx);
  const tz = ctx.family.timezone;
  const now = new Date();
  const today = todayIn(tz, now);
  const startToday = zonedToUtc(today, null, tz);
  const startTomorrow = zonedToUtc(addDays(today, 1), null, tz);
  const in3 = zonedToUtc(addDays(today, 3), null, tz);
  const in7 = zonedToUtc(addDays(today, 7), null, tz);
  const in8 = zonedToUtc(addDays(today, 8), null, tz);

  const base = () => {
    const q = ctx.supabase.from("items").select(ITEM_SELECT).eq("family_id", ctx.family.id);
    return childId ? q.or(childOrFilter(ctx, childId)) : q;
  };

  const [tasksRes, eventsRes, pendingRes, docsRes, gap, behavior] = await Promise.all([
    base().eq("kind", "task").is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(60),
    base().not("starts_at", "is", null).lt("starts_at", in8).or(`starts_at.gte.${startToday},ends_at.gte.${startToday}`).order("starts_at").limit(60),
    ctx.supabase.from("extraction_candidates").select("id", { count: "exact", head: true }).eq("family_id", ctx.family.id).eq("status", "pending"),
    ctx.supabase.from("source_documents").select("id", { count: "exact", head: true }).eq("family_id", ctx.family.id),
    nextGap(ctx),
    loadBehavior(ctx, 45),
  ]);
  const tasks = (tasksRes.data ?? []) as ItemView[];
  const events = (eventsRes.data ?? []) as ItemView[];
  const pending = pendingRes.count ?? 0;

  // What needs a parent: past due, due within 3 days, payments due this week.
  const attention = tasks.filter((t) => t.due_at && (t.due_at < in3 || (t.category === "payment" && t.due_at < in7)));
  const alerts = events.filter((e) => e.starts_at! < startTomorrow && (e.category === "closure" || e.category === "early_dismissal"));
  const todays = events.filter((e) => e.starts_at! < startTomorrow);

  // Next 7 days, as compact day rows: events + other task deadlines.
  const rows = [
    ...events.filter((e) => e.starts_at! >= startTomorrow).map((e) => ({ id: e.id, at: e.starts_at!, title: e.title, item: e, due: false })),
    ...tasks.filter((t) => t.due_at && t.due_at >= in3 && t.due_at < in8 && !attention.includes(t)).map((t) => ({ id: t.id, at: t.due_at!, title: t.title, item: t, due: true })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = utcToZoned(r.at, tz).date;
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }

  const hour = Number(utcToZoned(now, tz).time.slice(0, 2));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const isEmpty = (docsRes.count ?? 0) === 0 && tasks.length === 0 && events.length === 0;
  const summary = [
    attention.length ? `${attention.length} ${attention.length === 1 ? "thing needs" : "things need"} you` : null,
    todays.length ? `${todays.length} today` : "nothing on today",
    rows.length ? `${rows.length} this week` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5 pb-4">
      <section className="rounded-3xl bg-indigo-600 px-5 py-4 text-white">
        <p className="text-sm text-indigo-100">{fmt(now, tz, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight">{greeting}, {ctx.me.display_name}</h1>
        <p className="mt-1 text-[15px] text-indigo-50">{summary}</p>
      </section>

      {alerts.map((a) => (
        <Notice key={a.id} tone="warn" title={`${CATEGORY_LABELS[a.category]} today`}>{a.title}</Notice>
      ))}

      {pending > 0 && (
        <Link href="/review" className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950">
          <Icon name="sparkle" className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="flex-1 text-[15px]"><b>{pending} new {pending === 1 ? "item" : "items"}</b> to review — sorted by what&apos;s urgent.</span>
          <Icon name="chevronRight" className="h-5 w-5" />
        </Link>
      )}

      {gap && <QuickQuestion gap={gap} />}

      {isEmpty && !gap ? (
        <EmptyState icon="camera" title="Let's add your first school info" body="Connect your email or snap a photo of a school calendar — School Hub pulls out the dates and to-dos." action={<Link href="/connections" className={buttonClass.primary}>Get connected</Link>} />
      ) : (
        <>
          {attention.length > 0 && (
            <section aria-labelledby="att-h">
              <SectionHeader id="att-h" title="Needs attention" action={<Link href="/tasks" className="text-sm font-medium text-indigo-600">All tasks</Link>} />
              <Card className="divide-y divide-slate-100">
                {attention.slice(0, 6).map((t) => {
                  const due = dueLabel(t.due_at!, tz, now);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <TaskToggle id={t.id} title={t.title} done={false} />
                      <Link href={`/items/${t.id}?back=/`} className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">{t.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className={due.tone === "overdue" ? "font-semibold text-rose-600" : "font-medium text-amber-700"}>{due.label}</span>
                          {t.category === "payment" && <span className="font-medium text-slate-600">· Payment{t.amount_cents != null ? ` $${(t.amount_cents / 100).toFixed(2)}` : ""}</span>}
                        </p>
                      </Link>
                    </div>
                  );
                })}
              </Card>
              {attention.length > 6 && <Link href="/tasks" className="mt-2 block px-1 text-sm font-medium text-indigo-600">+{attention.length - 6} more</Link>}
            </section>
          )}

          <PointsQuickRow ctx={ctx} systems={behavior.systems} entries={behavior.entries} today={behavior.today} childFilter={childId} />
          {!behavior.systems.length && <BehaviorSummary ctx={ctx} systems={[]} entries={[]} rewards={[]} today={behavior.today} childFilter={childId} />}

          <section aria-labelledby="today-h">
            <SectionHeader id="today-h" title="Today" />
            {todays.length === 0 ? (
              <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-500">Nothing on the calendar today.</p>
            ) : (
              <Card className="divide-y divide-slate-100">
                {todays.map((e) => (
                  <Link key={e.id} href={`/items/${e.id}?back=/`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-16 shrink-0 text-sm font-semibold text-slate-700">{e.all_day ? "All day" : fmtTime(e.starts_at!, tz)}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{e.title}</span>
                    <span className="flex shrink-0 gap-1"><WhoChips item={e} ctx={ctx} /></span>
                  </Link>
                ))}
              </Card>
            )}
          </section>

          <section aria-labelledby="week-h">
            <SectionHeader id="week-h" title="Next 7 days" action={<Link href="/calendar" className="text-sm font-medium text-indigo-600">Calendar</Link>} />
            {byDay.size === 0 ? (
              <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-500">Nothing scheduled this week.</p>
            ) : (
              <Card className="divide-y divide-slate-100">
                {[...byDay.entries()].map(([d, list]) => (
                  <div key={d} className="flex gap-3 px-4 py-2.5">
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-[11px] font-semibold uppercase text-slate-500">{fmt(zonedToUtc(d, "12:00", tz), tz, { weekday: "short" })}</p>
                      <p className="text-lg font-semibold leading-tight">{Number(d.slice(8))}</p>
                    </div>
                    <ul className="min-w-0 flex-1 space-y-1 py-0.5">
                      {list.slice(0, 4).map((r) => (
                        <li key={r.id + (r.due ? "d" : "")}>
                          <Link href={`/items/${r.id}?back=/`} className="flex items-center gap-2 text-[14px]">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${r.due ? "bg-rose-500" : r.item.category === "closure" ? "bg-rose-400" : "bg-sky-500"}`} aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">{r.due ? `Due: ${r.title}` : r.title}</span>
                            {!r.due && !r.item.all_day && <span className="shrink-0 text-xs text-slate-500">{fmtTime(r.at, tz)}</span>}
                          </Link>
                        </li>
                      ))}
                      {list.length > 4 && <li className="text-xs text-slate-500">+{list.length - 4} more</li>}
                    </ul>
                  </div>
                ))}
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}
