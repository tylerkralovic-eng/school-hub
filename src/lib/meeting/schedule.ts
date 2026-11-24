/** Weekly family meeting schedule. Pure (no I/O). */
import { addDays, zonedToUtc } from "@/lib/time";
import { weekday } from "@/lib/behavior";

export interface MeetingSettings { day: number; time: string; duration_min: number }
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The next meeting date on or after `today`. */
export function nextMeetingDate(today: string, day: number): string {
  return addDays(today, (day - weekday(today) + 7) % 7);
}

/** The next `n` meeting dates starting on or after `today`. */
export function upcomingMeetingDates(today: string, day: number, n: number): string[] {
  const first = nextMeetingDate(today, day);
  return Array.from({ length: n }, (_, i) => addDays(first, i * 7));
}

/** Start/end in UTC for a meeting on `date`. */
export function meetingWindow(date: string, s: MeetingSettings, tz: string) {
  const start = zonedToUtc(date, s.time.slice(0, 5), tz);
  return { start, end: new Date(new Date(start).getTime() + s.duration_min * 60_000).toISOString() };
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/**
 * A single recurring event (RRULE) for adding the meeting to a work or personal
 * calendar without subscribing to the whole family feed.
 */
export function meetingIcs(opts: { familyId: string; familyName: string; tz: string; firstDate: string; settings: MeetingSettings; deckUrl: string; host: string; now?: Date }): string {
  const { settings: s } = opts;
  const local = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.slice(0, 5).replace(":", "")}00`;
  const endTime = (() => {
    const [h, m] = s.time.slice(0, 5).split(":").map(Number);
    const total = h * 60 + m + s.duration_min;
    return { date: total >= 1440 ? addDays(opts.firstDate, 1) : opts.firstDate, time: `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` };
  })();
  const stamp = (opts.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//School Hub//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:family-meeting-${opts.familyId}@${opts.host}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${opts.tz}:${local(opts.firstDate, s.time)}`,
    `DTEND;TZID=${opts.tz}:${local(endTime.date, endTime.time)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.day]}`,
    `SUMMARY:${esc(`${opts.familyName} family meeting`)}`,
    `DESCRIPTION:${esc(`This week's deck: ${opts.deckUrl}`)}`,
    `URL:${opts.deckUrl}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Family meeting in 30 minutes", "TRIGGER:-PT30M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
}
