"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { audit, requireFamily } from "@/lib/server/context";
import { isValidDate, isValidTime, zonedToUtc } from "@/lib/time";

export async function toggleTask(itemId: string, done: boolean) {
  const ctx = await requireFamily();
  await ctx.supabase
    .from("items")
    .update(done ? { completed_at: new Date().toISOString(), completed_by: ctx.userId } : { completed_at: null, completed_by: null })
    .eq("id", itemId)
    .eq("family_id", ctx.family.id);
  revalidatePath("/", "layout");
}

const itemSchema = z.object({
  kind: z.enum(["event", "task", "announcement"]),
  category: z.enum(["general", "closure", "early_dismissal", "supplies", "permission_form", "payment", "lunch", "teacher_request", "activity", "reminder"]),
  title: z.string().trim().min(1, "Add a title").max(200),
  details: z.string().trim().max(4000).optional(),
  childId: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().trim().max(200).optional(),
  assigneeId: z.string().optional(),
});

/** Create or update an item by hand (events, tasks, notices). */
export async function saveItem(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const raw = Object.fromEntries(["kind", "category", "title", "details", "childId", "date", "time", "endDate", "endTime", "location", "assigneeId"].map((k) => [k, (form.get(k) as string | null) ?? undefined]));
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const tz = ctx.family.timezone;

  if (d.date && !isValidDate(d.date)) return { error: "Enter a valid date" };
  if (d.time && !isValidTime(d.time)) return { error: "Enter a valid time" };
  if (d.kind === "event" && !d.date) return { error: "Events need a date" };

  // childId may be "school:<id>" for a whole school, a child id, or "" for the whole family.
  let childId: string | null = null;
  let schoolId: string | null = null;
  if (d.childId?.startsWith("school:")) schoolId = d.childId.slice(7);
  else if (d.childId) {
    const child = ctx.children.find((c) => c.id === d.childId);
    if (!child) return { error: "Unknown child" };
    childId = child.id;
    schoolId = child.school_id;
  }
  if (schoolId && !ctx.schools.some((s) => s.id === schoolId)) return { error: "Unknown school" };

  const allDay = d.kind === "event" && Boolean(d.date) && !d.time;
  const startsAt = d.kind === "event" && d.date ? zonedToUtc(d.date, d.time || null, tz) : null;
  let endsAt: string | null = null;
  if (d.kind === "event" && (d.endDate || d.endTime)) {
    const endDate = d.endDate && isValidDate(d.endDate) ? d.endDate : d.date!;
    endsAt = zonedToUtc(endDate, d.endTime && isValidTime(d.endTime) ? d.endTime : null, tz);
    if (startsAt && endsAt < startsAt) return { error: "End must be after start" };
  }
  const dueAt = d.kind === "task" && d.date ? zonedToUtc(d.date, d.time || "23:59", tz) : null;
  const assignee = d.kind === "task" && d.assigneeId && ctx.members.some((m) => m.user_id === d.assigneeId) ? d.assigneeId : null;

  const row = {
    kind: d.kind,
    category: d.category,
    title: d.title,
    details: d.details || null,
    child_id: childId,
    school_id: schoolId,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: allDay,
    due_at: dueAt,
    location: d.location || null,
    assignee_id: assignee,
  };

  const id = form.get("id");
  if (id) {
    const { error } = await ctx.supabase.from("items").update(row).eq("id", String(id)).eq("family_id", ctx.family.id);
    if (error) return { error: "Could not save changes." };
    await audit(ctx, "item.updated", String(id));
  } else {
    const { data, error } = await ctx.supabase.from("items").insert({ ...row, family_id: ctx.family.id, created_by: ctx.userId }).select("id").single();
    if (error || !data) return { error: "Could not save." };
  }
  revalidatePath("/", "layout");
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : d.kind === "event" ? "/calendar" : d.kind === "task" ? "/tasks" : "/inbox");
}

export async function deleteItem(form: FormData) {
  const ctx = await requireFamily();
  const id = String(form.get("id"));
  await ctx.supabase.from("items").delete().eq("id", id).eq("family_id", ctx.family.id);
  await audit(ctx, "item.deleted", id);
  revalidatePath("/", "layout");
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/inbox");
}

export async function assignTask(itemId: string, userId: string | null) {
  const ctx = await requireFamily();
  if (userId && !ctx.members.some((m) => m.user_id === userId)) return;
  await ctx.supabase.from("items").update({ assignee_id: userId }).eq("id", itemId).eq("family_id", ctx.family.id);
  revalidatePath("/", "layout");
}
