import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { choiceFor, currentStreak, isGoodDay, schoolWeek, sumPoints, type Entry, type TrackingSystem } from "@/lib/behavior";
import { rewardProgressFor } from "@/lib/meeting/progress";
import { meetingWindow, nextMeetingDate, upcomingMeetingDates, type MeetingSettings } from "@/lib/meeting/schedule";
import { pickValue, valueByKey, type Value } from "@/lib/meeting/values";
import { loadBehavior, shapeOf, type Reward, type Shape } from "@/lib/server/behavior";
import type { FamilyContext } from "@/lib/server/context";
import { ITEM_SELECT, type ItemView } from "@/lib/server/items";
import type { Database } from "@/lib/supabase/database.types";
import { addDays, isValidDate, todayIn, utcToZoned, zonedToUtc } from "@/lib/time";

export const MEETING_SERIES = "family_meeting";
const WEEKS_AHEAD = 8;
type Db = SupabaseClient<Database>;

export async function getMeetingSettings(db: Db, familyId: string): Promise<MeetingSettings | null> {
  const { data } = await db.from("meeting_settings").select("day, time, duration_min").eq("family_id", familyId).maybeSingle();
  return data ? { day: data.day, time: data.time.slice(0, 5), duration_min: data.duration_min } : null;
}

/**
 * Keep the next few meetings on the family calendar (so they show in the app,
 * the calendar feed and digests). Idempotent; moves future meetings when the
 * time changes and removes them when meetings are turned off (settings null).
 */
export async function syncMeetingItems(db: Db, family: { id: string; timezone: string }, settings: MeetingSettings | null, createdBy: string | null = null) {
  const nowIso = new Date().toISOString();
  const { data: existing } = await db.from("items").select("id, starts_at").eq("family_id", family.id).eq("series", MEETING_SERIES).gte("starts_at", nowIso);
  const want = settings
    ? upcomingMeetingDates(todayIn(family.timezone), settings.day, WEEKS_AHEAD).map((d) => meetingWindow(d, settings, family.timezone)).filter((w) => w.start >= nowIso)
    : [];
  const wantStarts = new Set(want.map((w) => new Date(w.start).getTime()));
  const have = new Set((existing ?? []).map((e) => new Date(e.starts_at!).getTime()));
  const stale = (existing ?? []).filter((e) => !wantStarts.has(new Date(e.starts_at!).getTime())).map((e) => e.id);
  if (stale.length) await db.from("items").delete().in("id", stale);
  const missing = want.filter((w) => !have.has(new Date(w.start).getTime()));
  if (missing.length) {
    await db.from("items").insert(
      missing.map((w) => ({
        family_id: family.id,
        kind: "event" as const,
        category: "activity" as const,
        title: "Family meeting",
        details: "Open this week's meeting deck in School Hub (Points → Family meeting).",
        starts_at: w.start,
        ends_at: w.end,
        series: MEETING_SERIES,
        created_by: createdBy,
      })),
    );
  }
  return { added: missing.length, removed: stale.length };
}

/** Cron: top up meeting items for every family that has meetings on. */
export async function syncAllMeetings(db: Db) {
  const { data } = await db.from("meeting_settings").select("family_id, day, time, duration_min, families(timezone)");
  let added = 0;
  for (const row of data ?? []) {
    const tz = (row.families as unknown as { timezone: string } | null)?.timezone ?? "America/New_York";
    added += (await syncMeetingItems(db, { id: row.family_id, timezone: tz }, { day: row.day, time: row.time.slice(0, 5), duration_min: row.duration_min })).added;
  }
  return { families: data?.length ?? 0, added };
}

export interface KidWeek {
  child: FamilyContext["children"][number];
  systemName: string;
  shape: Shape;
  countMax: number | null;
  days: { day: string; label: string; color?: string; stroke?: string; count: number | null; points: number | null }[];
  points: number;
  lastWeekPoints: number;
  goodDays: number;
  logged: number;
  streak: number;
  streakLabel: string;
  shoutout: string;
  prizes: { title: string; horizon: "week" | "big"; goal: number; pts: number; pct: number; done: boolean }[];
}

export interface Deck {
  date: string;
  settings: MeetingSettings | null;
  reviewWeek: string[];
  kids: KidWeek[];
  untrackedKids: FamilyContext["children"];
  nextWeek: { day: string; items: (ItemView & { isDue: boolean })[] }[];
  comingUp: (ItemView & { isDue: boolean; when: string })[];
  value: Value;
  valueChosen: boolean;
}

function shoutout(name: string, k: Pick<KidWeek, "points" | "lastWeekPoints" | "goodDays" | "logged" | "streak">): string {
  if (!k.logged) return `No days logged this week — let's start fresh, ${name}!`;
  if (k.goodDays === k.logged && k.logged >= 4) return `A good day every day this week. Amazing, ${name}!`;
  if (k.points > k.lastWeekPoints && k.lastWeekPoints !== 0) return `Up ${k.points - k.lastWeekPoints} points from last week!`;
  if (k.streak >= 3) return `${k.streak} good days in a row — keep it going!`;
  if (k.goodDays >= 3) return `${k.goodDays} good days this week!`;
  if (k.goodDays > 0) return `${k.goodDays} good ${k.goodDays === 1 ? "day" : "days"} — let's aim for more next week.`;
  return "A tough week. What can we try differently?";
}

