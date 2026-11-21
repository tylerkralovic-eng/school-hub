import "server-only";
import { choicesFor, type Entry, type TrackingSystem } from "@/lib/behavior";
import type { FamilyContext } from "@/lib/server/context";
import { addDays, todayIn } from "@/lib/time";

export interface Reward { id: string; child_id: string; horizon: "week" | "big"; title: string; points_goal: number; starts_on: string; claimed_at: string | null }

export type Shape = "star" | "token" | "dots";
export function shapeOf(s: TrackingSystem): Shape {
  return s.kind === "count" ? "dots" : /star/i.test(s.name) ? "star" : "token";
}

/** Systems, entries since `daysBack` and prizes for the family. */
export async function loadBehavior(ctx: FamilyContext, daysBack = 70) {
  const today = todayIn(ctx.family.timezone);
  const [sys, ent, rew] = await Promise.all([
    ctx.supabase.from("tracking_systems").select("*").eq("family_id", ctx.family.id),
    ctx.supabase.from("behavior_entries").select("child_id, day, level_key, count, points, note").eq("family_id", ctx.family.id).gte("day", addDays(today, -daysBack)).order("day"),
    ctx.supabase.from("rewards").select("*").eq("family_id", ctx.family.id).is("claimed_at", null).order("created_at"),
  ]);
  const systems = (sys.data ?? []) as unknown as (TrackingSystem & { id: string })[];
  return { today, systems, entries: (ent.data ?? []) as Entry[], rewards: (rew.data ?? []) as Reward[] };
}

/** Serializable choices for client components. */
export function clientChoices(s: TrackingSystem) {
  return choicesFor(s).map(({ key, label, color, stroke, points, meaning }) => ({ key, label, color, stroke, points, meaning }));
}
