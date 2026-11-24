/**
 * Duplicate detection: the same field trip arrives as an email, a flyer photo
 * and a text message. Two records are "the same thing" when their dates overlap,
 * they're for compatible children, and their titles mean the same — with
 * school-calendar synonyms ("break" = "holiday" = "no school"). Pure functions.
 */
import { utcToZoned } from "@/lib/time";

const STOP = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "at", "is", "be", "your", "our", "with", "by", "from", "please", "reminder", "due", "school", "day", "days", "all", "students", "student", "class", "families", "family", "parents", "event", "test"]);

const SYNONYMS: [RegExp, string][] = [
  [/\bno school\b|\bschool closed\b|\bclosed\b|\bholiday\b|\bbreak\b|\bvacation\b|\bteacher work ?day\b|\bworkday\b|\bstaff development\b|\bprofessional (?:learning|development)\b/g, " closure "],
  [/\bearly (?:release|dismissal|out)\b|\bhalf[- ]day\b|\bminimum day\b/g, " earlyout "],
  [/\bpj'?s?\b|\bpajamas?\b/g, " pajama "],
  [/\bpictures?\b|\bphotos?\b|\bportraits?\b/g, " picture "],
  [/\bconferences?\b/g, " conference "],
  [/\bperformances?\b|\bconcerts?\b|\bshows?\b|\brecitals?\b/g, " performance "],
  [/\bfield ?trips?\b/g, " fieldtrip "],
  [/\bpermission (?:slips?|forms?)\b/g, " permission "],
  [/\bfees?\b|\bpayments?\b|\bbalance\b|\btuition\b/g, " payment "],
];

export function titleTokens(title: string): Set<string> {
  let t = title.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s'-]/gu, " ");
  for (const [re, word] of SYNONYMS) t = t.replace(re, word);
  return new Set(
    t
      .replace(/[-']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+(am|pm)?$/.test(w)) // times and numbers aren't meaning
      .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w)),
  );
}

/** 0..1: the better of Jaccard overlap and containment (when both titles have 2+ words). */
export function similarity(a: string, b: string): number {
  const A = titleTokens(a);
  const B = titleTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => B.has(t) && inter++);
  const jaccard = inter / (A.size + B.size - inter);
  const contain = Math.min(A.size, B.size) >= 2 ? inter / Math.min(A.size, B.size) : 0;
  return Math.max(jaccard, contain * 0.9);
}

export interface Comparable {
  id?: string;
  kind: string;
  category?: string | null;
  title: string;
  starts_at: string | null;
  ends_at?: string | null;
  due_at: string | null;
  child_id: string | null;
  school_id: string | null;
}

function range(x: Comparable, tz: string): [string, string] | null {
  if (x.starts_at) {
    const s = utcToZoned(x.starts_at, tz).date;
    const e = x.ends_at ? utcToZoned(x.ends_at, tz).date : s;
    return [s, e < s ? s : e];
  }
  if (x.due_at) {
    const d = utcToZoned(x.due_at, tz).date;
    return [d, d];
  }
  return null;
}

const DAY_EVENTS = new Set(["closure", "early_dismissal"]);

/** Score 0..1 that a and b describe the same thing (0 = definitely not). */
export function sameThingScore(a: Comparable, b: Comparable, tz: string): number {
  const tasks = Number(a.kind === "task") + Number(b.kind === "task");
  if (tasks === 1) return 0; // a to-do and an event aren't the same record
  if (a.child_id && b.child_id && a.child_id !== b.child_id) return 0;
  if (a.school_id && b.school_id && a.school_id !== b.school_id && !a.child_id && !b.child_id) return 0;
  const ra = range(a, tz);
  const rb = range(b, tz);
  const sim = similarity(a.title, b.title);
  if (!ra || !rb) return !ra && !rb && sim >= 0.8 ? sim : 0; // undated: only near-identical titles
  const overlap = ra[0] <= rb[1] && rb[0] <= ra[1];
  if (!overlap) return 0;
  const sameStart = ra[0] === rb[0];
  const catA = a.category ?? "general";
  const catB = b.category ?? "general";
  // Two closures (or early releases) on overlapping days are the same day off.
  if (DAY_EVENTS.has(catA) && catA === catB) return Math.max(sim, 0.85);
  if (catA !== "general" && catB !== "general" && catA !== catB && sim < 0.7) return 0;
  const threshold = sameStart ? 0.5 : 0.7; // different start days need stronger title agreement
  return sim >= threshold ? sim : 0;
}

/** Returns the id of the best matching existing record, or null. */
export function findDuplicate(c: Comparable, existing: Comparable[], tz: string): string | null {
  let best: { id: string; score: number } | null = null;
  for (const e of existing) {
    if (!e.id || e.id === c.id) continue;
    const score = sameThingScore(c, e, tz);
    if (score > 0 && (!best || score > best.score)) best = { id: e.id, score };
  }
  return best?.id ?? null;
}

/** Groups records describing the same thing (union-find). Returns groups of ids, largest first. */
export function clusterSame<T extends Comparable & { id: string }>(list: T[], tz: string): T[][] {
  const parent = new Map(list.map((x) => [x.id, x.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      if (sameThingScore(list[i], list[j], tz) > 0) parent.set(find(list[i].id), find(list[j].id));
  const groups = new Map<string, T[]>();
  for (const x of list) groups.set(find(x.id), [...(groups.get(find(x.id)) ?? []), x]);
  return [...groups.values()].sort((a, b) => b.length - a.length);
}
