/**
 * Behavior tracking: works with whatever system a school uses (colored stars,
 * Skittles kept, clip charts…). Two shapes cover them: ordered LEVELS (best
 * first) or a COUNT out of a max. Pure functions — easy to test.
 */
import { addDays } from "@/lib/time";

export interface Level { key: string; label: string; color: string; meaning: string; points: number }
export interface TrackingSystem {
  id?: string;
  child_id: string;
  name: string;
  kind: "levels" | "count";
  levels: Level[];
  count_max: number | null;
  count_unit: string | null;
  check_in_time: string | null; // "HH:MM" or "HH:MM:SS"
}
export interface Entry { child_id: string; day: string; level_key: string | null; count: number | null; points: number; note?: string | null }

export interface Choice { key: string; label: string; color: string; stroke: string; points: number; ratio: number; meaning: string }

const HEX = /^#[0-9a-f]{6}$/i;
const NAMED: Record<string, string> = {
  white: "#ffffff", yellow: "#facc15", gold: "#eab308", red: "#dc2626", purple: "#a855f7", green: "#16a34a", blue: "#2563eb",
  orange: "#f97316", pink: "#ec4899", black: "#1e293b", gray: "#94a3b8", grey: "#94a3b8", silver: "#cbd5e1", brown: "#92400e",
};

export function normalizeColor(c: string | null | undefined, fallback = "#94a3b8"): string {
  if (!c) return fallback;
  const v = c.trim().toLowerCase();
  if (HEX.test(v)) return v;
  return NAMED[v] ?? fallback;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Outline color so light fills (a white star) stay visible on white. */
export function strokeFor(fill: string): string {
  return luminance(fill) > 0.6 ? "#64748b" : fill;
}

/** Color for a count, from rough (red) to best (teal). */
export function countColor(n: number, max: number): string {
  const r = max ? n / max : 0;
  return r >= 1 ? "#0f766e" : r >= 0.66 ? "#d97706" : r > 0 ? "#ea580c" : "#dc2626";
}

/** All choices for a check-in, best first. */
export function choicesFor(s: TrackingSystem): Choice[] {
  if (s.kind === "count") {
    const max = s.count_max ?? 3;
    return Array.from({ length: max + 1 }, (_, i) => max - i).map((n) => ({
      key: String(n), label: String(n), color: countColor(n, max), stroke: countColor(n, max), points: n, ratio: max ? n / max : 0,
      meaning: n === max ? "Best" : n === 0 ? "Rough day" : "",
    }));
  }
  const n = s.levels.length;
  return s.levels.map((l, i) => {
    const color = normalizeColor(l.color);
    return { key: l.key, label: l.label, color, stroke: strokeFor(color), points: l.points, ratio: n > 1 ? (n - 1 - i) / (n - 1) : 1, meaning: l.meaning };
  });
}

export function choiceFor(s: TrackingSystem, e: Pick<Entry, "level_key" | "count">): Choice | undefined {
  const key = s.kind === "count" ? (e.count == null ? null : String(e.count)) : e.level_key;
  return choicesFor(s).find((c) => c.key === key);
}

/** A "good day" for streaks: count systems need a perfect day; level systems the better half. */
export function isGoodDay(s: TrackingSystem, e: Pick<Entry, "level_key" | "count">): boolean {
  if (s.kind === "count") return e.count != null && e.count >= (s.count_max ?? 3);
  const idx = s.levels.findIndex((l) => l.key === e.level_key);
  return idx >= 0 && idx < Math.ceil(s.levels.length / 2);
}

export function streakLabel(s: TrackingSystem): string {
  if (s.kind === "count") return "perfect days in a row";
  const half = s.levels.slice(0, Math.ceil(s.levels.length / 2));
  const worstGood = half.at(-1)?.label.toLowerCase();
  return worstGood ? `${worstGood}-or-better days in a row` : "good days in a row";
}

/** Consecutive good days, most recent first. Days without an entry (weekends, no school) don't break it. */
export function currentStreak(s: TrackingSystem, entries: Entry[]): number {
  const sorted = entries.filter((e) => e.child_id === s.child_id).sort((a, b) => b.day.localeCompare(a.day));
  let n = 0;
  for (const e of sorted) {
    if (!isGoodDay(s, e)) break;
    n++;
  }
  return n;
}

export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun … 6 Sat
}

/** Monday..Friday of the week containing `date`. */
export function schoolWeek(date: string): string[] {
  const dow = weekday(date);
  const monday = addDays(date, dow === 0 ? -6 : 1 - dow);
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

/** Weekdays from `from` to `to` inclusive. */
export function weekdaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) if (weekday(d) % 6 !== 0) out.push(d);
  return out;
}

export function sumPoints(entries: Entry[], childId: string, from: string, to: string): number {
  return entries.filter((e) => e.child_id === childId && e.day >= from && e.day <= to).reduce((n, e) => n + e.points, 0);
}

export function monthStart(date: string): string {
  return `${date.slice(0, 8)}01`;
}

/** Is it time to ask about today? School days after the check-in time. */
export function checkInDue(s: TrackingSystem, today: string, nowTime: string, hasEntry: boolean): boolean {
  if (hasEntry || weekday(today) % 6 === 0) return false;
  const t = (s.check_in_time ?? "14:30").slice(0, 5);
  return nowTime >= t;
}
