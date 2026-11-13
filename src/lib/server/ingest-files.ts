import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ALLOWED_MIME, MAX_FILE_BYTES, createDocument, sha256, sniffMime } from "@/lib/pipeline/process";
import type { Database } from "@/lib/supabase/database.types";
import type { Channel } from "@/lib/types";

/**
 * Stores files + text from a share/SMS/Shortcut submission as source documents
 * in one batch. Validates type by content (magic bytes), not by claimed type.
 * Returns created document ids (repeats are skipped).
 */
export async function ingestSubmission(
  db: SupabaseClient<Database>,
  opts: { familyId: string; userId: string | null; channel: Channel; files: { name: string; data: Uint8Array }[]; text?: string | null; sender?: string | null; originRef?: string | null; title?: string | null },
): Promise<{ batchId: string; docIds: string[]; rejected: string[] }> {
  const batchId = randomUUID();
  const docIds: string[] = [];
  const rejected: string[] = [];
  for (const [i, f] of opts.files.slice(0, 10).entries()) {
    const mime = sniffMime(f.data);
    if (!mime || !ALLOWED_MIME.includes(mime) || f.data.byteLength > MAX_FILE_BYTES) {
      rejected.push(f.name);
      continue;
    }
    const id = randomUUID();
    const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1];
    const path = `${opts.familyId}/${id}/${(f.name.replace(/[^\w.\-]+/g, "_").replace(/\.[^.]*$/, "") || "shared").slice(0, 60)}.${ext}`;
    const doc = await createDocument(db, {
      id,
      familyId: opts.familyId,
      batchId,
      channel: opts.channel,
      contentHash: sha256(f.data),
      originRef: opts.originRef ? `${opts.originRef}:${i}` : null,
      title: opts.title || f.name,
      sender: opts.sender,
      mimeType: mime,
      storagePath: path,
      submittedBy: opts.userId,
    });
    if (doc.duplicate) continue;
    const up = await db.storage.from("documents").upload(path, f.data, { contentType: mime });
    if (up.error) {
      await db.from("source_documents").update({ status: "failed", error: "File storage failed" }).eq("id", doc.id);
      continue;
    }
    docIds.push(doc.id);
  }
  const text = opts.text?.trim();
  if (text && text.length >= 3) {
    const doc = await createDocument(db, {
      familyId: opts.familyId,
      batchId,
      channel: opts.channel,
      contentHash: sha256(`${opts.channel}:${text}`),
      originRef: opts.originRef ?? null,
      title: opts.title || text.split("\n")[0].slice(0, 80),
      sender: opts.sender,
      text: text.slice(0, 50_000),
      submittedBy: opts.userId,
    });
    if (!doc.duplicate) docIds.push(doc.id);
  }
  return { batchId, docIds, rejected };
}
