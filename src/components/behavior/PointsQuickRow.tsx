import Link from "next/link";
import { CheckIn } from "@/components/behavior/CheckIn";
import { Mark } from "@/components/behavior/Mark";
import { ChildAvatar } from "@/components/ui";
import { checkInDue, choiceFor, currentStreak, monthStart, schoolWeek, sumPoints, weekday, type Entry, type TrackingSystem } from "@/lib/behavior";
import type { FamilyContext } from "@/lib/server/context";
import { clientChoices, shapeOf } from "@/lib/server/behavior";
import { utcToZoned } from "@/lib/time";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const hm = (t: string | null) => {
  const [h, m] = (t ?? "15:00").slice(0, 5).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Home: one compact line per child — this week at a glance, and one-tap logging after pick-up. */
export function PointsQuickRow({ ctx, systems, entries, today, childFilter }: { ctx: FamilyContext; systems: (TrackingSystem & { id: string })[]; entries: Entry[]; today: string; childFilter: string | null }) {
  const kids = ctx.children.filter((c) => (!childFilter || c.id === childFilter) && systems.some((s) => s.child_id === c.id));
  if (!kids.length) return null;
  const nowTime = utcToZoned(new Date(), ctx.family.timezone).time;
  const week = schoolWeek(today);
  const schoolDay = weekday(today) % 6 !== 0;

  return (
    <section aria-labelledby="pts-h" className="rounded-3xl border border-slate-200/80 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="pts-h" className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">Points</h2>
        <Link href="/points" className="text-sm font-medium text-indigo-600">Details</Link>
      </div>
      <div className="divide-y divide-slate-100">
        {kids.map((kid) => {
          const s = systems.find((x) => x.child_id === kid.id)!;
          const shape = shapeOf(s);
          const mine = entries.filter((e) => e.child_id === kid.id);
          const todayEntry = mine.find((e) => e.day === today);
          const due = checkInDue(s, today, nowTime, Boolean(todayEntry));
          const streak = currentStreak(s, mine);
          const pts = sumPoints(entries, kid.id, monthStart(today), today);
          return (
            <div key={kid.id} className="py-3 first:pt-1 last:pb-0">
              <div className="flex items-center gap-3">
                <ChildAvatar child={kid} size="h-8 w-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight">{kid.first_name}</p>
                  <p className="text-xs text-slate-500">{pts} pts this month{streak > 1 ? ` · ${streak}-day streak` : ""}</p>
                </div>
                <div className="flex gap-1" aria-label={`${kid.first_name} this week`}>
                  {week.map((d) => {
                    const e = mine.find((x) => x.day === d);
                    const c = e ? choiceFor(s, e) : undefined;
                    return (
                      <span key={d} className={`flex w-7 flex-col items-center rounded-lg py-1 ${d === today ? "bg-indigo-50" : ""}`}>
                        <Mark shape={shape} fill={c?.color} stroke={c?.stroke} count={shape === "dots" ? e?.count ?? null : undefined} max={s.count_max} size={18} label={`${d}: ${c?.label ?? "not logged"}`} />
                        <span className="text-[10px] text-slate-400">{DOW[weekday(d)]}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              {due && (
                <div className="mt-2.5">
                  <CheckIn childId={kid.id} day={today} prompt={`How was ${kid.first_name}'s day?`} choices={clientChoices(s)} shape={shape} max={s.count_max} compact />
                </div>
              )}
              {!todayEntry && !due && schoolDay && <p className="mt-1.5 pl-11 text-xs text-slate-500">Check-in after pick-up ({hm(s.check_in_time)}) · <Link href="/points" className="font-medium text-indigo-600">log now</Link></p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
