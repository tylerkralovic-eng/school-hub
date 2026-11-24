import "server-only";
import { cookies } from "next/headers";
import { features } from "@/lib/env";
import { hasAi } from "@/lib/onboarding/ai";
import { PLATFORMS } from "@/lib/platforms";
import type { FamilyContext } from "@/lib/server/context";
import { findDuplicateItems } from "@/lib/server/duplicates";

/**
 * "Quick question": the single most useful thing School Hub doesn't know yet,
 * asked conversationally on Home. Ordered by value; parents can dismiss.
 */
export interface Gap {
  id: string;
  text: string;
  kind: "text" | "choice" | "multi" | "action" | "link";
  placeholder?: string;
  options?: { label: string; value: string }[];
  href?: string;
  cta?: string;
}

export async function dismissedGaps(): Promise<string[]> {
  try {
    return JSON.parse((await cookies()).get("sh_gaps")?.value ?? "[]");
  } catch {
    return [];
  }
}

export async function nextGap(ctx: FamilyContext): Promise<Gap | null> {
  const skip = new Set(await dismissedGaps());
  const [platforms, invites, gmail, rules, itemCount] = await Promise.all([
    ctx.supabase.from("family_platforms").select("platform_key, child_ids, notification_channels").eq("family_id", ctx.family.id),
    ctx.supabase.from("family_invites").select("id", { count: "exact", head: true }).eq("family_id", ctx.family.id).is("accepted_at", null),
    ctx.supabase.from("gmail_connections").select("status").eq("family_id", ctx.family.id),
    ctx.supabase.from("sender_rules").select("platform_key").eq("family_id", ctx.family.id),
    ctx.supabase.from("items").select("id", { count: "exact", head: true }).eq("family_id", ctx.family.id),
  ]);
  const gaps: Gap[] = [];

  for (const k of ctx.children) if (!k.school_id) gaps.push({ id: `school:${k.id}`, text: `What school does ${k.first_name} go to? Name and town is perfect.`, kind: "text", placeholder: "e.g. Little Oaks Preschool, Kennesaw" });

  if (ctx.children.length > 1)
    for (const p of platforms.data ?? []) if (!p.child_ids.length) {
      const name = PLATFORMS.find((x) => x.key === p.platform_key)?.name ?? p.platform_key;
      gaps.push({ id: `platformkids:${p.platform_key}`, text: `Which of your kids get messages through ${name}?`, kind: "multi", options: ctx.children.map((c) => ({ label: c.first_name, value: c.id })) });
    }

  if (hasAi()) for (const s of ctx.schools) if (!s.calendar_url && !s.website)
    gaps.push({ id: `lookup:${s.id}`, text: `Want me to find ${s.name}'s official calendar online and add the important dates? I'll only search public school websites.`, kind: "action", cta: "Yes, look it up" });

  if (ctx.members.length < 2 && !invites.count)
    gaps.push({ id: "invite", text: "Should anyone else see everything — a partner, co-parent or grandparent? Share their name and email.", kind: "text", placeholder: "e.g. Morgan, morgan@email.com" });

  const usesEmail = (platforms.data ?? []).some((p) => p.notification_channels.includes("email")) || ((ctx.family.context as { channels?: string[] })?.channels ?? []).includes("email");
  const gmailOk = (gmail.data ?? []).some((g) => g.status === "connected");
  if (features.gmail() && usesEmail && !gmailOk) gaps.push({ id: "gmail", text: "School emails are coming in — want me to read them automatically? Connect Gmail (read-only, school senders only).", kind: "link", href: "/api/gmail/connect", cta: "Connect Gmail" });
  if (gmailOk) for (const p of platforms.data ?? []) {
    if (!p.notification_channels.includes("email") || (rules.data ?? []).some((r) => r.platform_key === p.platform_key)) continue;
    const name = PLATFORMS.find((x) => x.key === p.platform_key)?.name ?? p.platform_key;
    gaps.push({ id: `sender:${p.platform_key}`, text: `What email address do ${name} messages come from? Check any recent one in your inbox.`, kind: "text", placeholder: "e.g. notifications@…" });
  }

  if (gmailOk && hasAi()) {
    const { count: unread } = await ctx.supabase.from("source_documents").select("id", { count: "exact", head: true }).eq("family_id", ctx.family.id).eq("channel", "gmail").is("origin_account", null);
    if (unread) gaps.unshift({ id: "reread", text: `New: I can now read the pictures and flyers inside emails — that's often where the details are. Re-check your ${unread} imported ${unread === 1 ? "email" : "emails"}?`, kind: "action", cta: "Yes, re-check them" });
  }

  if ((itemCount.count ?? 0) > 1) {
    const dupes = await findDuplicateItems(ctx);
    if (dupes.length) gaps.unshift({ id: `dupes:${dupes.length}`, text: `I found ${dupes.length} ${dupes.length === 1 ? "thing" : "things"} that showed up in more than one place — like “${dupes[0][0].title}”. Want to combine them?`, kind: "link", href: "/review/duplicates", cta: "Review duplicates" });
  }

  if (!itemCount.count) gaps.push({ id: "firstdoc", text: "Have a school calendar, flyer or newsletter handy? Snap a photo and I'll fill in your calendar.", kind: "link", href: "/add", cta: "Add a photo" });

  return gaps.find((g) => !skip.has(g.id)) ?? null;
}
