"use server";

import { randomBytes, createHash, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/forms";
import { env, features } from "@/lib/env";
import { decryptSecret } from "@/lib/integrations/crypto";
import { revokeToken } from "@/lib/integrations/gmail";
import { syncConnection } from "@/lib/integrations/gmail-sync";
import { normalizePattern } from "@/lib/integrations/rules";
import { PLATFORMS } from "@/lib/platforms";
import { audit, requireFamily } from "@/lib/server/context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function addSenderRule(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const pattern = normalizePattern(String(form.get("pattern") ?? ""));
  if (!pattern) return { error: "Enter an email address (teacher@school.org) or a domain (@school.org)." };
  if (["@gmail.com", "@yahoo.com", "@outlook.com", "@hotmail.com", "@icloud.com", "@aol.com"].includes(pattern)) return { error: "That's a personal email domain — add the specific address instead." };
  const platform = String(form.get("platform") ?? "");
  const who = String(form.get("who") ?? "");
  const child = ctx.children.find((c) => c.id === who);
  const school = who.startsWith("school:") ? ctx.schools.find((s) => s.id === who.slice(7)) : undefined;
  const { error } = await ctx.supabase.from("sender_rules").insert({
    family_id: ctx.family.id,
    pattern,
    platform_key: PLATFORMS.some((p) => p.key === platform) ? platform : null,
    child_id: child?.id ?? null,
    school_id: child?.school_id ?? school?.id ?? null,
  });
  if (error) return { error: error.code === "23505" ? "That sender is already on the list." : "Couldn't add that sender." };
  revalidatePath("/connections");
  return { ok: `Added ${pattern}` };
}

export async function deleteSenderRule(form: FormData) {
  const ctx = await requireFamily();
  await ctx.supabase.from("sender_rules").delete().eq("id", String(form.get("id"))).eq("family_id", ctx.family.id);
  revalidatePath("/connections");
}

export async function syncGmailNow() {
  const ctx = await requireFamily();
  const { data: conns } = await ctx.supabase.from("gmail_connections").select("*").eq("family_id", ctx.family.id);
  const db = createAdminClient();
  for (const c of conns ?? []) {
    // Simple rate limit: at most once per 2 minutes per connection.
    if (c.last_sync_at && Date.now() - new Date(c.last_sync_at).getTime() < 120_000) continue;
    await syncConnection(db, c);
  }
  revalidatePath("/", "layout");
}

export async function disconnectGmail(form: FormData) {
  const ctx = await requireFamily();
  const id = String(form.get("id"));
  const { data: conn } = await ctx.supabase.from("gmail_connections").select("id, user_id").eq("id", id).eq("family_id", ctx.family.id).maybeSingle();
  if (!conn || conn.user_id !== ctx.userId) return;
  const db = createAdminClient();
  const { data: secret } = await db.from("integration_secrets").select("ciphertext").eq("kind", "gmail").eq("owner_ref", conn.id).maybeSingle();
  if (secret) {
    try {
      await revokeToken(decryptSecret(secret.ciphertext));
    } catch {
      /* best effort */
    }
  }
  await db.from("integration_secrets").delete().eq("kind", "gmail").eq("owner_ref", conn.id);
  await db.from("gmail_connections").delete().eq("id", conn.id);
  await audit(ctx, "gmail.disconnected");
  revalidatePath("/connections");
}

// ------------------------------------------------------------------ platforms

export async function savePlatform(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const key = String(form.get("platform"));
  if (!PLATFORMS.some((p) => p.key === key)) return { error: "Unknown platform" };
  const childIds = form.getAll("child").map(String).filter((id) => ctx.children.some((c) => c.id === id));
  const channels = form.getAll("channel").map(String).filter((c) => ["email", "sms", "push", "app"].includes(c));
  const { error } = await ctx.supabase.from("family_platforms").upsert({ family_id: ctx.family.id, platform_key: key, child_ids: childIds, notification_channels: channels }, { onConflict: "family_id,platform_key" });
  if (error) return { error: "Couldn't save." };
  revalidatePath("/connections");
  return { ok: "Saved" };
}

