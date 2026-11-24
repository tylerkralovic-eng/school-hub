"use server";

import { randomBytes, createHash, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/forms";
import { env, features } from "@/lib/env";
import { decryptSecret } from "@/lib/integrations/crypto";
import { GmailAuthError, GmailProvider, accessTokenFor, revokeToken } from "@/lib/integrations/gmail";
import { discoverSchoolSenders } from "@/lib/integrations/discover-ai";
import type { SenderSuggestion } from "@/lib/integrations/discover";
import { rereadEmailImages, syncConnection } from "@/lib/integrations/gmail-sync";
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
  gmail: { connectedEmail: string | null; needsReconnect: boolean; ruleCount: number } | null;
  icsUrl: string;
  appUrl: string;
}

/** Everything the one-tap connect steps need, for the signed-in parent. */
export async function getConnectStatus(): Promise<ConnectStatus> {
  const ctx = await requireFamily();
  const [phones, gmail, rules] = await Promise.all([
    ctx.supabase.from("member_phones").select("phone_e164, verified_at, verification_code, code_expires_at").eq("user_id", ctx.userId),
    ctx.supabase.from("gmail_connections").select("google_email, status").eq("user_id", ctx.userId).maybeSingle(),
    ctx.supabase.from("sender_rules").select("id", { count: "exact", head: true }).eq("family_id", ctx.family.id),
  ]);
  const linked = (phones.data ?? []).find((p) => p.verified_at);
  const pending = (phones.data ?? []).find((p) => !p.verified_at && p.code_expires_at && new Date(p.code_expires_at) > new Date());
  return {
    sms: features.sms() ? { number: env.twilioPhoneNumber()!, linkedPhone: linked?.phone_e164 ?? null, pendingCode: pending?.verification_code ?? null } : null,
    gmail: features.gmail() ? { connectedEmail: gmail.data?.status === "connected" ? gmail.data.google_email : null, needsReconnect: gmail.data?.status === "error", ruleCount: rules.count ?? 0 } : null,
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


// ------------------------------------------------------------------ school sender discovery

/** Scans who emailed this parent recently (headers only) and suggests school senders to approve. */
export async function discoverSenders(): Promise<{ suggestions?: SenderSuggestion[]; scanned?: number; error?: string }> {
  const ctx = await requireFamily();
  const db = createAdminClient();
  const { data: conn } = await db.from("gmail_connections").select("id, status").eq("family_id", ctx.family.id).eq("user_id", ctx.userId).maybeSingle();
  if (!conn) return { error: "Connect your Gmail first." };
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { count } = await db.from("audit_events").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("action", "gmail.discover").gte("created_at", since);
  if ((count ?? 0) >= 3) return { error: "Give it a minute and try again." };
  await audit(ctx, "gmail.discover");
  try {
    const { data: secret } = await db.from("integration_secrets").select("ciphertext").eq("kind", "gmail").eq("owner_ref", conn.id).single();
    if (!secret) throw new GmailAuthError("missing token");
    const provider = new GmailProvider(await accessTokenFor(decryptSecret(secret.ciphertext)));
    const { data: rules } = await ctx.supabase.from("sender_rules").select("pattern").eq("family_id", ctx.family.id);
    const r = await discoverSchoolSenders(provider, {
      kids: ctx.children.map((k) => ({ first_name: k.first_name, school: ctx.schools.find((s) => s.id === k.school_id)?.name ?? null })),
      existingPatterns: (rules ?? []).map((x) => x.pattern),
    });
    return { suggestions: r.suggestions, scanned: r.scanned };
  } catch (e) {
    if (e instanceof GmailAuthError) {
      await db.from("gmail_connections").update({ status: "error", last_error: "Google access expired or was revoked. Reconnect Gmail." }).eq("id", conn.id);
      return { error: "Google access expired — tap Reconnect Gmail." };
    }
    console.error("discover failed", e instanceof Error ? e.message : e);
    return { error: "Couldn't look through your email right now. Please try again." };
  }
}

/** Saves the senders the parent approved and checks for their emails right away. */
export async function approveSenders(picks: { pattern: string; platform_key: string | null; child_name: string | null }[]): Promise<{ added: number; found: number; error?: string }> {
  const ctx = await requireFamily();
  const rows = picks.slice(0, 60).flatMap((p) => {
    const pattern = normalizePattern(p.pattern);
    if (!pattern || ["@gmail.com", "@yahoo.com", "@outlook.com", "@hotmail.com", "@icloud.com", "@aol.com"].includes(pattern)) return [];
    const child = ctx.children.find((c) => c.first_name.toLowerCase() === p.child_name?.toLowerCase());
    return [{ family_id: ctx.family.id, pattern, platform_key: PLATFORMS.some((x) => x.key === p.platform_key) ? p.platform_key : null, child_id: child?.id ?? null, school_id: child?.school_id ?? null }];
  });
  if (!rows.length) return { added: 0, found: 0, error: "Pick at least one sender." };
  const { error } = await ctx.supabase.from("sender_rules").upsert(rows, { onConflict: "family_id,pattern", ignoreDuplicates: true });
  if (error) return { added: 0, found: 0, error: "Couldn't save those senders." };
  // Make sure apps the family uses show up as covered by email.
  for (const key of [...new Set(rows.map((r) => r.platform_key).filter(Boolean) as string[])]) {
    await ctx.supabase.from("family_platforms").upsert({ family_id: ctx.family.id, platform_key: key, notification_channels: ["email"] }, { onConflict: "family_id,platform_key", ignoreDuplicates: true });
  }
  await audit(ctx, "gmail.senders_approved", undefined, { count: rows.length });
  const db = createAdminClient();
  const { data: conn } = await db.from("gmail_connections").select("*").eq("family_id", ctx.family.id).eq("user_id", ctx.userId).maybeSingle();
  const res = conn ? await syncConnection(db, conn) : { created: 0 };
  revalidatePath("/", "layout");
  return { added: rows.length, found: res.created };
}


/** One-time: re-read imported emails for their pictures and flyers. */
export async function rereadImages(): Promise<{ reply: string }> {
  const ctx = await requireFamily();
  const r = await rereadEmailImages(createAdminClient(), ctx.family.id);
  await audit(ctx, "gmail.reread_images", undefined, r);
  revalidatePath("/", "layout");
  if (r.remaining === -1) return { reply: "Google access expired — reconnect Gmail on the Connect page, then try again." };
  const more = r.remaining ? ` ${r.remaining} more to go — I'll ask again in a moment.` : "";
  return { reply: (r.withImages ? `Checked ${r.checked} emails — ${r.withImages} had pictures or flyers, with ${r.newItems} new things to look at in Review.` : `Checked ${r.checked} emails — no pictures or flyers with extra details.`) + more };
}
