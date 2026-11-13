import { describe, expect, it } from "vitest";
import { findDuplicate, similarity } from "@/lib/pipeline/dedupe";
import { normalizeItems, type Roster } from "@/lib/pipeline/normalize";
import { ExtractionSchema, type ExtractedItem } from "@/lib/pipeline/schema";
import { dueLabel, utcToZoned, zonedToUtc } from "@/lib/time";

const roster: Roster = {
  timezone: "America/New_York",
  children: [
    { id: "kid-e", first_name: "Everley", school_id: "sch-elem", aliases: ["Ms. Lopez"] },
    { id: "kid-a", first_name: "Adler", school_id: "sch-pre", aliases: [] },
  ],
  schools: [
    { id: "sch-elem", name: "Maple Elementary" },
    { id: "sch-pre", name: "Little Oaks" },
  ],
};
const hints = { receivedDate: "2026-11-13" };

function item(p: Partial<ExtractedItem>): ExtractedItem {
  return {
    kind: "event", category: "general", title: "Thing", details: null, date: "2026-11-20", start_time: null, end_date: null, end_time: null,
    location: null, amount_usd: null, applies_to: "school", child_id: null, school_id: "sch-elem", evidence: "quote", confidence: "high", uncertainty: null, ...p,
  };
}

describe("time zones", () => {
  it("converts wall-clock to UTC across DST", () => {
    expect(zonedToUtc("2026-11-20", "08:00", "America/New_York")).toBe("2026-11-20T13:00:00.000Z"); // EST
    expect(zonedToUtc("2026-07-01", "08:00", "America/New_York")).toBe("2026-07-01T12:00:00.000Z"); // EDT
    expect(zonedToUtc("2026-03-08", "03:30", "America/Chicago")).toBe("2026-03-08T08:30:00.000Z"); // day DST starts
    expect(utcToZoned("2026-11-20T13:00:00.000Z", "America/New_York")).toEqual({ date: "2026-11-20", time: "08:00" });
  });
  it("labels due dates", () => {
    const now = new Date("2026-11-13T15:00:00Z");
    expect(dueLabel("2026-11-14T04:59:00Z", "America/New_York", now).label).toBe("Due today");
    expect(dueLabel("2026-11-12T15:00:00Z", "America/New_York", now).label).toBe("Overdue");
    expect(dueLabel("2026-11-15T04:59:00Z", "America/New_York", now).label).toBe("Due tomorrow");
  });
});

describe("normalizeItems", () => {
  it("creates timed and all-day events in the family time zone", () => {
    const [timed, allDay] = normalizeItems([item({ title: "Book fair", start_time: "15:30" }), item({ title: "No school", category: "closure" })], roster, hints);
    expect(timed.starts_at).toBe("2026-11-20T20:30:00.000Z");
    expect(timed.all_day).toBe(false);
    expect(allDay.all_day).toBe(true);
    expect(allDay.school_id).toBe("sch-elem");
    expect(timed.needs_review).toBe(false);
  });

  it("never invents a missing date — flags it instead", () => {
    const [c] = normalizeItems([item({ date: null, title: "Picture day" })], roster, hints);
    expect(c.starts_at).toBeNull();
    expect(c.needs_review).toBe(true);
    expect(c.review_reason).toMatch(/No date/);
  });

  it("rejects unknown child ids and asks which child", () => {
    const [c] = normalizeItems([item({ applies_to: "child", child_id: "made-up", school_id: null })], roster, hints);
    expect(c.child_id).toBeNull();
    expect(c.needs_review).toBe(true);
    expect(c.review_reason).toMatch(/Which child/);
  });

  it("uses the child the parent assigned when the AI is unsure", () => {
    const [c] = normalizeItems([item({ applies_to: "unknown", school_id: null })], roster, { ...hints, childId: "kid-a" });
    expect(c.child_id).toBe("kid-a");
    expect(c.school_id).toBe("sch-pre");
    expect(c.needs_review).toBe(false);
  });

  it("tasks get end-of-day deadlines and money in cents", () => {
    const [t] = normalizeItems([item({ kind: "task", category: "payment", title: "Field trip fee", amount_usd: 12.5, applies_to: "child", child_id: "kid-e" })], roster, hints);
    expect(t.due_at).toBe(zonedToUtc("2026-11-20", "23:59", "America/New_York"));
    expect(t.amount_cents).toBe(1250);
    expect(t.child_id).toBe("kid-e");
  });

  it("flags invalid dates, low confidence and implausible years", () => {
    const r = normalizeItems([item({ date: "2026-02-30" }), item({ title: "B", confidence: "low" }), item({ title: "C", date: "2028-11-20" })], roster, hints);
    expect(r.every((c) => c.needs_review)).toBe(true);
  });

  it("drops exact repeats within one document", () => {
    expect(normalizeItems([item({}), item({})], roster, hints)).toHaveLength(1);
  });

  it("moves dated closure announcements onto the calendar", () => {
    const [c] = normalizeItems([item({ kind: "announcement", category: "closure", title: "School closed" })], roster, hints);
    expect(c.kind).toBe("event");
    expect(c.starts_at).not.toBeNull();
  });

  it("validates the AI contract", () => {
    expect(ExtractionSchema.safeParse({ is_school_related: true, document_type: "calendar", summary: "x", items: [item({})] }).success).toBe(true);
    expect(ExtractionSchema.safeParse({ is_school_related: true, document_type: "calendar", summary: "x", items: [{ ...item({}), kind: "party" }] }).success).toBe(false);
  });
});

describe("dedupe", () => {
  const tz = "America/New_York";
  const existing = [
    { id: "i1", kind: "event", title: "Field Trip to the Nature Center", starts_at: zonedToUtc("2026-11-20", "09:00", tz), due_at: null, child_id: "kid-e", school_id: "sch-elem" },
    { id: "i2", kind: "task", title: "Return permission slip", starts_at: null, due_at: zonedToUtc("2026-11-18", "23:59", tz), child_id: null, school_id: "sch-elem" },
  ];
  it("scores similar titles", () => {
    expect(similarity("Nature Center field trip", "Field Trip to the Nature Center")).toBeGreaterThan(0.7);
    expect(similarity("Book fair", "Picture day")).toBe(0);
  });
  it("finds the same event on the same day", () => {
    expect(findDuplicate({ kind: "event", title: "Nature center field trip!", starts_at: zonedToUtc("2026-11-20", null, tz), due_at: null, child_id: null, school_id: null }, existing, tz)).toBe("i1");
  });
  it("ignores different days, different children and different kinds", () => {
    expect(findDuplicate({ kind: "event", title: "Field trip nature center", starts_at: zonedToUtc("2026-11-21", null, tz), due_at: null, child_id: null, school_id: null }, existing, tz)).toBeNull();
    expect(findDuplicate({ kind: "event", title: "Field trip nature center", starts_at: zonedToUtc("2026-11-20", null, tz), due_at: null, child_id: "kid-a", school_id: null }, existing, tz)).toBeNull();
    expect(findDuplicate({ kind: "event", title: "Return permission slip", starts_at: zonedToUtc("2026-11-18", null, tz), due_at: null, child_id: null, school_id: null }, existing, tz)).toBeNull();
  });
  it("matches tasks by due day", () => {
    expect(findDuplicate({ kind: "task", title: "Permission slips due", starts_at: null, due_at: zonedToUtc("2026-11-18", "08:00", tz), child_id: null, school_id: null }, existing, tz)).toBe("i2");
  });
});
