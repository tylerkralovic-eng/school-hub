"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { POINT_MAX, POINT_MIN, choiceFor, clampPoints, countPointsMap, normalizeColor, type TrackingSystem } from "@/lib/behavior";
import { parseTrackingDescription, type ParsedSystem } from "@/lib/behavior-ai";
import { audit, requireFamily } from "@/lib/server/context";
import { addDays, isValidDate, isValidTime, todayIn } from "@/lib/time";

/** Step 1 of setup: understand the parent's description (not saved yet). */
export async function understandTracking(text: string): Promise<{ systems?: ParsedSystem[]; error?: string }> {
  const ctx = await requireFamily();
  const t = text.trim();
  if (t.length < 10) return { error: "Tell me a little more — what does the school use, and what's best and worst?" };
  const systems = await parseTrackingDescription(t, ctx.children);
  if (!systems.length) return { error: "I couldn't tell how it works. Try naming each child and their colors or count, like “Everley gets stars: white is normal, purple is best…”." };
  return { systems };
}

const LevelSchema = z.object({ key: z.string().min(1).max(40), label: z.string().min(1).max(24), color: z.string(), meaning: z.string().max(80), points: z.number().int().min(POINT_MIN).max(POINT_MAX) });
const SystemSchema = z.object({
  child_id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["levels", "count"]),
  levels: z.array(LevelSchema).max(8),
  count_max: z.number().int().min(1).max(20).nullable(),
  count_unit: z.string().max(30).nullable(),
  check_in_time: z.string().nullable(),
  count_points: z.record(z.string().regex(/^\d{1,2}$/), z.number().int().min(POINT_MIN).max(POINT_MAX)).nullable().optional(),
});

/** Step 2: save the approved systems (one per child). */
export async function saveTracking(systems: z.infer<typeof SystemSchema>[], description: string): Promise<{ error?: string }> {
  const ctx = await requireFamily();
  const parsed = z.array(SystemSchema).min(1).max(8).safeParse(systems);
  if (!parsed.success) return { error: "Something didn't look right. Please try again." };
  for (const s of parsed.data) {
    if (!ctx.children.some((c) => c.id === s.child_id)) return { error: "Unknown child." };
    if (s.kind === "levels" && s.levels.length < 2) return { error: "A chart needs at least two levels." };
    const { error } = await ctx.supabase.from("tracking_systems").upsert({
      family_id: ctx.family.id,
      child_id: s.child_id,
      name: s.name,
      kind: s.kind,
      levels: s.kind === "levels" ? s.levels.map((l) => ({ ...l, color: normalizeColor(l.color) })) : [],
      count_max: s.kind === "count" ? s.count_max ?? 3 : null,
      count_unit: s.kind === "count" ? s.count_unit : null,
      count_points: s.kind === "count" ? countPointsMap(s.count_max ?? 3, s.count_points ?? null) : null,
      check_in_time: s.check_in_time && isValidTime(s.check_in_time.slice(0, 5)) ? s.check_in_time.slice(0, 5) : "15:00",
      description: description.slice(0, 2000),
    }, { onConflict: "child_id" });
    if (error) return { error: "Couldn't save. Please try again." };
  }
  await audit(ctx, "tracking.setup", undefined, { kids: parsed.data.length });
  revalidatePath("/", "layout");
  return {};
}

/** One tap: record a child's day (today by default). */
export async function logDay(childId: string, value: string, day?: string): Promise<{ error?: string; points?: number }> {
  const ctx = await requireFamily();
  const today = todayIn(ctx.family.timezone);
  const d = day ?? today;
  if (!isValidDate(d) || d > today || d < addDays(today, -400)) return { error: "That date can't be logged." };
  const { data: sys } = await ctx.supabase.from("tracking_systems").select("*").eq("child_id", childId).eq("family_id", ctx.family.id).maybeSingle();
  if (!sys) return { error: "Set up tracking first." };
  const system = sys as unknown as TrackingSystem;
  const entry = system.kind === "count" ? { level_key: null, count: Number(value) } : { level_key: value, count: null };
  const choice = choiceFor(system, entry);
  if (!choice) return { error: "Unknown choice." };
  const { error } = await ctx.supabase.from("behavior_entries").upsert(
    { family_id: ctx.family.id, child_id: childId, day: d, ...entry, points: choice.points, recorded_by: ctx.userId },
    { onConflict: "child_id,day" },
  );
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/", "layout");
  return { points: choice.points };
}

