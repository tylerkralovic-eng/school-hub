"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env, features } from "@/lib/env";
import { aiUnderstand, hasAi, researchSchool } from "@/lib/onboarding/ai";
import { parseInvite, parseKids, parseMe, parsePlatforms, parseSchool } from "@/lib/onboarding/parse";
import type { OnboardingState, SchoolResearch, StepId } from "@/lib/onboarding/types";
import { PLATFORMS } from "@/lib/platforms";
import { getUser } from "@/lib/server/context";
import { importSchoolEvents } from "@/lib/server/school-import";
import { escapeHtml, sendEmail } from "@/lib/server/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/time";
import { CHILD_COLORS } from "@/lib/types";

async function requireNoFamily() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("family_members").select("family_id").eq("user_id", user.id).maybeSingle();
  if (data) redirect("/");
  return { supabase, user };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Understands one answer and returns the updated conversation state. AI when available, built-in rules otherwise. */
export async function understandAnswer(step: StepId, question: string, answer: string, state: OnboardingState): Promise<OnboardingState> {
  await requireNoFamily();
  const s: OnboardingState = structuredClone(state);
  const a = answer.trim().slice(0, 2000);
  const kidNames = s.kids.map((k) => k.first_name);
  const useAi = hasAi() && a !== "__none__" && step !== "me" && step !== "consent" && a.length > 3;
  const ai = useAi ? await aiUnderstand(question, a, kidNames) : null;

  if (step === "me") s.me = parseMe(a) ?? (a.split(/\s+/)[0]?.slice(0, 30) || "there");
  else if (step === "kids") {
    const kids = ai?.kids.length ? ai.kids.map((k) => ({ first_name: k.first_name.slice(0, 40), grade: k.grade, school: k.school, town: k.town })) : parseKids(a);
    s.kids = kids;
    s.kidsAsked = true;
  } else if (step.startsWith("school:")) {
    const name = step.slice(7);
    s.schoolAskedFor.push(name);
    const kid = s.kids.find((k) => same(k.first_name, name));
    const fromAi = ai?.kids.find((k) => same(k.first_name, name)) ?? (ai?.kids.length === 1 ? ai.kids[0] : undefined);
    const parsed = fromAi ? { school: fromAi.school, grade: fromAi.grade, town: fromAi.town } : parseSchool(a);
    if (kid) Object.assign(kid, { school: parsed.school ?? kid.school, grade: parsed.grade ?? kid.grade, town: parsed.town ?? kid.town });
    // An answer can cover siblings too ("both go to Maple")
    if (ai) for (const k of ai.kids) {
      const other = s.kids.find((x) => same(x.first_name, k.first_name) && x !== kid);
      if (other && k.school) Object.assign(other, { school: k.school, grade: k.grade ?? other.grade, town: k.town ?? other.town });
    }
    if (kid?.school && /\bboth\b|\ball\b|same/i.test(a)) for (const k of s.kids) if (!k.school) Object.assign(k, { school: kid.school, town: kid.town });
  } else if (step === "platforms") {
    const chips = a.split("|").filter((x) => PLATFORMS.some((p) => p.key === x) || x === "email" || x === "sms");
    const text = a.split("|").filter((x) => !chips.includes(x)).join(" ");
    const fromText = ai
      ? { platforms: ai.platforms.map((p) => ({ key: p.key, child_names: p.child_names.filter((n) => kidNames.some((k) => same(k, n))), channels: p.channels.length ? p.channels : [...(PLATFORMS.find((x) => x.key === p.key)?.typicalChannels ?? [])] })), channels: ai.generic_channels }
      : parsePlatforms(text, kidNames);
    const platforms = [...fromText.platforms];
    for (const c of chips) if (c !== "email" && c !== "sms" && !platforms.some((p) => p.key === c)) platforms.push({ key: c, child_names: [], channels: [...PLATFORMS.find((p) => p.key === c)!.typicalChannels] });
    s.platforms = platforms;
    s.channelsMentioned = [...new Set([...fromText.channels, ...chips.filter((c) => c === "email" || c === "sms")])];
    s.platformsAsked = true;
  } else if (step === "pain") {
    s.painPoints = a === "__none__" ? null : (ai?.pain_points ?? a.split("|").join("; ")).slice(0, 500);
    s.painAsked = true;
  } else if (step === "invite") {
    s.invite = ai?.invite && /@/.test(ai.invite.email) ? { name: ai.invite.name, email: ai.invite.email.toLowerCase() } : parseInvite(a);
    s.inviteAsked = true;
  } else if (step === "consent") {
    s.researchConsent = a === "yes";
  }
  return s;
}

