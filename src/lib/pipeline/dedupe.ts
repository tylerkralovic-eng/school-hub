/**
 * Duplicate detection: the same field trip can arrive as an email, a flyer
 * photo and a text message. We compare against existing items on the same
 * local day with fuzzy title matching; matches become "add as another source"
 * suggestions the parent can override. Pure function.
 */
import { utcToZoned } from "@/lib/time";

const STOP = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "at", "is", "be", "your", "our", "with", "by", "from", "please", "day", "reminder", "due", "school"]);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t))
      .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t)),
  );
}

export function similarity(a: string, b: string): number {
  const A = titleTokens(a);
  const B = titleTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => B.has(t) && inter++);
  return inter / (A.size + B.size - inter);
}

export interface Comparable {
  id?: string;
  kind: string;
  title: string;
  starts_at: string | null;
  due_at: string | null;
  child_id: string | null;
  school_id: string | null;
}

function day(x: Comparable, tz: string): string | null {
  const t = x.starts_at ?? x.due_at;
  return t ? utcToZoned(t, tz).date : null;
}

/** Returns the id of the best matching existing item, or null. */
export function findDuplicate(c: Comparable, existing: Comparable[], tz: string): string | null {
  const cd = day(c, tz);
  let best: { id: string; score: number } | null = null;
  for (const e of existing) {
    if (!e.id) continue;
    const sameKind = e.kind === c.kind || (c.kind !== "task" && e.kind !== "task");
    if (!sameKind) continue;
    if (c.child_id && e.child_id && c.child_id !== e.child_id) continue;
    const ed = day(e, tz);
    if (cd !== ed) continue;
    const score = similarity(c.title, e.title);
    const threshold = cd ? 0.5 : 0.8; // undated items need a stronger title match
    if (score >= threshold && (!best || score > best.score)) best = { id: e.id, score };
  }
  return best?.id ?? null;
}
