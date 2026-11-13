import Link from "next/link";
import { Icon } from "@/components/Icon";
import { WhoChips } from "@/components/ItemCard";
import { Card, EmptyState, Notice, PageTitle, buttonClass, colorOf } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { getChildFilter } from "@/lib/server/filters";
import { ITEM_SELECT, childOrFilter, type ItemView } from "@/lib/server/items";
import { addDays, fmt, fmtTime, todayIn, utcToZoned, zonedToUtc } from "@/lib/time";

export const metadata = { title: "Calendar · School Hub" };

interface Entry { key: string; day: string; type: "event" | "deadline"; item: ItemView }

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const first = `${ym}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { first, next };
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; added?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFamily();
  const tz = ctx.family.timezone;
  const childId = await getChildFilter(ctx);
  const today = todayIn(tz);
  const ym = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const { first, next } = monthBounds(ym);
  const from = zonedToUtc(first, null, tz);
  const to = zonedToUtc(next, null, tz);

  let q = ctx.supabase
    .from("items")
    .select(ITEM_SELECT)
    .eq("family_id", ctx.family.id)
    .or(`and(starts_at.lt.${to},starts_at.gte.${from}),and(starts_at.lt.${from},ends_at.gte.${from}),and(kind.eq.task,due_at.gte.${from},due_at.lt.${to})`)
    .limit(500);
  if (childId) q = q.or(childOrFilter(ctx, childId));
  const { data } = await q;
  const items = (data ?? []) as ItemView[];

  // Expand into per-day entries (multi-day events appear on each day).
  const entries: Entry[] = [];
  for (const it of items) {
    if (it.starts_at) {
      const s = utcToZoned(it.starts_at, tz).date;
      const e = it.ends_at ? utcToZoned(it.ends_at, tz).date : s;
      for (let d = s, n = 0; d <= e && n < 62; d = addDays(d, 1), n++) {
        if (d >= first && d < next) entries.push({ key: `${it.id}:${d}`, day: d, type: "event", item: it });
      }
    }
    if (it.kind === "task" && it.due_at) entries.push({ key: `${it.id}:due`, day: utcToZoned(it.due_at, tz).date, type: "deadline", item: it });
  }
  entries.sort((a, b) => a.day.localeCompare(b.day) || (a.item.all_day === b.item.all_day ? (a.item.starts_at ?? a.item.due_at ?? "").localeCompare(b.item.starts_at ?? b.item.due_at ?? "") : a.item.all_day ? -1 : 1));
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  // Grid
  const [y, m] = ym.split("-").map(Number);
  const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const nxt = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const agendaDays = [...byDay.keys()].filter((d) => ym !== today.slice(0, 7) || d >= today);

  const dotColor = (it: ItemView) => {
    const c = ctx.children.find((k) => k.id === it.child_id);
    if (c) return colorOf(c).dot;
    return it.category === "closure" ? "bg-rose-500" : "bg-slate-400";
  };

  return (
    <div className="space-y-5 pb-4">
      <PageTitle title="Calendar" action={<Link href="/items/new?kind=event" className={`${buttonClass.secondary} !px-3 !py-2 text-sm`}><Icon name="plus" className="h-4 w-4" />Event</Link>} />
      {sp.added && <Notice tone="ok">Saved to your calendar.</Notice>}

      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <Link href={`/calendar?month=${prev}`} aria-label="Previous month" className="rounded-lg p-2 hover:bg-slate-100"><Icon name="chevronRight" className="h-5 w-5 rotate-180" /></Link>
          <h2 className="text-[15px] font-semibold">{monthLabel}</h2>
          <Link href={`/calendar?month=${nxt}`} aria-label="Next month" className="rounded-lg p-2 hover:bg-slate-100"><Icon name="chevronRight" className="h-5 w-5" /></Link>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-slate-400">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const es = byDay.get(d) ?? [];
            const closed = es.some((e) => e.item.category === "closure");
            const isToday = d === today;
            const inner = (
              <>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${isToday ? "bg-indigo-600 font-semibold text-white" : closed ? "bg-rose-50 font-medium text-rose-700" : "text-slate-800"}`}>{Number(d.slice(8))}</span>
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {[...new Set(es.map((e) => dotColor(e.item)))].slice(0, 3).map((c) => <span key={c} className={`h-1.5 w-1.5 rounded-full ${c}`} />)}
                </span>
              </>
            );
            return es.length ? (
              <a key={i} href={`#day-${d}`} className="flex flex-col items-center rounded-lg py-1 hover:bg-slate-50" aria-label={`${d}: ${es.length} items`}>{inner}</a>
            ) : (
              <div key={i} className="flex flex-col items-center py-1">{inner}</div>
            );
          })}
        </div>
      </Card>

      {agendaDays.length === 0 ? (
        <EmptyState icon="calendar" title={`Nothing ${ym === today.slice(0, 7) ? "coming up" : "scheduled"} in ${monthLabel.split(" ")[0]}`} body="Add a school calendar photo and School Hub will fill this in." action={<Link href="/add" className={buttonClass.primary}>Add a calendar</Link>} />
      ) : (
        agendaDays.map((d) => (
          <section key={d} id={`day-${d}`} className="scroll-mt-24 space-y-2">
            <h3 className="px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
              {d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : fmt(zonedToUtc(d, "12:00", tz), tz, { weekday: "long" })}
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">{fmt(zonedToUtc(d, "12:00", tz), tz, { month: "short", day: "numeric" })}</span>
            </h3>
            <Card className="divide-y divide-slate-100">
              {byDay.get(d)!.map((e) => {
                const it = e.item;
                const done = e.type === "deadline" && it.completed_at;
                const deadline = e.type === "deadline";
                return (
                  <Link key={e.key} href={`/items/${it.id}?back=${encodeURIComponent(`/calendar?month=${ym}`)}`} className={`flex gap-3 px-4 py-3 ${done ? "opacity-50" : ""}`}>
                    <div className="w-16 shrink-0 pt-0.5 text-right">
                      <div className="text-sm font-semibold text-slate-800">{deadline ? (utcToZoned(it.due_at!, tz).time === "23:59" ? "" : fmtTime(it.due_at!, tz)) : it.all_day ? "All day" : fmtTime(it.starts_at!, tz)}</div>
                      <div className={`mt-0.5 text-[11px] font-semibold uppercase ${deadline ? "text-rose-600" : it.category === "closure" ? "text-rose-600" : "text-sky-600"}`}>{deadline ? (done ? "Done" : "Due") : it.category === "closure" ? "Closed" : it.category === "early_dismissal" ? "Early out" : "Event"}</div>
                    </div>
                    <div className={`w-1 shrink-0 rounded-full ${deadline || it.category === "closure" ? "bg-rose-500" : "bg-sky-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[15px] font-semibold leading-snug ${done ? "line-through" : ""}`}>{it.title}</p>
                      {it.location && <p className="mt-0.5 flex items-center gap-1 text-[13px] text-slate-500"><Icon name="pin" className="h-3.5 w-3.5" />{it.location}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><WhoChips item={it} ctx={ctx} /></div>
                    </div>
                  </Link>
                );
              })}
            </Card>
          </section>
        ))
      )}
      <p className="px-1 text-center text-xs text-slate-500">
        Want these on your phone&apos;s calendar? <Link href="/connections#calendar" className="font-medium text-indigo-600">Subscribe</Link>
      </p>
    </div>
  );
}
