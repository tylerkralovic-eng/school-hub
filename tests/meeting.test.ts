import { describe, expect, it } from "vitest";
import { meetingIcs, meetingWindow, nextMeetingDate, upcomingMeetingDates } from "@/lib/meeting/schedule";
import { VALUES, nextValue, pickValue } from "@/lib/meeting/values";
import { rewardProgressFor } from "@/lib/meeting/progress";

describe("family meeting schedule", () => {
  it("finds the next Sunday (today counts)", () => {
    expect(nextMeetingDate("2026-11-24", 0)).toBe("2026-11-29"); // Tue → Sun
    expect(nextMeetingDate("2026-11-29", 0)).toBe("2026-11-29");
    expect(upcomingMeetingDates("2026-11-24", 0, 3)).toEqual(["2026-11-29", "2026-12-06", "2026-12-13"]);
  });
  it("7pm in the family's time zone", () => {
    const w = meetingWindow("2026-11-29", { day: 0, time: "19:00", duration_min: 30 }, "America/Chicago");
    expect(w.start).toBe("2026-11-30T01:00:00.000Z");
    expect(w.end).toBe("2026-11-30T01:30:00.000Z");
  });
  it("one recurring event for other calendars", () => {
    const ics = meetingIcs({ familyId: "f1", familyName: "Smith, Family", tz: "America/Chicago", firstDate: "2026-11-29", settings: { day: 0, time: "19:00", duration_min: 30 }, deckUrl: "https://x.test/meeting", host: "x.test", now: new Date("2026-11-24T00:00:00Z") });
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU");
    expect(ics).toContain("DTSTART;TZID=America/Chicago:20261129T190000");
    expect(ics).toContain("DTEND;TZID=America/Chicago:20261129T193000");
    expect(ics).toContain("SUMMARY:Smith\\, Family family meeting");
  });
});

describe("value of the week", () => {
  it("rotates weekly and skips recent ones", () => {
    const a = pickValue("2026-11-29");
    const b = pickValue("2026-12-06");
    expect(a.key).not.toBe(b.key);
    expect(pickValue("2026-11-29", [a.key]).key).not.toBe(a.key);
    expect(nextValue(VALUES.at(-1)!.key).key).toBe(VALUES[0].key);
    expect(new Set(VALUES.map((v) => v.key)).size).toBe(VALUES.length);
  });
});

describe("prize progress at the meeting", () => {
  it("weekly prize counts the school week before a Sunday meeting", () => {
    const entries = [
      { child_id: "e", day: "2026-11-23", level_key: "purple", count: null, points: 3 },
      { child_id: "e", day: "2026-11-27", level_key: "white", count: null, points: 1 },
      { child_id: "e", day: "2026-11-20", level_key: "white", count: null, points: 1 },
    ];
    expect(rewardProgressFor({ child_id: "e", horizon: "week", points_goal: 4, starts_on: "2026-11-01" }, entries, "2026-11-29")).toMatchObject({ pts: 4, done: true });
    expect(rewardProgressFor({ child_id: "e", horizon: "big", points_goal: 10, starts_on: "2026-11-01" }, entries, "2026-11-29")).toMatchObject({ pts: 5, pct: 50 });
  });
});
