import Link from "next/link";
import { CheckIn } from "@/components/behavior/CheckIn";
import { Mark } from "@/components/behavior/Mark";
import { Icon } from "@/components/Icon";
import { ChildAvatar } from "@/components/ui";
import { checkInDue, choiceFor, choicesFor, currentStreak, monthStart, schoolWeek, streakLabel, sumPoints, weekdaysBetween, type Entry, type TrackingSystem } from "@/lib/behavior";
import type { FamilyContext } from "@/lib/server/context";
import { clientChoices, shapeOf, type Reward } from "@/lib/server/behavior";
import { fmt, utcToZoned, zonedToUtc } from "@/lib/time";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function rewardProgress(r: Reward, entries: Entry[], today: string) {
  const week = schoolWeek(today);
  const from = r.horizon === "week" ? week[0] : r.starts_on;
  const to = r.horizon === "week" ? week[4] : today;
  const pts = sumPoints(entries, r.child_id, from, to);
  return { pts, pct: Math.min(100, Math.round((pts / r.points_goal) * 100)), done: pts >= r.points_goal };
}

/** Home card: how each child's school days are going, per their school's own system. */
export function BehaviorSummary({ ctx, systems, entries, rewards, today, childFilter }: { ctx: FamilyContext; systems: (TrackingSystem & { id: string })[]; entries: Entry[]; rewards: Reward[]; today: string; childFilter: string | null }) {
  const tz = ctx.family.timezone;
  const nowTime = utcToZoned(new Date(), tz).time;
  const kids = ctx.children.filter((c) => !childFilter || c.id === childFilter);
  const tracked = kids.filter((k) => systems.some((s) => s.child_id === k.id));
  const untracked = kids.filter((k) => !systems.some((s) => s.child_id === k.id));

  if (!tracked.length)
    return (
      <Link href="/points/setup" className="flex items-center gap-3 rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/60 p-4 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white"><Icon name="sparkle" className="h-5 w-5" /></span>
        <span className="flex-1">
          <span className="block text-[16px] font-semibold">Track how school days go</span>
          <span className="text-sm text-slate-600">Stars, Skittles, clip charts — tell me how {kids.length > 1 ? "each school" : "the school"} does it, and check in with one tap.</span>
        </span>
        <Icon name="chevronRight" className="h-5 w-5 text-slate-400" />
      </Link>
    );

  const week = schoolWeek(today);
  const month = weekdaysBetween(monthStart(today), today);
  const monthName = fmt(zonedToUtc(today, "12:00", tz), tz, { month: "long" });

  return (
    <section aria-labelledby="perf-h" className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-baseline justify-between">
        <h2 id="perf-h" className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">How everyone&apos;s doing</h2>
        <span className="flex gap-3 text-sm font-medium">
          <Link href="/points/kids" className="text-indigo-600">Kid view</Link>
          <Link href="/points" className="text-indigo-600">Points</Link>
        </span>
      </div>

      {tracked.map((kid, idx) => {
        const s = systems.find((x) => x.child_id === kid.id)!;
        const shape = shapeOf(s);
        const mine = entries.filter((e) => e.child_id === kid.id);
        const todayEntry = mine.find((e) => e.day === today);
        const due = checkInDue(s, today, nowTime, Boolean(todayEntry));
        const streak = currentStreak(s, mine);
        const monthPts = sumPoints(entries, kid.id, monthStart(today), today);
        const byDay = new Map(mine.map((e) => [e.day, e]));
        const prizes = rewards.filter((r) => r.child_id === kid.id);
        const counts = choicesFor(s).map((c) => ({ ...c, n: month.filter((d) => byDay.get(d) && choiceFor(s, byDay.get(d)!)?.key === c.key).length }));
        return (
          <div key={kid.id} className={`space-y-3 ${idx ? "border-t border-slate-100 pt-5" : ""}`}>
            <div className="flex items-center gap-3">
              <ChildAvatar child={kid} size="h-9 w-9 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold">{kid.first_name}</p>
                <p className="text-xs text-slate-500">{s.name} · {monthPts} points in {monthName}</p>
              </div>
              {streak > 1 && (
                <div className="text-right">
                  <p className="text-[15px] font-semibold text-emerald-700">{streak}-day streak</p>
                  <p className="text-[11px] text-slate-500">{streakLabel(s).replace(" days in a row", "")}</p>
                </div>
              )}
            </div>

            {due && (
              <div className="rounded-2xl bg-indigo-50/70 p-3">
                <CheckIn childId={kid.id} day={today} prompt={`How was ${kid.first_name}'s day?`} choices={clientChoices(s)} shape={shape} max={s.count_max} />
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">This week</p>
              <div className="grid grid-cols-5 gap-1.5">
                {week.map((d) => {
                  const e = byDay.get(d);
                  const c = e ? choiceFor(s, e) : undefined;
                  return (
                    <div key={d} className={`flex flex-col items-center gap-1 rounded-xl py-2 ${d === today ? "bg-indigo-50" : "bg-slate-50"}`}>
                      <Mark shape={shape} fill={c?.color} stroke={c?.stroke} count={shape === "dots" ? e?.count ?? null : undefined} max={s.count_max} size={24} label={`${DOW[new Date(d + "T12:00:00Z").getUTCDay()]}: ${c ? c.label : "not logged"}`} />
                      <span className="text-[11px] text-slate-600">{DOW[new Date(d + "T12:00:00Z").getUTCDay()]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">{monthName}{shape === "dots" ? ` · ${s.count_unit ?? "kept"} each day` : ""}</p>
              {shape === "dots" ? (
                <div className="flex h-14 items-end gap-[3px] border-b border-slate-300" role="img" aria-label={`${monthName}: ${month.map((d) => byDay.get(d)?.count ?? "–").join(", ")}`}>
                  {month.map((d) => {
                    const e = byDay.get(d);
                    const c = e ? choiceFor(s, e) : undefined;
                    const h = e && e.count != null ? Math.max(4, Math.round((e.count / (s.count_max ?? 3)) * 52)) : 2;
                    return <div key={d} title={`${d}: ${e?.count ?? "not logged"}`} className="flex-1 rounded-t" style={{ height: h, background: c?.color ?? "#e2e8f0" }} />;
                  })}
                </div>
              ) : (
                <>
                  <div className="flex gap-[3px]" role="img" aria-label={`${monthName}: ${counts.filter((c) => c.n).map((c) => `${c.n} ${c.label}`).join(", ") || "nothing logged yet"}`}>
                    {month.map((d) => {
                      const e = byDay.get(d);
                      const c = e ? choiceFor(s, e) : undefined;
                      return <div key={d} title={`${d}: ${c?.label ?? "not logged"}`} className="h-5 flex-1 rounded" style={c ? { background: c.color, border: `1px solid ${c.stroke}` } : { background: "transparent", border: "1px dashed #cbd5e1" }} />;
                    })}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-300" />Not logged</span>
                    {counts.map((c) => (
                      <span key={c.key} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color, border: `1px solid ${c.stroke}` }} />{c.label} {c.n}</span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {prizes.length > 0 && (
              <div className="space-y-2">
                {prizes.map((r) => {
                  const p = rewardProgress(r, entries, today);
                  return (
                    <div key={r.id}>
                      <div className="flex justify-between text-xs"><span className="font-medium text-slate-700">{r.horizon === "week" ? "This week" : "Big prize"}: {r.title}</span><span className={p.done ? "font-semibold text-emerald-700" : "text-slate-500"}>{p.done ? "Earned!" : `${p.pts}/${r.points_goal}`}</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${p.pct}%`, background: p.done ? "#10b981" : "#4f46e5" }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
            {!due && !todayEntry && <Link href="/points" className="inline-block text-sm font-medium text-indigo-600">Log a day</Link>}
          </div>
        );
      })}
      {untracked.length > 0 && <Link href="/points/setup" className="block text-sm font-medium text-indigo-600">Set up tracking for {untracked.map((k) => k.first_name).join(" and ")}</Link>}
    </section>
  );
}
