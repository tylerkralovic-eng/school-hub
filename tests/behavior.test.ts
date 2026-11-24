import { describe, expect, it } from "vitest";
import { checkInDue, choiceFor, choicesFor, currentStreak, isGoodDay, normalizeColor, schoolWeek, strokeFor, streakLabel, sumPoints, weekdaysBetween, type TrackingSystem } from "@/lib/behavior";

const stars: TrackingSystem = {
  child_id: "e", name: "Star chart", kind: "levels", count_max: null, count_unit: null, check_in_time: "14:30",
  levels: [
    { key: "purple", label: "Purple", color: "#a855f7", meaning: "Superb day", points: 3 },
    { key: "white", label: "White", color: "white", meaning: "Normal good day", points: 2 },
    { key: "yellow", label: "Yellow", color: "yellow", meaning: "Talked to a few times", points: 1 },
    { key: "red", label: "Red", color: "red", meaning: "Rough day", points: 0 },
  ],
};
const skittles: TrackingSystem = { child_id: "a", name: "Skittles", kind: "count", levels: [], count_max: 3, count_unit: "Skittles", check_in_time: "14:50" };

describe("behavior systems", () => {
  it("colors are readable", () => {
    expect(normalizeColor("White")).toBe("#ffffff");
    expect(strokeFor("#ffffff")).toBe("#64748b");
    expect(strokeFor("#a855f7")).toBe("#a855f7");
    expect(normalizeColor("not a color")).toBe("#94a3b8");
  });
  it("lists choices best first with a 0..1 ratio", () => {
    expect(choicesFor(stars).map((c) => [c.key, c.ratio])).toEqual([["purple", 1], ["white", 2 / 3], ["yellow", 1 / 3], ["red", 0]]);
    expect(choicesFor(skittles).map((c) => c.key)).toEqual(["3", "2", "1", "0"]);
    expect(choiceFor(skittles, { level_key: null, count: 2 })?.points).toBe(2);
  });
  it("good days and streaks follow each school's system", () => {
    expect(isGoodDay(stars, { level_key: "white", count: null })).toBe(true);
    expect(isGoodDay(stars, { level_key: "yellow", count: null })).toBe(false);
    expect(isGoodDay(skittles, { level_key: null, count: 2 })).toBe(false);
    expect(streakLabel(stars)).toBe("white-or-better days in a row");
    expect(streakLabel(skittles)).toBe("perfect days in a row");
    const e = (day: string, count: number) => ({ child_id: "a", day, level_key: null, count, points: count });
    expect(currentStreak(skittles, [e("2026-11-20", 3), e("2026-11-19", 3), e("2026-11-16", 3), e("2026-11-13", 2), e("2026-11-12", 3)])).toBe(3);
  });
  it("weeks, weekdays and points", () => {
    expect(schoolWeek("2026-11-22")).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]); // Sunday → past week
    expect(schoolWeek("2026-11-18")[0]).toBe("2026-11-16");
    expect(weekdaysBetween("2026-11-01", "2026-11-20")).toHaveLength(15);
    expect(sumPoints([{ child_id: "a", day: "2026-11-02", level_key: null, count: 3, points: 3 }, { child_id: "a", day: "2026-10-30", level_key: null, count: 3, points: 3 }], "a", "2026-11-01", "2026-11-30")).toBe(3);
  });
  it("asks after pick-up on school days only", () => {
    expect(checkInDue(stars, "2026-11-20", "14:29", false)).toBe(false);
    expect(checkInDue(stars, "2026-11-20", "14:31", false)).toBe(true);
    expect(checkInDue(stars, "2026-11-20", "15:00", true)).toBe(false);
    expect(checkInDue(stars, "2026-11-21", "15:00", false)).toBe(false); // Saturday
  });
});