/** Looks up one school online (with the parent's permission). Rate-limited per user. */
export async function researchOne(school: string, town: string | null, grade: string | null, timezone: string): Promise<SchoolResearch> {
  const { user } = await requireNoFamily();
  const db = createAdminClient();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await db.from("audit_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("action", "onboarding.research").gte("created_at", since);
  if ((count ?? 0) >= 8) return { query: school, found: false, official_name: null, town, district: null, website: null, calendar_url: null, email_domains: [], platforms: [], events: [], note: "Lookup limit reached for today." };
  await db.from("audit_events").insert({ user_id: user.id, action: "onboarding.research", target: school.slice(0, 120) });
  let tz = "America/New_York";
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); tz = timezone; } catch {}
  return researchSchool({ school: school.slice(0, 160), town: town?.slice(0, 80) ?? null, grade: grade?.slice(0, 30) ?? null, today: todayIn(tz) });
}

const Plan = z.object({
  familyName: z.string().trim().min(1).max(80),
  timezone: z.string().max(60),
  me: z.string().trim().min(1).max(60),
  kids: z.array(z.object({ first_name: z.string().trim().min(1).max(40), grade: z.string().max(30).nullable(), schoolKey: z.string().max(200).nullable() })).min(1).max(8),
  schools: z.array(z.object({
    key: z.string().max(200),
    name: z.string().trim().min(1).max(120),
    short_name: z.string().max(60).nullable(),
    town: z.string().max(80).nullable(),
    website: z.string().url().max(300).nullable(),
    calendar_url: z.string().url().max(500).nullable(),
    email_domains: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)).max(5),
    events: z.array(z.object({ title: z.string().max(200), date: z.string(), end_date: z.string().nullable(), category: z.enum(["closure", "early_dismissal", "activity", "general"]), evidence: z.string().max(400) })).max(60),
  })).max(8),
  platforms: z.array(z.object({ key: z.string(), child_names: z.array(z.string()), channels: z.array(z.enum(["email", "sms", "push", "app"])) })).max(20),
  channels: z.array(z.string()).max(4),
  painPoints: z.string().max(500).nullable(),
  invite: z.object({ name: z.string().max(60).nullable(), email: z.string().email() }).nullable(),
});
export type OnboardingPlan = z.infer<typeof Plan>;

