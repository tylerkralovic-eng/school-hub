/**
 * TEST MODE ONLY: a deterministic stand-in for the AI model so automated tests
 * run without an API key. Never used when ANTHROPIC_API_KEY is set, and refused
 * on Vercel production (see env.testMode). Output is clearly labeled "[Test]".
 */
import type { Extraction, ExtractedItem } from "@/lib/pipeline/schema";
import type { ExtractInput } from "@/lib/pipeline/extract";
import { addDays, utcToZoned } from "@/lib/time";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function base(p: Partial<ExtractedItem>): ExtractedItem {
  return {
    kind: "event", category: "general", title: "[Test] item", details: null, date: null, start_time: null, end_date: null, end_time: null,
    location: null, amount_usd: null, applies_to: "unknown", child_id: null, school_id: null, evidence: "", confidence: "high", uncertainty: null, ...p,
  };
}

export function stubExtract(input: ExtractInput): Extraction {
  const today = utcToZoned(input.receivedAt, input.timezone).date;
  const year = Number(today.slice(0, 4));
  const items: ExtractedItem[] = [];

  if (input.text) {
    // One item per sentence mentioning a "Mon DD" date.
    for (const sentence of input.text.split(/(?<=[.!?\n])\s+/)) {
      const m = sentence.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i);
      const time = sentence.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
      const isTask = /\b(due|return|bring|send|sign|pay|rsvp)\b/i.test(sentence);
      const child = input.roster.children.find((c) => new RegExp(`\\b${c.first_name}\\b`, "i").test(sentence));
      const date = m ? `${year}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
      let hh: string | null = null;
      if (time) {
        let h = Number(time[1]) % 12;
        if (time[3].toLowerCase() === "pm") h += 12;
        hh = `${String(h).padStart(2, "0")}:${time[2]}`;
      }
      if (!m && !isTask) continue;
      items.push(
        base({
          kind: isTask ? "task" : "event",
          category: /\$\d/.test(sentence) ? "payment" : /no school|closed/i.test(sentence) ? "closure" : "general",
          title: `[Test] ${sentence.replace(/\s+/g, " ").trim().slice(0, 60)}`,
          date,
          start_time: isTask ? null : hh,
          amount_usd: (() => { const a = sentence.match(/\$(\d+(?:\.\d\d)?)/); return a ? Number(a[1]) : null; })(),
          applies_to: child ? "child" : "unknown",
          child_id: child?.id ?? null,
          evidence: sentence.trim().slice(0, 200),
          uncertainty: date ? null : "No date given",
        }),
      );
    }
  }
  if (input.files.length) {
    items.push(
      base({ title: "[Test] Picture day", date: addDays(today, 5), start_time: "08:30", applies_to: "school", school_id: input.roster.schools[0]?.id ?? null, evidence: "Picture Day 8:30" }),
      base({ title: "[Test] No school – teacher workday", category: "closure", date: addDays(today, 9), applies_to: "school", school_id: input.roster.schools[0]?.id ?? null, evidence: "NO SCHOOL" }),
      base({ title: "[Test] Winter concert", date: addDays(today, 12), start_time: "18:00", applies_to: "school", school_id: input.roster.schools[0]?.id ?? null, evidence: "Winter Concert 6pm" }),
      base({ kind: "task", category: "permission_form", title: "[Test] Return field trip form", date: addDays(today, 3), applies_to: "unknown", evidence: "Return form by ...", confidence: "medium" }),
      base({ title: "[Test] Spirit week", date: null, applies_to: "school", school_id: input.roster.schools[0]?.id ?? null, evidence: "Spirit Week (date smudged)", uncertainty: "Date is not readable" }),
    );
  }
  return { is_school_related: items.length > 0, document_type: input.files.length ? "calendar" : "message", summary: `[Test mode] ${items.length} items found by the test stub.`, items };
}
