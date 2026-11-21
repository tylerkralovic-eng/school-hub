import Link from "next/link";
import { claimReward, deleteReward, removeTracking, saveReward, saveTrackingSettings } from "@/app/actions/behavior";
import { ActionForm, ConfirmButton } from "@/components/ActionForm";
import { rewardProgress } from "@/components/behavior/BehaviorSummary";
import { CheckIn } from "@/components/behavior/CheckIn";
import { DayEditor } from "@/components/behavior/DayEditor";
import { Icon } from "@/components/Icon";
import { Card, ChildAvatar, EmptyState, Field, Notice, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { choicesFor, countPointsMap, currentStreak, monthStart, streakLabel, sumPoints, weekdaysBetween } from "@/lib/behavior";
import { requireFamily } from "@/lib/server/context";
import { clientChoices, loadBehavior, shapeOf } from "@/lib/server/behavior";
import { getChildFilter } from "@/lib/server/filters";
import { addDays, fmt, zonedToUtc } from "@/lib/time";

export const metadata = { title: "Points · School Hub" };

export default async function PointsPage({ searchParams }: { searchParams: Promise<{ month?: string; setup?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFamily();
  const childFilter = await getChildFilter(ctx);
  const { today, systems, entries, rewards } = await loadBehavior(ctx, 400);
  const tz = ctx.family.timezone;
  const thisMonth = today.slice(0, 7);
  const ym = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth;
  const mStart = `${ym}-01`;
  const [y, m] = ym.split("-").map(Number);
  const mEndFull = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const mEnd = mEndFull > today ? today : mEndFull;
  const days = weekdaysBetween(mStart, mEnd);
  const prevMonth = addDays(mStart, -1).slice(0, 7);
  const nextMonth = addDays(mEndFull, 1).slice(0, 7);
  const monthName = fmt(zonedToUtc(mStart, "12:00", tz), tz, { month: "long", year: "numeric" });
  const kids = ctx.children.filter((c) => !childFilter || c.id === childFilter);

  if (!systems.length)
    return (
      <div className="space-y-5 pb-6">
        <PageTitle title="Points" />
        <EmptyState icon="sparkle" title="Track how school days go" body="Tell School Hub how each school tracks behavior — stars, Skittles, clip charts — and log each day with one tap." action={<Link href="/points/setup" className={buttonClass.primary}>Set it up</Link>} />
      </div>
    );

  return (
    <div className="space-y-6 pb-6">
      <PageTitle title="Points" subtitle="Log days, fill in history and set prizes." action={<Link href="/points/kids" className={`${buttonClass.secondary} !px-3 !py-2 text-sm`}>Kid view</Link>} />
      {sp.setup === "done" && <Notice tone="ok" title="Tracking is on">Log today below. To fill in earlier days, tap them in the month grid.</Notice>}

      {kids.map((kid) => {
        const s = systems.find((x) => x.child_id === kid.id);
        if (!s) return (
          <Card key={kid.id} className="flex items-center gap-3 p-4">
            <ChildAvatar child={kid} size="h-9 w-9 text-sm" />
            <span className="flex-1 font-medium">{kid.first_name} isn&apos;t tracked yet</span>
            <Link href="/points/setup" className="text-sm font-semibold text-indigo-600">Set up</Link>
          </Card>
        );
        const shape = shapeOf(s);
        const choices = clientChoices(s);
        const mine = entries.filter((e) => e.child_id === kid.id);
        const values = Object.fromEntries(mine.map((e) => [e.day, s.kind === "count" ? String(e.count) : (e.level_key ?? "")]));
        const streak = currentStreak(s, mine);
        const prizes = rewards.filter((r) => r.child_id === kid.id);
        return (
          <section key={kid.id} className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-4">
            <div className="flex items-center gap-3">
              <ChildAvatar child={kid} size="h-10 w-10 text-base" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{kid.first_name}</h2>
                <p className="text-sm text-slate-500">{s.name} · {sumPoints(entries, kid.id, monthStart(today), today)} points this month{streak > 1 ? ` · ${streak} ${streakLabel(s)}` : ""}</p>
              </div>
            </div>

            {new Date(today + "T12:00:00Z").getUTCDay() % 6 !== 0 && (
              <div className="rounded-2xl bg-indigo-50/70 p-3">
                <CheckIn childId={kid.id} day={today} prompt={`Today · how was ${kid.first_name}'s day?`} choices={choices} shape={shape} max={s.count_max} current={values[today] ?? null} />
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Link href={`/points?month=${prevMonth}`} aria-label="Previous month" className="rounded-lg p-1.5 hover:bg-slate-100"><Icon name="chevronRight" className="h-4 w-4 rotate-180" /></Link>
                <h3 className="text-sm font-semibold">{monthName}</h3>
                {ym < thisMonth ? <Link href={`/points?month=${nextMonth}`} aria-label="Next month" className="rounded-lg p-1.5 hover:bg-slate-100"><Icon name="chevronRight" className="h-4 w-4" /></Link> : <span className="w-7" />}
              </div>
              <DayEditor childId={kid.id} childName={kid.first_name} days={days} values={values} choices={choices} shape={shape} max={s.count_max} today={today} />
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold">Prizes</h3>
              {prizes.map((r) => {
                const p = rewardProgress(r, entries, today);
                return (
                  <div key={r.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{r.horizon === "week" ? "This week" : "Big prize"}</p>
                        <p className="text-[15px] font-semibold">{r.title}</p>
                      </div>
                      <span className={`text-sm font-semibold ${p.done ? "text-emerald-700" : "text-slate-600"}`}>{p.done ? "Earned!" : `${p.pts} / ${r.points_goal}`}</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-2.5 rounded-full" style={{ width: `${p.pct}%`, background: p.done ? "#10b981" : "#4f46e5" }} /></div>
                    <div className="mt-2 flex gap-4 text-xs font-semibold">
                      {p.done && r.horizon === "big" && <form action={claimReward}><input type="hidden" name="id" value={r.id} /><button className="text-emerald-700">Mark as given</button></form>}
                      <form action={deleteReward}><input type="hidden" name="id" value={r.id} /><button className="text-slate-500">Remove</button></form>
                    </div>
                    {r.horizon === "week" && <p className="mt-1 text-xs text-slate-500">Resets every Monday.</p>}
                  </div>
                );
              })}
              <details className="rounded-2xl border border-dashed border-slate-300 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-indigo-600">Add a prize</summary>
                <ActionForm action={saveReward} submitLabel="Add prize" resetOnSuccess className="mt-3 space-y-3">
                  <input type="hidden" name="child_id" value={kid.id} />
                  <fieldset className="flex gap-4 text-sm">
                    <legend className="sr-only">Kind</legend>
                    <label className="flex items-center gap-1.5"><input type="radio" name="horizon" value="week" defaultChecked className="accent-indigo-600" />Weekly</label>
                    <label className="flex items-center gap-1.5"><input type="radio" name="horizon" value="big" className="accent-indigo-600" />Big (saves up)</label>
                  </fieldset>
                  <Field label="Prize" htmlFor={`pt-${kid.id}`}><input id={`pt-${kid.id}`} name="title" required placeholder="e.g. Pick Friday's movie" className={inputClass} /></Field>
                  <Field label="Points needed" htmlFor={`pg-${kid.id}`} hint={`A perfect week is ${(choicesFor(s)[0]?.points ?? 0) * 5} points${s.kind === "levels" && s.levels[1] ? `; a normal good week about ${s.levels[1].points * 5}` : ""}.`}>
                    <input id={`pg-${kid.id}`} name="points_goal" type="number" min={1} required className={inputClass} />
                  </Field>
                </ActionForm>
              </details>
            </div>

            <details className="border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-600">Settings</summary>
              <ActionForm action={saveTrackingSettings} className="mt-3 space-y-3">
                <input type="hidden" name="child_id" value={kid.id} />
                <Field label="Ask after pick-up at" htmlFor={`ct-${kid.id}`}><input id={`ct-${kid.id}`} type="time" name="check_in_time" defaultValue={s.check_in_time?.slice(0, 5) ?? "15:00"} className={inputClass} /></Field>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Points per day <span className="font-normal text-slate-500">(use a minus number to take points away)</span></p>
                  {s.kind === "levels"
                    ? s.levels.map((l) => (
                        <label key={l.key} className="flex items-center justify-between gap-3 text-sm">
                          <span>{l.label}{l.meaning ? <span className="text-slate-500"> · {l.meaning}</span> : null}</span>
                          <input type="number" name={`points.${l.key}`} min={-10} max={10} defaultValue={l.points} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right" aria-label={`Points for ${l.label}`} />
                        </label>
                      ))
                    : Object.entries(countPointsMap(s.count_max ?? 3, s.count_points)).sort((a, b) => Number(b[0]) - Number(a[0])).map(([n, p]) => (
                        <label key={n} className="flex items-center justify-between gap-3 text-sm">
                          <span>{n} {s.count_unit ?? "kept"}</span>
                          <input type="number" name={`cpoints.${n}`} min={-10} max={10} defaultValue={p} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right" aria-label={`Points for ${n} ${s.count_unit ?? "kept"}`} />
                        </label>
                      ))}
                  <p className="text-xs text-slate-500">Changing points re-scores days already logged.</p>
                </div>
              </ActionForm>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href="/points/setup" className="font-semibold text-indigo-600">Describe it again</Link>
                <form action={removeTracking}><input type="hidden" name="child_id" value={kid.id} /><ConfirmButton message={`Stop tracking ${kid.first_name}? Logged days are deleted.`} className="font-semibold text-rose-600">Stop tracking</ConfirmButton></form>
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
