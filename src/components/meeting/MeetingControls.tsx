import Link from "next/link";
import { chooseValue, saveMeetingSettings, stopMeetings } from "@/app/actions/meeting";
import { Notice, buttonClass, inputClass } from "@/components/ui";
import { DAY_NAMES, type MeetingSettings } from "@/lib/meeting/schedule";
import { nextValue } from "@/lib/meeting/values";
import { addDays } from "@/lib/time";

const time12 = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Below the deck: meeting schedule, calendar links, value picker. Not printed. */
export function MeetingControls({ date, isCurrent, settings, valueKey, values, untracked, saved, error }: { date: string; isCurrent: boolean; settings: MeetingSettings | null; valueKey: string; values: { key: string; name: string }[]; untracked: string[]; saved: boolean; error: boolean }) {
  return (
    <div className="no-print mx-auto max-w-5xl space-y-4 px-4">
      {saved && <Notice tone="ok" title="Family meeting is on the calendar">The next 8 meetings are on your School Hub calendar, and on any calendar subscribed to it.</Notice>}
      {error && <Notice tone="error" title="Couldn't save">Pick a day and a time, then try again.</Notice>}

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4">
        <h2 className="text-[15px] font-semibold">Value of the week</h2>
        <p className="mt-0.5 text-sm text-slate-600">Rotates every week. Swap it for something your family is working on.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={chooseValue} className="flex min-w-0 flex-1 gap-2">
            <input type="hidden" name="date" value={date} />
            <label htmlFor="value" className="sr-only">Value of the week</label>
            <select id="value" name="value" defaultValue={valueKey} className={`${inputClass} min-w-0 flex-1`}>
              {values.map((v) => <option key={v.key} value={v.key}>{v.name}</option>)}
            </select>
            <button className={buttonClass.secondary}>Use</button>
          </form>
          <form action={chooseValue}>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="value" value={nextValue(valueKey).key} />
            <button className={buttonClass.secondary}>Try another</button>
          </form>
        </div>
      </section>

      <section id="meeting-settings" className="scroll-mt-20 rounded-3xl border border-slate-200/80 bg-white p-4">
        <h2 className="text-[15px] font-semibold">{settings ? `Every ${DAY_NAMES[settings.day]} at ${time12(settings.time)}` : "Make it a weekly meeting"}</h2>
        <p className="mt-0.5 text-sm text-slate-600">
          {settings ? "It's on your School Hub calendar. The deck updates itself each week." : "Puts it on your School Hub calendar every week, and builds this deck fresh each time."}
        </p>
        <form action={saveMeetingSettings} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">
            Day
            <select name="day" defaultValue={settings?.day ?? 0} className={`${inputClass} mt-1`}>
              {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
          <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">
            Time
            <input type="time" name="time" defaultValue={settings?.time ?? "19:00"} className={`${inputClass} mt-1`} required />
          </label>
          <button className={buttonClass.primary}>{settings ? "Update" : "Turn on"}</button>
        </form>
        {settings && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            <a href="/api/meeting/ics" className="flex items-center justify-between rounded-2xl bg-slate-50 px-3.5 py-3 text-[15px] font-medium text-indigo-700">
              Add to my work or personal calendar
              <span className="text-xs font-normal text-slate-500">.ics · repeats weekly</span>
            </a>
            <form action={stopMeetings}>
              <button className="text-sm font-medium text-rose-600">Stop weekly meetings</button>
            </form>
          </div>
        )}
      </section>

      {untracked.length > 0 && (
        <p className="px-1 text-sm text-slate-600">
          {untracked.join(" & ")} {untracked.length === 1 ? "isn't" : "aren't"} tracked yet — <Link href="/points/setup" className="font-medium text-indigo-600">set up points</Link> to add a slide.
        </p>
      )}

      <nav className="flex justify-between px-1 text-sm font-medium text-indigo-600" aria-label="Other meetings">
        <Link href={`/meeting?date=${addDays(date, -7)}`}>← Last week&apos;s deck</Link>
        {!isCurrent && <Link href="/meeting">This week</Link>}
        <Link href={`/meeting?date=${addDays(date, 7)}`}>Next week&apos;s →</Link>
      </nav>
    </div>
  );
}
