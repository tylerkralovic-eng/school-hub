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
      });
      if (doc.duplicate) continue;
      // Attachments (flyers, calendars) become part of the same extraction.
      const extraFiles = msg.attachments.flatMap((a) => {
        const mime = sniffMime(a.data);
        return mime ? [{ mime, base64: a.data.toString("base64") }] : [];
      });
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

export async function syncAllGmail(db: Db) {
  if (!features.gmail()) return { skipped: "not configured" };
  const { data: conns } = await db.from("gmail_connections").select("*").neq("status", "revoked");
  let created = 0;
  for (const c of conns ?? []) created += (await syncConnection(db, c)).created;
  return { connections: conns?.length ?? 0, created };
}
