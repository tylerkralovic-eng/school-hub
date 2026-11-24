import { schoolWeek, sumPoints, type Entry } from "@/lib/behavior";

/** Prize progress as of `asOf`: weekly prizes count that school week; big prizes since they started. */
export function rewardProgressFor(r: { child_id: string; horizon: "week" | "big"; points_goal: number; starts_on: string }, entries: Entry[], asOf: string) {
  const week = schoolWeek(asOf);
  const from = r.horizon === "week" ? week[0] : r.starts_on;
  const to = r.horizon === "week" ? week[4] : asOf;
  const pts = sumPoints(entries, r.child_id, from, to);
  return { pts, pct: Math.max(0, Math.min(100, Math.round((pts / Math.max(1, r.points_goal)) * 100))), done: pts >= r.points_goal };
}