export async function loadDeck(ctx: FamilyContext, requested?: string | null): Promise<Deck> {
  const tz = ctx.family.timezone;
  const today = todayIn(tz);
  const settings = await getMeetingSettings(ctx.supabase, ctx.family.id);
  const date = isValidDate(requested) ? requested : nextMeetingDate(today, settings?.day ?? 0);
  const reviewWeek = schoolWeek(date);
  const lastWeek = schoolWeek(addDays(reviewWeek[0], -7));

  const nextFrom = zonedToUtc(addDays(date, 1), null, tz);
  const nextTo = zonedToUtc(addDays(date, 8), null, tz);
  const laterTo = zonedToUtc(addDays(date, 43), null, tz);
  const notMeeting = `series.is.null,series.neq.${MEETING_SERIES}`;
  const [behavior, eventsRes, tasksRes, pick, recent] = await Promise.all([
    loadBehavior(ctx, Math.max(70, -Math.min(0, Math.round((Date.parse(date) - Date.parse(today)) / 86400_000)) + 21)),
    ctx.supabase.from("items").select(ITEM_SELECT).eq("family_id", ctx.family.id).or(notMeeting).not("starts_at", "is", null).lt("starts_at", laterTo).or(`starts_at.gte.${nextFrom},ends_at.gte.${nextFrom}`).order("starts_at").limit(200),
    ctx.supabase.from("items").select(ITEM_SELECT).eq("family_id", ctx.family.id).eq("kind", "task").is("completed_at", null).gte("due_at", nextFrom).lt("due_at", laterTo).order("due_at").limit(100),
    ctx.supabase.from("family_meetings").select("value_key").eq("family_id", ctx.family.id).eq("meeting_date", date).maybeSingle(),
    ctx.supabase.from("family_meetings").select("value_key").eq("family_id", ctx.family.id).lt("meeting_date", date).order("meeting_date", { ascending: false }).limit(10),
  ]);

  // Kids: last school week at a glance + prizes.
  const kids: KidWeek[] = [];
  for (const child of ctx.children) {
    const s = behavior.systems.find((x) => x.child_id === child.id) as (TrackingSystem & { id: string }) | undefined;
    if (!s) continue;
    const mine = behavior.entries.filter((e) => e.child_id === child.id && e.day <= reviewWeek[4]);
    const days = reviewWeek.map((d) => {
      const e = mine.find((x) => x.day === d);
      const c = e ? choiceFor(s, e) : undefined;
      return { day: d, label: c?.label ?? "Not logged", color: c?.color, stroke: c?.stroke, count: e?.count ?? null, points: e ? e.points : null };
    });
    const logged = days.filter((d) => d.points !== null).length;
    const goodDays = reviewWeek.filter((d) => {
      const e = mine.find((x) => x.day === d);
      return e && isGoodDay(s, e);
    }).length;
    const base = {
      points: sumPoints(behavior.entries, child.id, reviewWeek[0], reviewWeek[4]),
      lastWeekPoints: sumPoints(behavior.entries, child.id, lastWeek[0], lastWeek[4]),
      goodDays,
      logged,
      streak: currentStreak(s, mine as Entry[]),
    };
    const prizes = (behavior.rewards as Reward[])
      .filter((r) => r.child_id === child.id)
      .map((r) => ({ title: r.title, horizon: r.horizon, goal: r.points_goal, ...rewardProgressFor(r, behavior.entries, date) }));
    kids.push({
      child,
      systemName: s.name,
      shape: shapeOf(s),
      countMax: s.count_max,
      days,
      ...base,
      streakLabel: s.kind === "count" ? "full days" : "good days",
      shoutout: shoutout(child.first_name, base),
      prizes,
    });
  }

  // Next week (Mon–Sun after the meeting) and important dates after that.
  const events = (eventsRes.data ?? []) as ItemView[];
  const tasks = (tasksRes.data ?? []) as ItemView[];
  const all = [
    ...events.map((e) => ({ ...e, isDue: false, at: e.starts_at! < nextFrom ? nextFrom : e.starts_at! })),
    ...tasks.map((t) => ({ ...t, isDue: true, at: t.due_at! })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(date, i + 1)).map((day) => {
    const start = zonedToUtc(day, null, tz);
    const end = zonedToUtc(addDays(day, 1), null, tz);
    return {
      day,
      items: all.filter((x) => {
        if (x.isDue) return x.due_at! >= start && x.due_at! < end;
        return x.starts_at! < end && (x.ends_at ?? x.starts_at!) >= start;
      }),
    };
  });
  const important = new Set(["closure", "early_dismissal", "payment", "permission_form", "activity", "teacher_request", "supplies"]);
  const seen = new Set<string>();
  const comingUp = all
    .filter((x) => x.at >= nextTo && (important.has(x.category) || x.kind === "event"))
    .filter((x) => {
      const k = x.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => Number(!important.has(a.category)) - Number(!important.has(b.category)) || a.at.localeCompare(b.at))
    .slice(0, 8)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((x) => ({ ...x, when: utcToZoned(x.at, tz).date }));

  const chosen = valueByKey(pick.data?.value_key);
  const value = chosen ?? pickValue(date, (recent.data ?? []).map((r) => r.value_key));

  return {
    date,
    settings,
    reviewWeek,
    kids,
    untrackedKids: ctx.children.filter((c) => !kids.some((k) => k.child.id === c.id)),
    nextWeek,
    comingUp,
    value,
    valueChosen: Boolean(chosen),
  };
}
