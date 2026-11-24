import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { features } from "@/lib/env";
import { decryptSecret } from "@/lib/integrations/crypto";
import { GmailAuthError, GmailProvider, accessTokenFor, type MailProvider } from "@/lib/integrations/gmail";
import { gmailQuery, matchRule } from "@/lib/integrations/rules";
import { createDocument, processDocument, sha256, sniffMime } from "@/lib/pipeline/process";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;
type Conn = Database["public"]["Tables"]["gmail_connections"]["Row"];

const MAX_PER_RUN = 15;

/**
 * Pulls new school emails for one connection into the pipeline. Idempotent:
 * messages are keyed by Gmail id (origin_ref), so re-runs never duplicate.
 * Uses the service client; every query is scoped to conn.family_id.
 */
export async function syncConnection(db: Db, conn: Conn, provider?: MailProvider): Promise<{ fetched: number; created: number; status: string }> {
  const now = new Date().toISOString();
  const familyId = conn.family_id;
  const { data: rules } = await db.from("sender_rules").select("pattern, platform_key, child_id, school_id").eq("family_id", familyId);
  const query = gmailQuery(rules ?? [], conn.last_success_at ? 7 : 30);
  if (!query) {
    await db.from("gmail_connections").update({ last_sync_at: now, last_error: "Add at least one school sender to start reading email." }).eq("id", conn.id);
    return { fetched: 0, created: 0, status: "no_rules" };
  }

  try {
    if (!provider) {
      const { data: secret } = await db.from("integration_secrets").select("ciphertext").eq("kind", "gmail").eq("owner_ref", conn.id).single();
      if (!secret) throw new GmailAuthError("missing token");
      provider = new GmailProvider(await accessTokenFor(decryptSecret(secret.ciphertext)));
    }
    const ids = await provider.list(query, 50);
    const { data: seen } = await db.from("source_documents").select("origin_ref").eq("family_id", familyId).eq("channel", "gmail").in("origin_ref", ids.length ? ids.map((i) => `gmail:${i}`) : ["-"]);
    const seenSet = new Set((seen ?? []).map((s) => s.origin_ref));
    const fresh = ids.filter((i) => !seenSet.has(`gmail:${i}`)).slice(0, MAX_PER_RUN);

    let created = 0;
    for (const id of fresh) {
      const msg = await provider.get(id);
      const rule = matchRule(msg.from, rules ?? []);
      if (!rule) continue; // query matched loosely; enforce rules exactly
      const body = `Subject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.text}`;
      const doc = await createDocument(db, {
        familyId,
        channel: "gmail",
        originRef: `gmail:${id}`,
        contentHash: sha256(`gmail:${id}:${body}`),
        title: msg.subject || "(no subject)",
        sender: msg.from,
        platformKey: rule.platform_key,
        text: body,
        childHintId: rule.child_id,
        schoolHintId: rule.school_id,
        receivedAt: msg.date,
        submittedBy: conn.user_id,
      });
      if (doc.duplicate) continue;
      await db.from("source_documents").update({ origin_account: conn.google_email }).eq("id", doc.id);
      const extraFiles = emailFiles(msg.attachments);
      if (features.ai()) await processDocument(db, doc.id, { extraFiles });
      created++;
    }
    await db
      .from("gmail_connections")
      .update({ status: "connected", last_sync_at: now, last_success_at: now, last_error: null, messages_seen: conn.messages_seen + created })
      .eq("id", conn.id);
    return { fetched: fresh.length, created, status: "ok" };
  } catch (e) {
    const auth = e instanceof GmailAuthError;
    await db
      .from("gmail_connections")
      .update({ status: auth ? "error" : conn.status, last_sync_at: now, last_error: auth ? "Google access expired or was revoked. Reconnect Gmail." : "Sync failed. We'll retry automatically." })
      .eq("id", conn.id);
    console.error("gmail sync failed", conn.id, e instanceof Error ? e.message : e);
    return { fetched: 0, created: 0, status: auth ? "auth_error" : "error" };
  }
}