import { heuristicParse } from "@/lib/behavior-ai";
describe("understanding a description without AI", () => {
  it("handles the Kralovic example", () => {
    const r = heuristicParse(
      "Everley's school tracks stars each day. Normal day is white star, Yellow is had to be talked to a few times, red is bad, purple is superb day. Adler's tracks skittles. They leave school with 3 skittles unless they get in trouble. 3 is best, 0 is really bad.",
      [{ first_name: "Everley" }, { first_name: "Adler" }],
    );
    const e = r.systems.find((s) => s.child_name === "Everley")!;
    expect(e.kind).toBe("levels");
    expect(e.levels.map((l) => l.label)).toEqual(["Purple", "White", "Yellow", "Red"]);
    const a = r.systems.find((s) => s.child_name === "Adler")!;
    expect(a).toMatchObject({ kind: "count", count_max: 3, count_unit: "Skittles" });
  });
});

import { countPointsMap, formatPoints, withWorstPenalty } from "@/lib/behavior";
describe("negative points", () => {
  it("rough days can cost points, for levels and counts", () => {
    const e = withWorstPenalty(stars, 2);
    expect(e.levels.map((l) => l.points)).toEqual([3, 2, 1, -2]);
    const a = withWorstPenalty(skittles, 2);
    expect(choicesFor(a).map((c) => [c.key, c.points])).toEqual([["3", 3], ["2", 2], ["1", 1], ["0", -2]]);
    expect(withWorstPenalty(a, 0).count_points!["0"]).toBe(0);
  });
  it("totals go below zero and points read naturally", () => {
    const entries = [{ child_id: "a", day: "2026-11-02", level_key: null, count: 0, points: -2 }, { child_id: "a", day: "2026-11-03", level_key: null, count: 0, points: -2 }];
    expect(sumPoints(entries, "a", "2026-11-01", "2026-11-30")).toBe(-4);
    expect(formatPoints(3)).toBe("+3");
    expect(formatPoints(-2)).toBe("−2");
    expect(countPointsMap(3, { "0": -50 })["0"]).toBe(-10); // clamped
  });
});

describe("setup understands penalties and notices when points weren't given", () => {
  const kids = [{ first_name: "Everley" }, { first_name: "Adler" }];
  it("asks when no points were said", () => {
    const r = heuristicParse("Everley gets stars: white is normal, yellow talked to, red is bad, purple superb. Adler keeps 3 skittles, 3 is best.", kids);
    expect(r.systems.every((s) => s.points_stated === false)).toBe(true);
  });
  it("applies 'minus 2' to each child's worst outcome", () => {
    const r = heuristicParse("Everley gets stars: purple superb, white normal, yellow talked to, red bad. Adler keeps 3 skittles. Red star or 0 skittles is minus 2 points.", kids);
    expect(r.systems.find((s) => s.child_name === "Everley")!.levels.map((l) => l.points)).toEqual([3, 1, 0, -2]); // purple "superb" → exceptional; red overridden by the stated penalty
    expect(r.systems.find((s) => s.child_name === "Everley")!.levels.at(-1)).toMatchObject({ label: "Red", points: -2 });
    expect(r.systems.find((s) => s.child_name === "Adler")!.count_points).toEqual([{ count: 0, points: -2 }]);
    expect(r.systems.every((s) => s.points_stated)).toBe(true);
  });
});

import { parseTrackingDescription } from "@/lib/behavior-ai";
describe("balanced rubric (like-for-like points)", () => {
  it("turns the Kralovic description into the same scale they chose by hand", async () => {
    const kids = [{ id: "e", first_name: "Everley" }, { id: "a", first_name: "Adler" }];
    const r = await parseTrackingDescription(
      "Everley's school tracks stars each day. Normal day is white star, yellow is had to be talked to a few times, red is bad, purple is superb day (rare). Adler's tracks skittles. They leave school with 3 skittles unless they get in trouble. 3 is best, 0 is really bad.",
      kids,
    );
    const e = r.find((s) => s.child_name === "Everley")!;
    expect(Object.fromEntries(e.levels.map((l) => [l.label, l.points]))).toEqual({ Purple: 3, White: 1, Yellow: 0, Red: -2 });
    expect(e.tiers).toMatchObject({ purple: "exceptional", white: "good", yellow: "issues", red: "rough" });
    const a = r.find((s) => s.child_name === "Adler")!;
    expect(a.count_points).toEqual({ "0": -2, "1": 0, "2": 1, "3": 1 });
    expect(r.every((s) => s.points_stated === false)).toBe(true);
  });
});
