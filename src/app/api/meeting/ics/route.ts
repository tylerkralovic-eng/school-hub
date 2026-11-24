import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { meetingIcs, nextMeetingDate } from "@/lib/meeting/schedule";
import { requireFamily } from "@/lib/server/context";
import { getMeetingSettings } from "@/lib/server/meeting";
import { todayIn } from "@/lib/time";

/** One recurring event for the weekly family meeting — to add to a work or personal calendar. */
export async function GET() {
  const ctx = await requireFamily();
  const settings = await getMeetingSettings(ctx.supabase, ctx.family.id);
  if (!settings) return new NextResponse("Family meeting isn't set up", { status: 404 });
  const base = env.appUrl();
  const body = meetingIcs({
    familyId: ctx.family.id,
    familyName: ctx.family.name,
    tz: ctx.family.timezone,
    firstDate: nextMeetingDate(todayIn(ctx.family.timezone), settings.day),
    settings,
    deckUrl: `${base}/meeting`,
    host: new URL(base).host,
  });
  return new NextResponse(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="family-meeting.ics"', "Cache-Control": "no-store" },
  });
}
