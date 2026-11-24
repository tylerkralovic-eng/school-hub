/**
 * Turns pending review items into a calm, triaged list: grouped duplicates
 * (same thing from several sources) and sections by urgency. Pure.
 */
import { clusterSame } from "@/lib/pipeline/dedupe";
import { addDays, daysBetween, todayIn, utcToZoned, zonedToUtc } from "@/lib/time";

export type Section = "attention" | "upcoming" | "undated" | "known" | "past";
export const SECTION_INFO: Record<Section, { title: string; hint: string; defaultOn: boolean }> = {
  attention: { title: "Needs attention", hint: "Past due or coming up in the next few days", defaultOn: true },
  upcoming: { title: "Coming up", hint: "Dates ahead", defaultOn: true },
  undated: { title: "Good to know", hint: "No specific date", defaultOn: true },
  known: { title: "Already in School Hub", hint: "Will be linked as another source, not added twice", defaultOn: true },
  past: { title: "Already happened", hint: "Not added unless you tick them", defaultOn: false },
};
export const SECTION_ORDER: Section[] = ["attention", "upcoming", "undated", "known", "past"];

export interface Cand {
  id: string;
  kind: string;
  category: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  due_at: string | null;
  child_id: string | null;
  school_id: string | null;
  duplicate_of: string | null;
  needs_review: boolean;
  amount_cents: number | null;
}

export function sectionFor(c: Cand, tz: string, now = new Date()): { section: Section; flag: string | null } {
  if (c.duplicate_of) return { section: "known", flag: null };
  const today = todayIn(tz, now);
  const day = (iso: string) => utcToZoned(iso, tz).date;
  if (c.kind === "task") {
    if (!c.due_at) return { section: c.category === "payment" ? "attention" : "undated", flag: c.category === "payment" ? "Payment" : null };
    const d = daysBetween(today, day(c.due_at));
    if (d < 0) return { section: "attention", flag: c.category === "payment" ? "Past due payment" : "Past due" };
    if (d <= 3 || (c.category === "payment" && d <= 7)) return { section: "attention", flag: d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : `Due in ${d} days` };
    return { section: "upcoming", flag: null };
  }
  const start = c.starts_at;
  if (!start) return { section: "undated", flag: null };
  const end = c.ends_at ?? start;
  if (day(end) < today) return { section: "past", flag: null };
  const d = daysBetween(today, day(start));
  if (d <= 2 && (c.category === "closure" || c.category === "early_dismissal")) return { section: "attention", flag: d <= 0 ? "Today" : d === 1 ? "Tomorrow" : "In 2 days" };
  return { section: "upcoming", flag: null };
}

export interface Group<T extends Cand> { primary: T; members: T[]; section: Section; flag: string | null }

/** Groups same-thing candidates, picks the most complete as primary, assigns sections, sorts. */
export function buildGroups<T extends Cand>(cands: T[], tz: string, now = new Date()): Group<T>[] {
  const fresh = cands.filter((c) => !c.duplicate_of);
  const known = cands.filter((c) => c.duplicate_of);
  const clusters = clusterSame(fresh, tz);
  // Candidates matching the same existing item are one group too.
  const byExisting = new Map<string, T[]>();
  for (const k of known) byExisting.set(k.duplicate_of!, [...(byExisting.get(k.duplicate_of!) ?? []), k]);
  const score = (c: T) => (c.needs_review ? 0 : 4) + (c.starts_at || c.due_at ? 2 : 0) + (c.title.length > 8 ? 1 : 0);
  const groups = [...clusters, ...byExisting.values()].map((g) => {
    const primary = [...g].sort((a, b) => score(b) - score(a))[0];
    const { section, flag } = sectionFor(primary, tz, now);
    return { primary, members: g.filter((x) => x !== primary), section, flag };
  });
  const key = (g: Group<T>) => g.primary.due_at ?? g.primary.starts_at ?? "9999";
  return groups.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || (a.section === "past" ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b))));
}

export { addDays, zonedToUtc };
