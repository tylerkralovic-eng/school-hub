/**
 * Turns validated AI output into review candidates: converts wall-clock dates
 * to UTC in the family's time zone, resolves children/schools strictly against
 * the roster, and flags anything uncertain for parent review. Pure function.
 */
import { addDays, daysBetween, isValidDate, isValidTime, zonedToUtc } from "@/lib/time";
import type { ExtractedItem } from "@/lib/pipeline/schema";

export interface Roster {
  timezone: string;
  children: { id: string; first_name: string; school_id: string | null; aliases: string[] }[];
  schools: { id: string; name: string }[];
}

export interface DocHints {
  childId?: string | null;
  schoolId?: string | null;
  receivedDate: string; // YYYY-MM-DD in family tz
}

export interface CandidateDraft {
  kind: "event" | "task" | "announcement";
  category: ExtractedItem["category"];
  title: string;
  details: string | null;
  child_id: string | null;
  school_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  due_at: string | null;
  location: string | null;
  amount_cents: number | null;
  evidence: string | null;
  needs_review: boolean;
  review_reason: string | null;
}

const clip = (s: string | null | undefined, n: number) => (s ? s.trim().slice(0, n) || null : null);

export function normalizeItems(items: ExtractedItem[], roster: Roster, hints: DocHints): CandidateDraft[] {
  const seen = new Set<string>();
  const out: CandidateDraft[] = [];

  for (const it of items) {
    const reasons: string[] = [];
    const title = clip(it.title, 200);
    if (!title) continue;

    // ---- who
    let childId: string | null = null;
    let schoolId: string | null = null;
    const child = it.child_id ? roster.children.find((c) => c.id === it.child_id) : undefined;
    const school = it.school_id ? roster.schools.find((s) => s.id === it.school_id) : undefined;
    const hintChild = hints.childId ? roster.children.find((c) => c.id === hints.childId) : undefined;
    const hintSchool = hints.schoolId ? roster.schools.find((s) => s.id === hints.schoolId) : undefined;

    if (it.applies_to === "child" && child) {
      childId = child.id;
      schoolId = child.school_id;
    } else if (it.applies_to === "school" && school) {
      schoolId = school.id;
    } else if (it.applies_to === "family") {
      // whole family: no child/school
    } else if (hintChild) {
      childId = hintChild.id;
      schoolId = hintChild.school_id;
    } else if (hintSchool) {
      schoolId = hintSchool.id;
    } else if (school) {
      schoolId = school.id;
    } else {
      reasons.push("Which child is this for?");
    }

    // ---- when
    const tz = roster.timezone;
    const date = isValidDate(it.date) ? it.date : null;
    const startTime = isValidTime(it.start_time) ? it.start_time : null;
    const endDate = isValidDate(it.end_date) ? it.end_date : null;
    const endTime = isValidTime(it.end_time) ? it.end_time : null;
    if (it.date && !date) reasons.push(`Unreadable date "${it.date}"`);

    let kind = it.kind;
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    let dueAt: string | null = null;
    let allDay = false;

    if (date && Math.abs(daysBetween(hints.receivedDate, date)) > 400) reasons.push("Date looks far from when this was received — check the year");

    if (kind === "event") {
      if (!date) reasons.push("No date found — add one or uncheck this item");
      else {
        allDay = !startTime;
        startsAt = zonedToUtc(date, startTime, tz);
        if (endDate || endTime) {
          const ed = endDate ?? date;
          const candidate = zonedToUtc(allDay ? ed : ed, endTime, tz);
          // all-day multi-day events end at the start of their last day (displayed inclusive)
          if (candidate >= startsAt) endsAt = candidate;
        }
      }
    } else if (kind === "task") {
      if (date) dueAt = zonedToUtc(date, startTime ?? "23:59", tz);
      // announcements with an event date are often better as events, but keep the model's call
    } else if (kind === "announcement" && date && it.category !== "general") {
      // Closures / early dismissals described as announcements belong on the calendar.
      if (it.category === "closure" || it.category === "early_dismissal") {
        kind = "event";
        allDay = !startTime;
        startsAt = zonedToUtc(date, startTime, tz);
        if (endDate && endDate > date) endsAt = zonedToUtc(endDate, null, tz);
      }
    }

    if (it.confidence === "low") reasons.push("The AI wasn't confident about this one");
    if (it.uncertainty) reasons.push(clip(it.uncertainty, 200)!);

    const amount = typeof it.amount_usd === "number" && isFinite(it.amount_usd) && it.amount_usd >= 0 && it.amount_usd < 100000 ? Math.round(it.amount_usd * 100) : null;

    // Drop exact repeats within one document (e.g. same event printed twice).
    const key = `${kind}|${title.toLowerCase()}|${date ?? ""}|${startTime ?? ""}|${childId ?? schoolId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      kind,
      category: it.category,
      title,
      details: clip(it.details, 4000),
      child_id: childId,
      school_id: schoolId,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: allDay,
      due_at: dueAt,
      location: clip(it.location, 200),
      amount_cents: amount,
      evidence: clip(it.evidence, 600),
      needs_review: reasons.length > 0,
      review_reason: reasons.length ? [...new Set(reasons)].join(" · ") : null,
    });
  }
  return out;
}

export { addDays };
