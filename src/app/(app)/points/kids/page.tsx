import Link from "next/link";
import { rewardProgress } from "@/components/behavior/BehaviorSummary";
import { Mark } from "@/components/behavior/Mark";
import { currentStreak, choiceFor, monthStart, schoolWeek, streakLabel, sumPoints } from "@/lib/behavior";
import { requireFamily } from "@/lib/server/context";
import { loadBehavior, shapeOf } from "@/lib/server/behavior";
import { colorOf } from "@/components/ui";
import { fmt, zonedToUtc } from "@/lib/time";

export const metadata = { title: "Kid view · School Hub" };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AVATAR_HEX: Record<string, string> = { violet: "#7c3aed", teal: "#0f766e", amber: "#b45309", rose: "#be123c", sky: "#0369a1", emerald: "#047857" };

/** Big, simple view the kids can read: their points, this week, and what they're working toward. */
export default async function KidViewPage() {
  const ctx = await requireFamily();
  const { today, systems, entries, rewards } = await loadBehavior(ctx, 60);
  const tz = ctx.family.timezone;
  const monthName = fmt(zonedToUtc(today, "12:00", tz), tz, { month: "long" });
  const week = schoolWeek(today);
  const kids = ctx.children.filter((k) => systems.some((s) => s.child_id === k.id));

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between px-1 pt-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Kid view</h1>
        <Link href="/" className="text-sm font-semibold text-indigo-600">Done</Link>
      </div>
      {kids.length === 0 && <p className="px-1 text-slate-600">Set up tracking first in <Link className="font-semibold text-indigo-600" href="/points/setup">Points</Link>.</p>}
      {kids.map((kid) => {
        const s = systems.find((x) => x.child_id === kid.id)!;
        const shape = shapeOf(s);
        const mine = entries.filter((e) => e.child_id === kid.id);
        const byDay = new Map(mine.map((e) => [e.day, e]));
        const pts = sumPoints(entries, kid.id, monthStart(today), today);
        const streak = currentStreak(s, mine);
        const color = AVATAR_HEX[kid.color] ?? "#4f46e5";
        const todayEntry = byDay.get(today);
        const todayChoice = todayEntry ? choiceFor(s, todayEntry) : undefined;
        return (
          <section key={kid.id} className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm" style={{ border: `3px solid ${color}33` }}>
            <div className="flex items-center gap-3">
              <span className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-extrabold ${colorOf(kid).avatar}`}>{kid.first_name[0]}</span>
              <div>
                <p className="text-2xl font-extrabold">{kid.first_name}</p>
                <p className="text-[15px] text-slate-600">{todayChoice ? `Today: ${todayChoice.label}` : "Today: not logged yet"}{streak > 1 ? ` · ${streak} ${streakLabel(s)}` : ""}</p>
              </div>
            </div>
            <p className="flex items-baseline gap-2"><span className="text-6xl font-extrabold tracking-tight" style={{ color }}>{pts}</span><span className="text-lg font-semibold text-slate-600">points in {monthName}</span></p>
            <div className="grid grid-cols-5 gap-2">
              {week.map((d) => {
                const e = byDay.get(d);
                const c = e ? choiceFor(s, e) : undefined;
                return (
                  <div key={d} className="flex flex-col items-center gap-1 rounded-2xl bg-slate-50 py-2.5">
                    <Mark shape={shape} fill={c?.color} stroke={c?.stroke} count={shape === "dots" ? e?.count ?? null : undefined} max={s.count_max} size={32} label={`${DOW[new Date(d + "T12:00:00Z").getUTCDay()]}: ${c?.label ?? "not yet"}`} />
                    <span className="text-xs font-semibold text-slate-600">{DOW[new Date(d + "T12:00:00Z").getUTCDay()]}</span>
                  </div>
                );
              })}
            </div>
            {rewards.filter((r) => r.child_id === kid.id).map((r) => {
              const p = rewardProgress(r, entries, today);
              return (
                <div key={r.id} className="space-y-2 rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{r.horizon === "week" ? "This week's prize" : "Big prize"}</p>
                    {p.done && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Earned!</span>}
                  </div>
                  <p className="text-xl font-bold">{r.title}</p>
                  <div className="h-4 overflow-hidden rounded-full bg-slate-200"><div className="h-4 rounded-full" style={{ width: `${p.pct}%`, background: p.done ? "#10b981" : color }} /></div>
                  <p className="text-sm font-medium text-slate-600">{p.done ? "You did it!" : `${p.pts} of ${r.points_goal} points · ${r.points_goal - p.pts} to go`}</p>
                </div>
              );
            })}
            {!rewards.some((r) => r.child_id === kid.id) && <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-600">No prize yet — pick one together in <Link href="/points" className="font-semibold text-indigo-600">Points</Link>.</p>}
          </section>
        );
      })}
    </div>
  );
}
