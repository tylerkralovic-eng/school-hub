import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ItemCard, WhoChips } from "@/components/ItemCard";
import { QuickQuestion } from "@/components/QuickQuestion";
import { BehaviorSummary } from "@/components/behavior/BehaviorSummary";
import { loadBehavior } from "@/lib/server/behavior";
import { nextGap } from "@/lib/server/gaps";
import { TaskToggle } from "@/components/TaskToggle";
import { Card, EmptyState, Notice, SectionHeader, buttonClass } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { getChildFilter } from "@/lib/server/filters";
import { ITEM_SELECT, childOrFilter, type ItemView } from "@/lib/server/items";
import { addDays, dueLabel, fmt, fmtTime, todayIn, zonedToUtc } from "@/lib/time";
import { CATEGORY_LABELS } from "@/lib/types";

export const metadata = { title: "Home · School Hub" };
export const maxDuration = 300; // Quick-question school lookups

export default async function HomePage() {
  const ctx = await requireFamily();
  const childId = await getChildFilter(ctx);
  const tz = ctx.family.timezone;
  const now = new Date();
  const today = todayIn(tz, now);
  const startToday = zonedToUtc(today, null, tz);
  const startTomorrow = zonedToUtc(addDays(today, 1), null, tz);
  const in14 = zonedToUtc(addDays(today, 14), null, tz);
  const in7 = zonedToUtc(addDays(today, 7), null, tz);

  const base = () => {
    const q = ctx.supabase.from("items").select(ITEM_SELECT).eq("family_id", ctx.family.id);
    return childId ? q.or(childOrFilter(ctx, childId)) : q;
  };

  const [tasksRes, eventsRes, noticesRes, pendingRes, docsRes, gap, behavior] = await Promise.all([
    base().eq("kind", "task").is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(30),
    // Events overlapping today..+14d (multi-day events that started earlier included).
    base().not("starts_at", "is", null).lt("starts_at", in14).or(`starts_at.gte.${startToday},ends_at.gte.${startToday}`).order("starts_at").limit(40),
    base().eq("kind", "announcement").order("created_at", { ascending: false }).limit(4),
    ctx.supabase.from("extraction_candidates").select("document_id, source_documents(batch_id)").eq("family_id", ctx.family.id).eq("status", "pending").limit(200),
    ctx.supabase.from("source_documents").select("id", { count: "exact", head: true }).eq("family_id", ctx.family.id),
    nextGap(ctx),
    loadBehavior(ctx, 45),
  ]);

  const tasks = (tasksRes.data ?? []) as ItemView[];
  const events = (eventsRes.data ?? []) as ItemView[];
  const notices = (noticesRes.data ?? []) as ItemView[];
  const pending = pendingRes.data ?? [];
  const pendingBatches = [...new Set(pending.map((p) => (p.source_documents as { batch_id: string } | null)?.batch_id).filter(Boolean))];

  const todays = events.filter((e) => e.starts_at! < startTomorrow);
  const upcoming = events.filter((e) => e.starts_at! >= startTomorrow);
  const actionTasks = tasks.filter((t) => !t.due_at || t.due_at < in7);
  const laterTasks = tasks.length - actionTasks.length;
  const alerts = todays.filter((e) => e.category === "closure" || e.category === "early_dismissal");
  const child = ctx.children.find((c) => c.id === childId);
  const greeting = Number(fmt(now, tz, { hour: "numeric", hourCycle: "h23" })) < 12 ? "Good morning" : Number(fmt(now, tz, { hour: "numeric", hourCycle: "h23" })) < 17 ? "Good afternoon" : "Good evening";
  const isEmpty = (docsRes.count ?? 0) === 0 && tasks.length === 0 && events.length === 0;

  return (
    <div className="space-y-7 pb-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-600/20">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <p className="text-sm text-indigo-100">{fmt(now, tz, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting}, {ctx.me.display_name}</h1>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-indigo-50">
          {child ? `${child.first_name} today: ` : "Today: "}
          <strong className="font-semibold text-white">{todays.length} {todays.length === 1 ? "event" : "events"}</strong>
          {" · "}
          <strong className="font-semibold text-white">{actionTasks.length} to do this week</strong>
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat value={tasks.length} label="Open tasks" />
          <Stat value={upcoming.length} label="Next 2 weeks" />
          <Stat value={pending.length} label="To review" highlight={pending.length > 0} />
        </div>
      </section>

      <BehaviorSummary ctx={ctx} systems={behavior.systems} entries={behavior.entries} rewards={behavior.rewards} today={behavior.today} childFilter={childId} />

      {gap && <QuickQuestion gap={gap} />}

      {pendingBatches.length > 0 && (
        <Link href={pendingBatches.length === 1 ? `/review/${pendingBatches[0]}` : "/add#recent"} className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <Icon name="sparkle" className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="flex-1 text-[15px]">
            <span className="font-semibold">{pending.length} {pending.length === 1 ? "item" : "items"} ready for review.</span> Check them before they&apos;re added.
          </span>
          <Icon name="chevronRight" className="h-5 w-5" />
        </Link>
      )}

      {alerts.map((a) => (
        <Notice key={a.id} tone="warn" title={`${CATEGORY_LABELS[a.category]} today`}>{a.title}</Notice>
      ))}

      {isEmpty && !gap ? (
        <EmptyState
          icon="camera"
          title="Let's add your first school info"
          body="Take a photo of a printed calendar, upload a newsletter PDF, or paste a teacher's message. School Hub pulls out the dates and to-dos for you to check."
          action={<Link href="/add" className={buttonClass.primary}>Add school info</Link>}
        />
      ) : (
        <>
          <section aria-labelledby="today-h">
            <SectionHeader id="today-h" title="Today" action={<Link href="/calendar" className="text-sm font-medium text-indigo-600">Calendar</Link>} />
            {todays.length === 0 ? (
              <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-500">Nothing on the calendar today.</p>
            ) : (
              <Card className="divide-y divide-slate-100">
                {todays.map((e) => (
                  <Link key={e.id} href={`/items/${e.id}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-16 shrink-0 text-sm font-semibold text-slate-700">{e.all_day ? "All day" : fmtTime(e.starts_at!, tz)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{e.title}</span>
                      <span className="mt-1 flex flex-wrap gap-1"><WhoChips item={e} ctx={ctx} /></span>
                    </span>
                  </Link>
                ))}
              </Card>
            )}
          </section>

          <section aria-labelledby="todo-h">
            <SectionHeader id="todo-h" title="Needs action" action={<Link href="/tasks" className="text-sm font-medium text-indigo-600">All tasks</Link>} />
            {actionTasks.length === 0 ? (
              <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-500">Nothing due this week{laterTasks ? ` · ${laterTasks} later` : ""}.</p>
            ) : (
              <Card className="divide-y divide-slate-100">
                {actionTasks.slice(0, 8).map((t) => {
                  const due = t.due_at ? dueLabel(t.due_at, tz, now) : null;
                  const assignee = ctx.members.find((m) => m.user_id === t.assignee_id);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <TaskToggle id={t.id} title={t.title} done={false} />
                      <Link href={`/items/${t.id}?back=/`} className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-snug">{t.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                          {due && <span className={due.tone === "later" ? "text-slate-500" : "font-semibold text-rose-600"}>{due.label}</span>}
                          <WhoChips item={t} ctx={ctx} />
                          {t.category === "payment" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Payment{t.amount_cents != null ? ` $${(t.amount_cents / 100).toFixed(2)}` : ""}</span>}
                          {assignee && <span className="text-slate-500">· {assignee.display_name}</span>}
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </Card>
            )}
          </section>

          <section aria-labelledby="up-h">
            <SectionHeader id="up-h" title="Coming up" />
            {upcoming.length === 0 ? (
              <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-500">No events in the next two weeks.</p>
            ) : (
              <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                {upcoming.slice(0, 10).map((e) => (
                  <Link key={e.id} href={`/items/${e.id}`} className="w-52 shrink-0 snap-start">
                    <Card className="h-full p-4">
                      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-slate-100">
                        <span className="text-[10px] font-semibold uppercase text-rose-600">{fmt(e.starts_at!, tz, { month: "short" })}</span>
                        <span className="text-lg font-semibold leading-none">{fmt(e.starts_at!, tz, { day: "numeric" })}</span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug">{e.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{fmt(e.starts_at!, tz, { weekday: "short" })}{e.all_day ? " · All day" : ` · ${fmtTime(e.starts_at!, tz)}`}</p>
                      <div className="mt-2 flex flex-wrap gap-1"><WhoChips item={e} ctx={ctx} /></div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="news-h" className="space-y-3">
            <SectionHeader id="news-h" title="Recent announcements" action={<Link href="/inbox" className="text-sm font-medium text-indigo-600">Inbox</Link>} />
            {notices.length === 0 ? (
              <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-500">No announcements yet.</p>
            ) : (
              notices.map((n) => <ItemCard key={n.id} item={n} ctx={ctx} compact back="/" />)
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ value, label, highlight = false }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl px-2 py-2.5 ${highlight ? "bg-amber-300 text-amber-950" : "bg-white/15"}`}>
      <div className="text-xl font-semibold leading-none">{value}</div>
      <div className={`mt-1 text-[11px] ${highlight ? "text-amber-900" : "text-indigo-100"}`}>{label}</div>
    </div>
  );
}
