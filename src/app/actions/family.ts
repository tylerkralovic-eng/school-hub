"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { env } from "@/lib/env";
import { audit, getUser, requireFamily } from "@/lib/server/context";
import { escapeHtml, sendEmail } from "@/lib/server/email";
import { CHILD_COLORS } from "@/lib/types";

const tz = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Unknown time zone");

const name = (max: number, label: string) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

const onboardingSchema = z.object({
  familyName: name(80, "Family name"),
  displayName: name(60, "Your name"),
  timezone: tz,
  children: z
    .array(z.object({ firstName: name(40, "Child's name"), grade: z.string().trim().max(30), school: z.string().trim().max(120) }))
    .min(1, "Add at least one child"),
});

/** Creates the family, schools (deduplicated by name) and children. */
export async function completeOnboarding(_: ActionState, form: FormData): Promise<ActionState> {
  const firstNames = form.getAll("child_name");
  const grades = form.getAll("child_grade");
  const schools = form.getAll("child_school");
  const parsed = onboardingSchema.safeParse({
    familyName: form.get("family_name"),
    displayName: form.get("display_name"),
    timezone: form.get("timezone"),
    children: firstNames
      .map((n, i) => ({ firstName: String(n ?? ""), grade: String(grades[i] ?? ""), school: String(schools[i] ?? "") }))
      .filter((c) => c.firstName.trim() !== ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data: familyId, error } = await supabase.rpc("create_family", {
    p_name: parsed.data.familyName,
    p_timezone: parsed.data.timezone,
    p_display_name: parsed.data.displayName,
  });
  if (error || !familyId) return { error: error?.message.includes("already") ? "You already belong to a family." : "Could not create your family. Please try again." };

  const schoolIds = new Map<string, string>();
  for (const c of parsed.data.children) {
    const key = c.school.toLowerCase();
    if (c.school && !schoolIds.has(key)) {
      const { data } = await supabase.from("schools").insert({ family_id: familyId, name: c.school }).select("id").single();
      if (data) schoolIds.set(key, data.id);
    }
  }
  const { error: kidsErr } = await supabase.from("children").insert(
    parsed.data.children.map((c, i) => ({
      family_id: familyId,
      first_name: c.firstName,
      grade: c.grade || null,
      school_id: c.school ? (schoolIds.get(c.school.toLowerCase()) ?? null) : null,
      color: CHILD_COLORS[i % CHILD_COLORS.length],
    })),
  );
  if (kidsErr) return { error: "Family created, but adding children failed. You can add them in Settings." };
  redirect("/?welcome=1");
}

// ------------------------------------------------------------------ children

const childSchema = z.object({
  firstName: name(40, "Name"),
  grade: z.string().trim().max(30).optional(),
  schoolId: z.string().uuid().optional().or(z.literal("")),
  aliases: z.string().max(400).optional(),
  color: z.enum(CHILD_COLORS).optional(),
});

function parseAliases(s?: string) {
  return (s ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function saveChild(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const parsed = childSchema.safeParse({
    firstName: form.get("first_name"),
    grade: form.get("grade") ?? undefined,
    schoolId: form.get("school_id") ?? undefined,
    aliases: form.get("aliases") ?? undefined,
    color: form.get("color") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = form.get("id");
  const row = {
    first_name: parsed.data.firstName,
    grade: parsed.data.grade || null,
    school_id: parsed.data.schoolId || null,
    aliases: parseAliases(parsed.data.aliases),
    ...(parsed.data.color ? { color: parsed.data.color } : {}),
  };
  const { error } = id
    ? await ctx.supabase.from("children").update(row).eq("id", String(id)).eq("family_id", ctx.family.id)
    : await ctx.supabase.from("children").insert({ ...row, family_id: ctx.family.id, color: parsed.data.color ?? CHILD_COLORS[ctx.children.length % CHILD_COLORS.length] });
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

export async function deleteChild(form: FormData) {
  const ctx = await requireFamily();
  await ctx.supabase.from("children").delete().eq("id", String(form.get("id"))).eq("family_id", ctx.family.id);
  await audit(ctx, "child.deleted", String(form.get("id")));
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ schools

export async function saveSchool(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const parsed = z.object({ name: name(120, "School name"), shortName: z.string().trim().max(40).optional() }).safeParse({
    name: form.get("name"),
    shortName: form.get("short_name") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = form.get("id");
  const row = { name: parsed.data.name, short_name: parsed.data.shortName || null };
  const { error } = id
    ? await ctx.supabase.from("schools").update(row).eq("id", String(id)).eq("family_id", ctx.family.id)
    : await ctx.supabase.from("schools").insert({ ...row, family_id: ctx.family.id });
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

export async function deleteSchool(form: FormData) {
  const ctx = await requireFamily();
  await ctx.supabase.from("schools").delete().eq("id", String(form.get("id"))).eq("family_id", ctx.family.id);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ family & profile

export async function updateFamily(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  if (ctx.me.role !== "owner") return { error: "Only the family owner can change these settings." };
  const parsed = z
    .object({ name: name(80, "Family name"), timezone: tz, retention: z.enum(["", "90", "180", "365"]) })
    .safeParse({ name: form.get("name"), timezone: form.get("timezone"), retention: form.get("retention") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await ctx.supabase
    .from("families")
    .update({ name: parsed.data.name, timezone: parsed.data.timezone, document_retention_days: parsed.data.retention ? Number(parsed.data.retention) : null })
    .eq("id", ctx.family.id);
  if (error) return { error: "Could not save." };
  await audit(ctx, "family.updated");
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const parsed = name(60, "Name").safeParse(form.get("display_name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await ctx.supabase
    .from("family_members")
    .update({ display_name: parsed.data, digest_enabled: form.get("digest") === "on" })
    .eq("family_id", ctx.family.id)
    .eq("user_id", ctx.userId);
  if (error) return { error: "Could not save." };
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

// ------------------------------------------------------------------ invitations

export async function createInvite(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address" };
  if (ctx.members.some((m) => m.email.toLowerCase() === email.data)) return { error: "That person is already in your family." };

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await ctx.supabase.from("family_invites").insert({
    family_id: ctx.family.id,
    email: email.data,
    token_hash: tokenHash,
    invited_by: ctx.userId,
  });
  if (error) return { error: "Could not create the invitation." };
  await audit(ctx, "invite.created", email.data);

  const link = `${env.appUrl()}/invite/${token}`;
  const sent = await sendEmail(
    email.data,
    `${ctx.me.display_name} invited you to ${ctx.family.name} on School Hub`,
    `${ctx.me.display_name} invited you to share ${ctx.family.name}'s school updates on School Hub.\n\nAccept: ${link}\n\nThis link expires in 7 days.`,
    `<p>${escapeHtml(ctx.me.display_name)} invited you to share <b>${escapeHtml(ctx.family.name)}</b>'s school updates on School Hub.</p><p><a href="${link}">Accept the invitation</a></p><p>This link expires in 7 days.</p>`,
  );
  revalidatePath("/settings");
  return {
    ok: sent ? `Invitation emailed to ${email.data}. You can also share this link:` : `Share this link with ${email.data} (email isn't set up, so send it by text):`,
    link,
  };
}

export async function revokeInvite(form: FormData) {
  const ctx = await requireFamily();
  await ctx.supabase.from("family_invites").delete().eq("id", String(form.get("id"))).eq("family_id", ctx.family.id);
  revalidatePath("/settings");
}

export async function acceptInvite(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const displayName = name(60, "Your name").safeParse(form.get("display_name"));
  if (!displayName.success) return { error: displayName.error.issues[0].message };
  const { error } = await supabase.rpc("accept_invite", { p_token: String(form.get("token")), p_display_name: displayName.data });
  if (error) return { error: error.message.replace(/^.*?: /, "") };
  redirect("/?welcome=1");
}

export async function removeMember(form: FormData) {
  const ctx = await requireFamily();
  const userId = String(form.get("user_id"));
  if (userId !== ctx.userId && ctx.me.role !== "owner") return;
  if (userId === ctx.userId && ctx.me.role === "owner" && ctx.members.length > 1) return; // owner must stay while others remain
  await ctx.supabase.from("family_members").delete().eq("family_id", ctx.family.id).eq("user_id", userId);
  await audit(ctx, "member.removed", userId);
  revalidatePath("/", "layout");
  if (userId === ctx.userId) redirect("/onboarding");
}