/** Creates the whole family workspace from the approved plan. */
export async function applyOnboarding(plan: OnboardingPlan): Promise<{ error?: string; inviteLink?: string; added?: number; toReview?: number }> {
  const { supabase, user } = await requireNoFamily();
  const parsed = Plan.safeParse(plan);
  if (!parsed.success) return { error: "Something in the setup didn't look right. Please check and try again." };
  const p = parsed.data;
  let tz = "America/New_York";
  try { new Intl.DateTimeFormat("en-US", { timeZone: p.timezone }); tz = p.timezone; } catch {}

  const { data: familyId, error } = await supabase.rpc("create_family", { p_name: p.familyName, p_timezone: tz, p_display_name: p.me });
  if (error || !familyId) return { error: error?.message.includes("already") ? "You already belong to a family." : "Couldn't create your family. Please try again." };

  // Schools
  const schoolIds = new Map<string, string>();
  for (const s of p.schools) {
    const { data } = await supabase.from("schools").insert({ family_id: familyId, name: s.name, short_name: s.short_name, town: s.town, website: s.website, calendar_url: s.calendar_url }).select("id").single();
    if (data) schoolIds.set(s.key, data.id);
  }
  // Children
  const { data: kids } = await supabase
    .from("children")
    .insert(p.kids.map((k, i) => ({ family_id: familyId, first_name: k.first_name, grade: k.grade, school_id: k.schoolKey ? schoolIds.get(k.schoolKey) ?? null : null, color: CHILD_COLORS[i % CHILD_COLORS.length] })))
    .select("id, first_name, school_id");
  const kidId = (n: string) => kids?.find((k) => same(k.first_name, n))?.id;

  // Platforms
  const rows = p.platforms
    .filter((x) => PLATFORMS.some((c) => c.key === x.key))
    .map((x) => ({ family_id: familyId, platform_key: x.key, child_ids: x.child_names.map(kidId).filter(Boolean) as string[], notification_channels: x.channels }));
  if (rows.length) await supabase.from("family_platforms").upsert(rows, { onConflict: "family_id,platform_key" });

  // Gmail sender rules: school email domains + well-known platform senders
  const rules: { family_id: string; pattern: string; platform_key: string | null; child_id: string | null; school_id: string | null }[] = [];
  for (const s of p.schools) for (const d of s.email_domains) rules.push({ family_id: familyId, pattern: `@${d}`, platform_key: null, child_id: null, school_id: schoolIds.get(s.key) ?? null });
  for (const x of p.platforms) {
    if (!x.channels.includes("email")) continue;
    const cat = PLATFORMS.find((c) => c.key === x.key);
    const childIds = x.child_names.map(kidId).filter(Boolean) as string[];
    for (const sender of cat?.suggestedSenders ?? []) rules.push({ family_id: familyId, pattern: sender, platform_key: x.key, child_id: childIds.length === 1 ? childIds[0] : null, school_id: null });
  }
  const seen = new Set<string>();
  const uniqueRules = rules.filter((r) => !seen.has(r.pattern) && seen.add(r.pattern));
  if (uniqueRules.length) await supabase.from("sender_rules").insert(uniqueRules);

  await supabase.from("families").update({ context: { channels: p.channels, pain_points: p.painPoints, onboarded_at: new Date().toISOString() } }).eq("id", familyId);

  // Calendar dates from official school websites → items (clear ones) + review (unclear ones)
  let added = 0;
  let toReview = 0;
  for (const s of p.schools) {
    const sid = schoolIds.get(s.key);
    if (!sid || !s.events.length) continue;
    const r = await importSchoolEvents(supabase, { familyId, userId: user.id, timezone: tz, schoolId: sid, schoolName: s.name }, s.events, { website: s.website, calendar_url: s.calendar_url });
    added += r.added;
    toReview += r.toReview;
  }

  // Invite the other parent
  let inviteLink: string | undefined;
  if (p.invite && p.invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    const token = randomBytes(24).toString("base64url");
    const { error: invErr } = await supabase.from("family_invites").insert({ family_id: familyId, email: p.invite.email.toLowerCase(), token_hash: createHash("sha256").update(token).digest("hex"), invited_by: user.id });
    if (!invErr) {
      inviteLink = `${env.appUrl()}/invite/${token}`;
      if (features.email())
        await sendEmail(p.invite.email, `${p.me} invited you to ${p.familyName} on School Hub`, `${p.me} set up School Hub for your family and invited you.\n\nJoin: ${inviteLink}\n\nThis link expires in 7 days.`, `<p>${escapeHtml(p.me)} set up School Hub for your family and invited you.</p><p><a href="${inviteLink}">Join ${escapeHtml(p.familyName)}</a></p>`);
    }
  }
  await supabase.from("audit_events").insert({ family_id: familyId, user_id: user.id, action: "onboarding.completed", metadata: { kids: p.kids.length, schools: p.schools.length, events: added } });
  return { inviteLink, added, toReview };
}
