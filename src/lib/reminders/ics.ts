/** iCalendar (RFC 5545) feed of a family's events and task deadlines. Pure. */
import { utcToZoned, addDays } from "@/lib/time";

export interface IcsItem {
  id: string;
  kind: string;
  title: string;
  details: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  due_at: string | null;
  completed_at: string | null;
  updated_at: string;
  childName: string | null;
}

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}
const utc = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateOnly = (d: string) => d.replace(/-/g, "");

export function buildIcs(familyName: string, tz: string, items: IcsItem[], host: string): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//School Hub//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(`${familyName} · School Hub`)}`, `X-WR-TIMEZONE:${tz}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const it of items) {
    const prefix = it.childName ? `${it.childName}: ` : "";
    const ev: string[] = ["BEGIN:VEVENT", `UID:${it.id}${it.kind === "task" ? "-due" : ""}@${host}`, `DTSTAMP:${utc(it.updated_at)}`];
    if (it.kind === "task" && it.due_at) {
      if (it.completed_at) continue;
      const d = utcToZoned(it.due_at, tz).date;
      ev.push(`DTSTART;VALUE=DATE:${dateOnly(d)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(d, 1))}`, `SUMMARY:${esc(`${prefix}Due: ${it.title}`)}`);
      ev.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Due: ${it.title}`)}`, "TRIGGER:-PT12H", "END:VALARM");
    } else if (it.starts_at) {
      if (it.all_day) {
        const s = utcToZoned(it.starts_at, tz).date;
        const e = it.ends_at ? utcToZoned(it.ends_at, tz).date : s;
        ev.push(`DTSTART;VALUE=DATE:${dateOnly(s)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(e, 1))}`);
      } else {
        ev.push(`DTSTART:${utc(it.starts_at)}`, `DTEND:${utc(it.ends_at ?? new Date(new Date(it.starts_at).getTime() + 3600_000).toISOString())}`);
      }
      ev.push(`SUMMARY:${esc(prefix + it.title)}`);
    } else continue;
    if (it.location) ev.push(`LOCATION:${esc(it.location)}`);
    if (it.details) ev.push(`DESCRIPTION:${esc(it.details.slice(0, 1000))}`);
    ev.push("END:VEVENT");
    lines.push(...ev);
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
