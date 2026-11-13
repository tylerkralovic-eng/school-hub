import { after, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { processDocument } from "@/lib/pipeline/process";
import { ingestSubmission } from "@/lib/server/ingest-files";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

/**
 * Personal ingest endpoint for the iOS Shortcut ("Share to School Hub").
 * Auth: Authorization: Bearer shk_… (per-parent key; only its hash is stored).
 * Body: multipart (files[] and/or text) or JSON { text }.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer shk_") ? auth.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Missing key" }, { status: 401 });
  const db = createAdminClient();
  const { data: t } = await db.from("ingest_tokens").select("id, family_id, user_id").eq("token_hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
  if (!t) return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  const { data: member } = await db.from("family_members").select("user_id").eq("family_id", t.family_id).eq("user_id", t.user_id).maybeSingle();
  if (!member) return NextResponse.json({ error: "Key no longer valid" }, { status: 401 });

  // Rate limit: 40 documents per hour per parent.
  const { count } = await db.from("source_documents").select("id", { count: "exact", head: true }).eq("submitted_by", t.user_id).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 40) return NextResponse.json({ error: "Too many uploads — try again later" }, { status: 429 });

  let text: string | null = null;
  const files: { name: string; data: Uint8Array }[] = [];
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    text = (form.get("text") as string | null) ?? null;
    for (const v of form.getAll("files").concat(form.getAll("file"))) {
      if (v instanceof File) files.push({ name: v.name || "shared", data: new Uint8Array(await v.arrayBuffer()) });
    }
  } else if (type.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as { text?: string };
    text = typeof j.text === "string" ? j.text : null;
  } else {
    text = await req.text();
  }
  if (!files.length && !text?.trim()) return NextResponse.json({ error: "Nothing to add" }, { status: 400 });

  const { batchId, docIds, rejected } = await ingestSubmission(db, { familyId: t.family_id, userId: t.user_id, channel: "share", files, text });
  await db.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", t.id);
  after(async () => {
    for (const id of docIds) await processDocument(db, id);
  });
  return NextResponse.json({ ok: true, added: docIds.length, rejected, review_url: `${env.appUrl()}/review/${batchId}` });
}
