import { describe, expect, it } from "vitest";
import { buildGroups, sectionFor, type Cand } from "@/lib/review-model";
import { zonedToUtc } from "@/lib/time";

const tz = "America/New_York";
const now = new Date("2026-11-24T15:00:00Z"); // Tue Nov 24, 10am ET
const c = (id: string, p: Partial<Cand>): Cand => ({ id, kind: "event", category: "general", title: "Thing", starts_at: null, ends_at: null, due_at: null, child_id: null, school_id: null, duplicate_of: null, needs_review: false, amount_cents: null, ...p });

describe("triage", () => {
  it("puts past-due bills and near deadlines first", () => {
    expect(sectionFor(c("1", { kind: "task", category: "payment", due_at: zonedToUtc("2026-11-10", "23:59", tz) }), tz, now)).toEqual({ section: "attention", flag: "Past due payment" });
    expect(sectionFor(c("2", { kind: "task", due_at: zonedToUtc("2026-11-25", "23:59", tz) }), tz, now)).toEqual({ section: "attention", flag: "Due tomorrow" });
    expect(sectionFor(c("3", { kind: "task", due_at: zonedToUtc("2026-12-15", "23:59", tz) }), tz, now).section).toBe("upcoming");
    expect(sectionFor(c("4", { category: "closure", starts_at: zonedToUtc("2026-11-25", null, tz) }), tz, now)).toEqual({ section: "attention", flag: "Tomorrow" });
  });
  it("past events are set aside, ongoing ones are not", () => {
    expect(sectionFor(c("5", { starts_at: zonedToUtc("2026-11-02", null, tz) }), tz, now).section).toBe("past");
    expect(sectionFor(c("6", { starts_at: zonedToUtc("2026-11-23", null, tz), ends_at: zonedToUtc("2026-11-27", null, tz) }), tz, now).section).toBe("upcoming");
  });
  it("groups the email and the photo of the same event into one card", () => {
    const g = buildGroups([
      c("email", { title: "Winter Concert grades K-2", category: "activity", starts_at: zonedToUtc("2026-12-14", "18:00", tz) }),
      c("photo", { title: "Winter Performance K-2", category: "activity", starts_at: zonedToUtc("2026-12-14", "18:00", tz), needs_review: true }),
      c("bill", { kind: "task", category: "payment", title: "Lunch balance", due_at: zonedToUtc("2026-11-20", "23:59", tz) }),
    ], tz, now);
    expect(g[0].primary.id).toBe("bill");
    const concert = g.find((x) => x.primary.id === "email")!;
    expect(concert.members.map((m) => m.id)).toEqual(["photo"]);
  });
});
