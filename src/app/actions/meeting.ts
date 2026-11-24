"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { valueByKey } from "@/lib/meeting/values";
import { audit, requireFamily } from "@/lib/server/context";
import { syncMeetingItems } from "@/lib/server/meeting";
import { isValidDate, isValidTime } from "@/lib/time";

/** Turn weekly family meetings on (or change day/time). Puts the next 8 on the calendar. */
export async function saveMeetingSettings(form: FormData) {
  const ctx = await requireFamily();
  const day = Number(form.get("day"));
  const time = String(form.get("time") ?? "").slice(0, 5);
  if (!Number.isInteger(day) || day < 0 || day > 6 || !isValidTime(time)) redirect("/meeting?error=settings");
  const settings = { day, time, duration_min: 30 };
  const { error } = await ctx.supabase.from("meeting_settings").upsert({ family_id: ctx.family.id, ...settings, updated_at: new Date().toISOString() });
  if (error) redirect("/meeting?error=settings");
  await syncMeetingItems(ctx.supabase, ctx.family, settings, ctx.userId);
  await audit(ctx, "meeting.settings", ctx.family.id, { day, time });
  revalidatePath("/", "layout");
  redirect("/meeting?saved=1");
}

export async function stopMeetings() {
  const ctx = await requireFamily();
  await syncMeetingItems(ctx.supabase, ctx.family, null);
  await ctx.supabase.from("meeting_settings").delete().eq("family_id", ctx.family.id);
  await audit(ctx, "meeting.stopped", ctx.family.id);
  revalidatePath("/", "layout");
  redirect("/meeting");
}

/** Pick this meeting's value of the week (or the next one in the list). */
export async function chooseValue(form: FormData) {
  const ctx = await requireFamily();
  const date = String(form.get("date") ?? "");
  const key = String(form.get("value") ?? "");
  if (!isValidDate(date) || !valueByKey(key)) return;
  await ctx.supabase.from("family_meetings").upsert({ family_id: ctx.family.id, meeting_date: date, value_key: key });
  revalidatePath("/meeting");
}