export async function clearDay(childId: string, day: string) {
  const ctx = await requireFamily();
  if (!isValidDate(day)) return;
  await ctx.supabase.from("behavior_entries").delete().eq("family_id", ctx.family.id).eq("child_id", childId).eq("day", day);
  revalidatePath("/", "layout");
}

/** Edit points per level and the check-in time. */
export async function saveTrackingSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const childId = String(form.get("child_id"));
  const { data: sys } = await ctx.supabase.from("tracking_systems").select("*").eq("child_id", childId).eq("family_id", ctx.family.id).maybeSingle();
  if (!sys) return { error: "Not found" };
  const time = String(form.get("check_in_time") ?? "");
  if (time && !isValidTime(time)) return { error: "Enter a valid time" };
  const read = (name: string, fallback: number) => {
    const v = form.get(name);
    const p = Number(v);
    return v !== null && v !== "" && Number.isInteger(p) ? clampPoints(p) : fallback;
  };
  const levels = (sys.levels as unknown as { key: string; points: number }[]).map((l) => ({ ...l, points: read(`points.${l.key}`, l.points) }));
  const max = sys.count_max ?? 3;
  const current = countPointsMap(max, sys.count_points as Record<string, number> | null);
  const countPoints = sys.kind === "count" ? Object.fromEntries(Object.entries(current).map(([n, p]) => [n, read(`cpoints.${n}`, p)])) : null;
  await ctx.supabase.from("tracking_systems").update({ check_in_time: time || sys.check_in_time, levels, count_points: countPoints }).eq("id", sys.id);
  // Re-score days already logged so totals match the new values.
  if (sys.kind === "levels") for (const l of levels) await ctx.supabase.from("behavior_entries").update({ points: l.points }).eq("child_id", childId).eq("level_key", l.key);
  else for (const [n, p] of Object.entries(countPoints!)) await ctx.supabase.from("behavior_entries").update({ points: p }).eq("child_id", childId).eq("count", Number(n));
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

export async function removeTracking(form: FormData) {
  const ctx = await requireFamily();
  const childId = String(form.get("child_id"));
  await ctx.supabase.from("tracking_systems").delete().eq("child_id", childId).eq("family_id", ctx.family.id);
  await ctx.supabase.from("behavior_entries").delete().eq("child_id", childId).eq("family_id", ctx.family.id);
  await audit(ctx, "tracking.removed", childId);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ prizes

export async function saveReward(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const parsed = z.object({
    child_id: z.string().uuid(),
    horizon: z.enum(["week", "big"]),
    title: z.string().trim().min(1, "Name the prize").max(80),
    points_goal: z.coerce.number().int().min(1, "Set a points goal").max(100000),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!ctx.children.some((c) => c.id === parsed.data.child_id)) return { error: "Unknown child" };
  const id = form.get("id");
  const { error } = id
    ? await ctx.supabase.from("rewards").update({ title: parsed.data.title, points_goal: parsed.data.points_goal }).eq("id", String(id)).eq("family_id", ctx.family.id)
    // Big prizes count from the start of this month, so filled-in history counts too.
    : await ctx.supabase.from("rewards").insert({ ...parsed.data, family_id: ctx.family.id, starts_on: `${todayIn(ctx.family.timezone).slice(0, 8)}01` });
  if (error) return { error: "Couldn't save." };
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

export async function claimReward(form: FormData) {
  const ctx = await requireFamily();
  await ctx.supabase.from("rewards").update({ claimed_at: new Date().toISOString() }).eq("id", String(form.get("id"))).eq("family_id", ctx.family.id);
  revalidatePath("/", "layout");
}

export async function deleteReward(form: FormData) {
  const ctx = await requireFamily();
  await ctx.supabase.from("rewards").delete().eq("id", String(form.get("id"))).eq("family_id", ctx.family.id);
  revalidatePath("/", "layout");
}