export async function removePlatform(form: FormData) {
  const ctx = await requireFamily();
  await ctx.supabase.from("family_platforms").delete().eq("family_id", ctx.family.id).eq("platform_key", String(form.get("platform")));
  revalidatePath("/connections");
}

// ------------------------------------------------------------------ SMS phone linking

/** Starts phone linking: the parent texts this code FROM their phone TO School Hub's number. */
export async function startPhoneLink(): Promise<{ code: string }> {
  const ctx = await requireFamily();
  const code = `LINK ${randomInt(100000, 999999)}`;
  const db = createAdminClient();
  await db.from("member_phones").delete().eq("user_id", ctx.userId).is("verified_at", null);
  await db.from("member_phones").insert({ family_id: ctx.family.id, user_id: ctx.userId, verification_code: code, code_expires_at: new Date(Date.now() + 30 * 60_000).toISOString() });
  return { code };
}

export interface ConnectStatus {
  sms: { number: string; linkedPhone: string | null; pendingCode: string | null } | null; // null = not available on this server
  gmail: { connectedEmail: string | null; needsReconnect: boolean } | null;
  icsUrl: string;
  appUrl: string;
}

/** Everything the one-tap connect steps need, for the signed-in parent. */
export async function getConnectStatus(): Promise<ConnectStatus> {
  const ctx = await requireFamily();
  const [phones, gmail] = await Promise.all([
    ctx.supabase.from("member_phones").select("phone_e164, verified_at, verification_code, code_expires_at").eq("user_id", ctx.userId),
    ctx.supabase.from("gmail_connections").select("google_email, status").eq("user_id", ctx.userId).maybeSingle(),
  ]);
  const linked = (phones.data ?? []).find((p) => p.verified_at);
  const pending = (phones.data ?? []).find((p) => !p.verified_at && p.code_expires_at && new Date(p.code_expires_at) > new Date());
  return {
    sms: features.sms() ? { number: env.twilioPhoneNumber()!, linkedPhone: linked?.phone_e164 ?? null, pendingCode: pending?.verification_code ?? null } : null,
    gmail: features.gmail() ? { connectedEmail: gmail.data?.status === "connected" ? gmail.data.google_email : null, needsReconnect: gmail.data?.status === "error" } : null,
    icsUrl: `${env.appUrl()}/api/calendar/${ctx.family.calendar_token}.ics`,
    appUrl: env.appUrl(),
  };
}

export async function unlinkPhone(form: FormData) {
  const ctx = await requireFamily();
  await ctx.supabase.from("member_phones").delete().eq("id", String(form.get("id"))).eq("user_id", ctx.userId);
  await audit(ctx, "sms.phone_unlinked");
  revalidatePath("/connections");
}

// ------------------------------------------------------------------ share tokens (iOS Shortcut)

export async function createIngestToken(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const token = `shk_${randomBytes(24).toString("base64url")}`;
  const db = createAdminClient();
  const label = String(form.get("label") ?? "iPhone Shortcut").slice(0, 40) || "iPhone Shortcut";
  await db.from("ingest_tokens").insert({ family_id: ctx.family.id, user_id: ctx.userId, label, token_hash: createHash("sha256").update(token).digest("hex") });
  await audit(ctx, "ingest_token.created", label);
  revalidatePath("/connections");
  return { ok: "Copy this key into the Shortcut now — it won't be shown again:", link: token };
}

export async function revokeIngestToken(form: FormData) {
  const ctx = await requireFamily();
  await ctx.supabase.from("ingest_tokens").delete().eq("id", String(form.get("id"))).eq("user_id", ctx.userId);
  await audit(ctx, "ingest_token.revoked");
  revalidatePath("/connections");
}
