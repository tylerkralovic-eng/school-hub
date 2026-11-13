/**
 * Time-zone aware helpers. School dates are wall-clock dates in the family's
 * time zone ("Nov 20, 8:00 AM"), stored as UTC instants. No dependencies:
 * uses Intl to compute offsets, including across DST changes.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(s: string | null | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTime(s: string | null | undefined): s is string {
  return Boolean(s && TIME_RE.test(s));
}

/** Offset (ms) of `tz` from UTC at the given instant. */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Wall-clock date (+ optional time) in `tz` → UTC ISO string. */
export function zonedToUtc(date: string, time: string | null, tz: string): string {
  if (!isValidDate(date)) throw new Error(`Invalid date ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time && isValidTime(time) ? time.split(":").map(Number) : [0, 0];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle DST transitions.
  let ts = guess - tzOffsetMs(new Date(guess), tz);
  ts = guess - tzOffsetMs(new Date(ts), tz);
  return new Date(ts).toISOString();
}

/** UTC instant → { date: YYYY-MM-DD, time: HH:MM } in `tz`. */
export function utcToZoned(iso: string | Date, tz: string): { date: string; time: string } {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Today's date (YYYY-MM-DD) in `tz`. */
export function todayIn(tz: string, now: Date = new Date()): string {
  return utcToZoned(now, tz).date;
}

/** Add days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function fmt(iso: string | Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function fmtTime(iso: string, tz: string): string {
  return fmt(iso, tz, { hour: "numeric", minute: "2-digit" });
}

/** "Today", "Tomorrow", "Yesterday", "Friday" (within a week), else "Fri, Nov 21". */
export function relativeDay(iso: string, tz: string, now: Date = new Date()): string {
  const diff = daysBetween(todayIn(tz, now), utcToZoned(iso, tz).date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return fmt(iso, tz, { weekday: "long" });
  return fmt(iso, tz, { weekday: "short", month: "short", day: "numeric" });
}

/** "Due today 3:00 PM", "Overdue", "Due tomorrow", "Due Fri", "Due Nov 20". */
export function dueLabel(iso: string, tz: string, now: Date = new Date()): { label: string; tone: "overdue" | "soon" | "later" } {
  const due = new Date(iso);
  const diff = daysBetween(todayIn(tz, now), utcToZoned(iso, tz).date);
  if (due < now && diff < 0) return { label: "Overdue", tone: "overdue" };
  if (diff <= 0) {
    const { time } = utcToZoned(iso, tz);
    return { label: time === "23:59" || time === "00:00" ? "Due today" : `Due today ${fmtTime(iso, tz)}`, tone: due < now ? "overdue" : "soon" };
  }
  if (diff === 1) return { label: "Due tomorrow", tone: "soon" };
  if (diff < 7) return { label: `Due ${fmt(iso, tz, { weekday: "short" })}`, tone: "later" };
  return { label: `Due ${fmt(iso, tz, { month: "short", day: "numeric" })}`, tone: "later" };
}

/** "5m ago", "3h ago", "Yesterday", "Mon", "Nov 3". */
export function receivedLabel(iso: string, tz: string, now: Date = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const diff = daysBetween(todayIn(tz, now), utcToZoned(iso, tz).date);
  if (diff === 0) return `${Math.round(mins / 60)}h ago`;
  if (diff === -1) return "Yesterday";
  if (diff > -7) return fmt(iso, tz, { weekday: "short" });
  return fmt(iso, tz, { month: "short", day: "numeric" });
}

export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];
