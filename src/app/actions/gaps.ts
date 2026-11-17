"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createInvite } from "@/app/actions/family";
import { addSenderRule } from "@/app/actions/connections";
import { researchSchool } from "@/lib/onboarding/ai";
import { parseInvite, parseSchool } from "@/lib/onboarding/parse";
import { audit, requireFamily } from "@/lib/server/context";
import { dismissedGaps } from "@/lib/server/gaps";
import { importSchoolEvents } from "@/lib/server/school-import";
import { todayIn } from "@/lib/time";

export async function dismissGap(id: string) {
  const list = [...new Set([...(await dismissedGaps()), id.slice(0, 80)])].slice(-30);
  (await cookies()).set("sh_gaps", JSON.stringify(list), { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 14, path: "/", secure: process.env.NODE_ENV === "production" });
  revalidatePath("/");
}

/** Applies a Quick-question answer. Returns a short confirmation for the conversation. */
export async function answerGap(id: string, value: string): Promise<{ reply: string; error?: boolean }> {
  const ctx = await requireFamily();
  const v = value.trim().slice(0, 500);
  let reply = "Got it — thanks!";

  if (id.startsWith("school:")) {
    const kid = ctx.children.find((c) => c.id === id.slice(7));
    const parsed = parseSchool(v);
    if (!kid || !parsed.school) return { reply: "I didn't catch a school name — could you try again?", error: true };
    let school = ctx.schools.find((s) => s.name.toLowerCase() === parsed.school!.toLowerCase());
    if (!school) {
      const { data } = await ctx.supabase.from("schools").insert({ family_id: ctx.family.id, name: parsed.school, town: parsed.town }).select("*").single();
      school = data ?? undefined;
    }
    if (school) await ctx.supabase.from("children").update({ school_id: school.id, ...(parsed.grade ? { grade: parsed.grade } : {}) }).eq("id", kid.id).eq("family_id", ctx.family.id);
    reply = `Saved — ${kid.first_name} goes to ${parsed.school}.`;
  } else if (id.startsWith("platformkids:")) {
    const ids = v.split("|").filter((x) => ctx.children.some((c) => c.id === x));
    await ctx.supabase.from("family_platforms").update({ child_ids: ids }).eq("family_id", ctx.family.id).eq("platform_key", id.slice(13));
    reply = "Thanks — I'll use that to match messages to the right kid.";
  } else if (id.startsWith("lookup:")) {
    const school = ctx.schools.find((s) => s.id === id.slice(7));
    if (!school) return { reply: "That school is no longer in your family.", error: true };
    const r = await researchSchool({ school: school.name, town: school.town, grade: null, today: todayIn(ctx.family.timezone) });
    await audit(ctx, "school.lookup", school.name, { found: r.found, events: r.events.length });
    if (!r.found) {
      await ctx.supabase.from("schools").update({ website: "about:not-found" }).eq("id", school.id); // don't ask again
      return { reply: `I couldn't confidently find ${school.name}'s official calendar. A photo of a printed calendar works great instead.` };
    }
    await ctx.supabase.from("schools").update({ website: r.website, calendar_url: r.calendar_url, town: r.town ?? school.town }).eq("id", school.id);
    const res = await importSchoolEvents(ctx.supabase, { familyId: ctx.family.id, userId: ctx.userId, timezone: ctx.family.timezone, schoolId: school.id, schoolName: r.official_name ?? school.name }, r.events, r);
    reply = res.added || res.toReview ? `Found it! I added ${res.added} dates from ${r.official_name ?? school.name}'s calendar${res.toReview ? ` — ${res.toReview} need a quick look` : ""}.` : `Found ${r.official_name ?? school.name}'s website, but no upcoming dates I could read.`;
  } else if (id === "invite") {
    const inv = parseInvite(v);
    if (!inv) return { reply: "I need an email address to send the invite — e.g. “Morgan, morgan@email.com”.", error: true };
    const form = new FormData();
    form.set("email", inv.email);
    const r = await createInvite(undefined, form);
    if (r?.error) return { reply: r.error, error: true };
    reply = `Invite ready for ${inv.name ?? inv.email}! Link: ${r?.link}`;
  } else if (id.startsWith("sender:")) {
    const form = new FormData();
    form.set("pattern", v);
    form.set("platform", id.slice(7));
    const r = await addSenderRule(undefined, form);
    if (r?.error) return { reply: r.error, error: true };
    reply = "Great — I'll watch for those emails.";
  }
  // No revalidatePath here: the card shows its confirmation first, then refreshes itself.
  return { reply };
}
