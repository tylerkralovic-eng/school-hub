import { describe, expect, it } from "vitest";
import { clusterSame, findDuplicate, sameThingScore, similarity } from "@/lib/pipeline/dedupe";
import { zonedToUtc } from "@/lib/time";

const tz = "America/New_York";
const ev = (id: string, title: string, date: string, extra: Record<string, unknown> = {}) => ({ id, kind: "event", category: "general", title, starts_at: zonedToUtc(date, null, tz), ends_at: null, due_at: null, child_id: null, school_id: "s1", ...extra });

describe("smarter duplicates", () => {
  it("understands school-calendar synonyms", () => {
    expect(similarity("Thanksgiving Break", "No School - Thanksgiving Holiday")).toBeGreaterThanOrEqual(0.5);
    expect(similarity("Early Release 12:30", "Early dismissal")).toBeGreaterThanOrEqual(0.5);
    expect(similarity("PJ Day", "Pajama Day!")).toBe(1);
    expect(similarity("Book fair", "Picture day")).toBe(0);
  });

  it("matches the email and the photo of the same event", () => {
    const fromEmail = ev("a", "Winter Concert (grades K-2)", "2026-12-14", { category: "activity" });
    const fromPhoto = ev("b", "Winter Performance – K-2", "2026-12-14", { category: "activity" });
    expect(findDuplicate(fromPhoto, [fromEmail], tz)).toBe("a");
  });

  it("treats overlapping closures as the same day off, even with different titles", () => {
    const week = ev("w", "Thanksgiving Break", "2026-11-23", { category: "closure", ends_at: zonedToUtc("2026-11-27", null, tz), all_day: true });
    const note = ev("n", "No school Wednesday", "2026-11-25", { category: "closure" });
    expect(sameThingScore(week, note, tz)).toBeGreaterThan(0);
  });

  it("keeps different things apart", () => {
    expect(sameThingScore(ev("a", "Picture day", "2026-12-01"), ev("b", "Picture day", "2026-12-08"), tz)).toBe(0); // different days
    expect(sameThingScore(ev("a", "Field trip", "2026-12-01", { child_id: "e" }), ev("b", "Field trip", "2026-12-01", { child_id: "a" }), tz)).toBe(0); // different kids
    const task = { id: "t", kind: "task", category: "payment", title: "Field trip fee", starts_at: null, due_at: zonedToUtc("2026-12-01", "23:59", tz), child_id: null, school_id: "s1" };
    expect(sameThingScore(ev("a", "Field trip", "2026-12-01"), task, tz)).toBe(0); // to-do vs event
  });

  it("clusters several sources into one", () => {
    const groups = clusterSame([
      ev("1", "Early Release", "2026-12-09", { category: "early_dismissal" }),
      ev("2", "Early dismissal 12:30", "2026-12-09", { category: "early_dismissal" }),
      ev("3", "Half day", "2026-12-09", { category: "early_dismissal" }),
      ev("4", "Book Fair", "2026-12-09"),
    ], tz);
    expect(groups[0].map((x) => x.id).sort()).toEqual(["1", "2", "3"]);
    expect(groups).toHaveLength(2);
  });
});