/** Attachments + inline + web images as extraction inputs (type-checked, total size capped). */
export function emailFiles(attachments: { mime: string; data: Buffer }[]) {
  let total = 0;
  return attachments.flatMap((a) => {
    const mime = sniffMime(a.data);
    if (!mime || total + a.data.byteLength > 20 * 1024 * 1024) return [];
    total += a.data.byteLength;
    return [{ mime, base64: a.data.toString("base64") }];
  });
}

/**
 * Re-reads already-imported emails for the images/attachments they contain
 * (and records which mailbox each came from). New findings go to review;
 * items already saved are matched as duplicates, not re-added.
 */
export async function rereadEmailImages(db: Db, familyId: string, limit = 60): Promise<{ checked: number; withImages: number; newItems: number; remaining: number }> {
  const { data: conns } = await db.from("gmail_connections").select("*").eq("family_id", familyId).eq("status", "connected");
  const providers: { conn: Conn; p: MailProvider }[] = [];

  for (const c of conns ?? []) {
    const { data: secret } = await db.from("integration_secrets").select("ciphertext").eq("kind", "gmail").eq("owner_ref", c.id).maybeSingle();
    if (!secret) continue;
    try {
      providers.push({ conn: c, p: new GmailProvider(await accessTokenFor(decryptSecret(secret.ciphertext))) });
    } catch {
      /* expired: skip this mailbox */
    }
  }
  if (!providers.length) return { checked: 0, withImages: 0, newItems: 0, remaining: -1 };
  const { data: docs } = await db.from("source_documents").select("id, origin_ref, origin_account").eq("family_id", familyId).eq("channel", "gmail").like("origin_ref", "gmail:%").is("origin_account", null).order("received_at", { ascending: false }).limit(limit);
  let withImages = 0;
  let newItems = 0;
  let checked = 0;
  const deadline = Date.now() + 200_000; // stay well inside the 300 s function limit
  const queue = [...(docs ?? [])];
  const worker = async () => {
    while (queue.length && Date.now() < deadline) {
      const d = queue.shift()!;
      const msgId = d.origin_ref!.slice(6);
      let found = false;
      for (const { conn, p } of providers) {
        let msg;
        try { msg = await p.get(msgId); } catch { continue; } // not in this mailbox
        const files = emailFiles(msg.attachments);
        if (files.length && features.ai()) {
          withImages++;
          await processDocument(db, d.id, { extraFiles: files });
          // Items already saved from this same email are the same things: drop them silently.
          const { data: dupes } = await db.from("extraction_candidates").select("id, duplicate_of").eq("document_id", d.id).eq("status", "pending").not("duplicate_of", "is", null);
          for (const c of dupes ?? []) {
            const { count } = await db.from("item_sources").select("item_id", { count: "exact", head: true }).eq("item_id", c.duplicate_of!).eq("document_id", d.id);
            if (count) await db.from("extraction_candidates").update({ status: "rejected" }).eq("id", c.id);
          }
          const { count: left } = await db.from("extraction_candidates").select("id", { count: "exact", head: true }).eq("document_id", d.id).eq("status", "pending");
          newItems += left ?? 0;
          if (!left) await db.from("source_documents").update({ status: "done" }).eq("id", d.id);
        }
        // Mark as checked (and which mailbox) only once done, so a timeout resumes cleanly.
        await db.from("source_documents").update({ origin_account: conn.google_email, submitted_by: conn.user_id }).eq("id", d.id);
        found = true;
        break;
      }
      // No connected mailbox has it anymore (deleted/archived elsewhere): mark checked, no inbox link.
      if (!found) await db.from("source_documents").update({ origin_account: "" }).eq("id", d.id);
      checked++;
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  return { checked, withImages, newItems, remaining: queue.length };
}

export async function syncAllGmail(db: Db) {
  if (!features.gmail()) return { skipped: "not configured" };
  const { data: conns } = await db.from("gmail_connections").select("*").neq("status", "revoked");
  let created = 0;
  for (const c of conns ?? []) created += (await syncConnection(db, c)).created;
  return { connections: conns?.length ?? 0, created };
}
