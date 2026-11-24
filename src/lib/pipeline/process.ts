import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { ExtractionError, extract, type ExtractFile } from "@/lib/pipeline/extract";
import { findDuplicate, type Comparable } from "@/lib/pipeline/dedupe";
import { normalizeItems } from "@/lib/pipeline/normalize";
import { addDays, fmt, utcToZoned, zonedToUtc } from "@/lib/time";
import type { Channel } from "@/lib/types";

/**
 * Ingestion pipeline shared by every channel:
 * Ingest → identify source → extract → classify → match child → dedupe → review → save.
 * Functions take a Supabase client: the user's (RLS-scoped) for in-app uploads,
 * or the service client for webhooks/cron — callers must pass a verified familyId.
 */
type Db = SupabaseClient<Database>;

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function sha256(data: string | Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Verifies file content matches its claimed type (magic bytes). */
export function sniffMime(buf: Uint8Array): (typeof ALLOWED_MIME)[number] | null {
  const b = buf;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  return null;
}

export interface NewDocument {
  familyId: string;
  batchId?: string;
  channel: Channel;
  contentHash: string;
  originRef?: string | null;
  title?: string | null;
  sender?: string | null;
  platformKey?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  text?: string | null;
  childHintId?: string | null;
  schoolHintId?: string | null;
  receivedAt?: string;
  submittedBy?: string | null;
  id?: string;
}

/** Inserts a source document, or returns the existing one when it's a repeat (idempotent). */
export async function createDocument(db: Db, d: NewDocument): Promise<{ id: string; batchId: string; duplicate: boolean; status: string }> {
  const existing = await db
    .from("source_documents")
    .select("id, batch_id, status")
    .eq("family_id", d.familyId)
    .or(d.originRef ? `content_hash.eq.${d.contentHash},origin_ref.eq.${d.originRef}` : `content_hash.eq.${d.contentHash}`)
    .limit(1)
    .maybeSingle();
  if (existing.data) return { id: existing.data.id, batchId: existing.data.batch_id, duplicate: true, status: existing.data.status };

  const { data, error } = await db
    .from("source_documents")
    .insert({
      ...(d.id ? { id: d.id } : {}),
      family_id: d.familyId,
      ...(d.batchId ? { batch_id: d.batchId } : {}),
      channel: d.channel,
      content_hash: d.contentHash,
      origin_ref: d.originRef ?? null,
      title: d.title?.slice(0, 200) ?? null,
      sender: d.sender?.slice(0, 200) ?? null,
      platform_key: d.platformKey ?? null,
      mime_type: d.mimeType ?? null,
      storage_path: d.storagePath ?? null,
      text_content: d.text?.slice(0, 100_000) ?? null,
      child_hint_id: d.childHintId ?? null,
      school_hint_id: d.schoolHintId ?? null,
      received_at: d.receivedAt ?? new Date().toISOString(),
      submitted_by: d.submittedBy ?? null,
    })
    .select("id, batch_id, status")
    .single();
  if (error || !data) {
    // Lost a race with an identical insert: treat as duplicate.
    if (error?.code === "23505") {
      const again = await db.from("source_documents").select("id, batch_id, status").eq("family_id", d.familyId).eq("content_hash", d.contentHash).maybeSingle();
      if (again.data) return { id: again.data.id, batchId: again.data.batch_id, duplicate: true, status: again.data.status };
    }
    throw new Error(`Could not save document: ${error?.message}`);
  }
  return { id: data.id, batchId: data.batch_id, duplicate: false, status: data.status };
}

/** Runs AI extraction for one document and stores review candidates. Never throws. */
export async function processDocument(db: Db, documentId: string, opts: { extraFiles?: ExtractFile[] } = {}): Promise<{ status: string; candidates: number; error?: string }> {
  const { data: doc } = await db.from("source_documents").select("*").eq("id", documentId).single();
  if (!doc) return { status: "failed", candidates: 0, error: "Document not found" };

  const fail = async (message: string) => {
    await db.from("source_documents").update({ status: "failed", error: message, processed_at: new Date().toISOString() }).eq("id", doc.id);
    return { status: "failed", candidates: 0, error: message };
  };

  await db.from("source_documents").update({ status: "processing", error: null }).eq("id", doc.id);

  const [{ data: family }, { data: children }, { data: schools }] = await Promise.all([
    db.from("families").select("timezone").eq("id", doc.family_id).single(),
    db.from("children").select("id, first_name, grade, school_id, aliases").eq("family_id", doc.family_id),
    db.from("schools").select("id, name").eq("family_id", doc.family_id),
  ]);
  if (!family) return fail("Family not found");
  const tz = family.timezone;

  const files: ExtractFile[] = [...(opts.extraFiles ?? [])];
  if (doc.storage_path) {
    const dl = await db.storage.from("documents").download(doc.storage_path);
    if (dl.error || !dl.data) return fail("The uploaded file couldn't be read. Please upload it again.");
    const buf = new Uint8Array(await dl.data.arrayBuffer());
    if (buf.byteLength > MAX_FILE_BYTES) return fail("File is larger than 20 MB.");
    const mime = sniffMime(buf);
    if (!mime) return fail("Unsupported file type. Use a photo (JPEG/PNG/WebP) or a PDF.");
    if (sha256(buf) !== doc.content_hash) return fail("Upload was corrupted. Please try again.");
    files.push({ mime, base64: Buffer.from(buf).toString("base64") });
  }
  if (!files.length && !doc.text_content?.trim()) return fail("Nothing to read in this document.");

  const kids = children ?? [];
  const hintChild = kids.find((c) => c.id === doc.child_hint_id);
  const hintSchool = (schools ?? []).find((s) => s.id === doc.school_hint_id);

  let extraction;
  try {
    extraction = await extract({
      text: doc.text_content,
      files,
      channel: doc.channel,
      sender: doc.sender,
      subject: doc.title,
      receivedAt: doc.received_at,
      receivedLocal: fmt(doc.received_at, tz, { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }),
      timezone: tz,
      roster: { children: kids, schools: schools ?? [] },
      hint: { childName: hintChild?.first_name, schoolName: hintSchool?.name },
    });
  } catch (e) {
    console.error("extraction failed", documentId, e instanceof Error ? e.message : e);
    return fail(e instanceof ExtractionError ? e.userMessage : "Something went wrong reading this document. Please retry.");
  }

  const drafts = normalizeItems(extraction.items, { timezone: tz, children: kids, schools: schools ?? [] }, {
    childId: doc.child_hint_id,
    schoolId: doc.school_hint_id,
    receivedDate: utcToZoned(doc.received_at, tz).date,
  });

  // Duplicate check against existing items around the candidate dates.
  const dates = drafts.map((d) => d.starts_at ?? d.due_at).filter(Boolean) as string[];
  let existing: Comparable[] = [];
  if (drafts.length) {
    let q = db.from("items").select("id, kind, category, title, starts_at, ends_at, due_at, child_id, school_id").eq("family_id", doc.family_id).limit(500);
    if (dates.length) {
      const min = zonedToUtc(addDays(utcToZoned(dates.reduce((a, b) => (a < b ? a : b)), tz).date, -1), null, tz);
      const max = zonedToUtc(addDays(utcToZoned(dates.reduce((a, b) => (a > b ? a : b)), tz).date, 2), null, tz);
      q = q.or(`and(starts_at.gte.${min},starts_at.lt.${max}),and(due_at.gte.${min},due_at.lt.${max}),and(starts_at.is.null,due_at.is.null)`);
    } else q = q.is("starts_at", null).is("due_at", null);
    existing = (await q).data ?? [];
  }

  const rows = drafts.map((d, i) => ({ ...d, family_id: doc.family_id, document_id: doc.id, position: i, duplicate_of: findDuplicate(d, existing, tz) }));
  await db.from("extraction_candidates").delete().eq("document_id", doc.id).eq("status", "pending");
  if (rows.length) {
    const ins = await db.from("extraction_candidates").insert(rows);
    if (ins.error) return fail("Couldn't save the extracted items. Please retry.");
  }

  const userSent = doc.channel === "upload" || doc.channel === "paste" || doc.channel === "share";
  const status = rows.length ? "needs_review" : extraction.is_school_related || userSent ? "done" : "ignored";
  await db
    .from("source_documents")
    .update({
      status,
      ai_summary: extraction.summary.slice(0, 1000),
      is_school_related: extraction.is_school_related,
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", doc.id);
  return { status, candidates: rows.length };
}

export interface Decision {
  id: string;
  include: boolean;
  merge: boolean; // when duplicate_of is set: attach as another source instead of creating
  kind: "event" | "task" | "announcement";
  title: string;
  details: string | null;
  who: string; // "" family | "school:<id>" | child id
  date: string | null;
  time: string | null;
  endDate: string | null;
  endTime: string | null;
  location: string | null;
}

/** Applies the parent's review: creates items (or merges into duplicates) with provenance. */
export async function applyReview(
  db: Db,
  ctx: { familyId: string; userId: string; timezone: string; children: { id: string; school_id: string | null }[]; schools: { id: string }[] },
  decisions: Decision[],
  members: Record<string, string> = {}, // memberCandidateId -> primaryCandidateId (same thing, other source)
): Promise<{ created: number; merged: number; rejected: number; errors: string[] }> {
  const ids = [...decisions.map((d) => d.id), ...Object.keys(members)];
  const { data: cands } = await db.from("extraction_candidates").select("*").in("id", ids).eq("family_id", ctx.familyId).eq("status", "pending");
  const byId = new Map((cands ?? []).map((c) => [c.id, c]));
  const result = { created: 0, merged: 0, rejected: 0, errors: [] as string[] };
  const touchedDocs = new Set<string>();
  const itemFor = new Map<string, string>(); // candidate id -> item it became / merged into

  for (const d of decisions) {
    const c = byId.get(d.id);
    if (!c) continue;
    touchedDocs.add(c.document_id);
    if (!d.include) {
      await db.from("extraction_candidates").update({ status: "rejected" }).eq("id", c.id);
      result.rejected++;
      continue;
    }
    if (c.duplicate_of && d.merge) {
      await db.from("item_sources").upsert({ item_id: c.duplicate_of, document_id: c.document_id, family_id: ctx.familyId, evidence: c.evidence });
      await db.from("extraction_candidates").update({ status: "approved" }).eq("id", c.id);
      itemFor.set(c.id, c.duplicate_of);
      result.merged++;
      continue;
    }

    let childId: string | null = null;
    let schoolId: string | null = null;
    if (d.who.startsWith("school:")) schoolId = ctx.schools.find((s) => s.id === d.who.slice(7))?.id ?? null;
    else if (d.who) {
      const child = ctx.children.find((k) => k.id === d.who);
      childId = child?.id ?? null;
      schoolId = child?.school_id ?? null;
    }
    const title = d.title.trim().slice(0, 200);
    if (!title) {
      result.errors.push("An item is missing a title.");
      continue;
    }
    if (d.kind === "event" && !d.date) {
      result.errors.push(`"${title}" needs a date (or uncheck it).`);
      continue;
    }
    const allDay = d.kind === "event" && !d.time;
    const startsAt = d.kind === "event" && d.date ? zonedToUtc(d.date, d.time, ctx.timezone) : null;
    let endsAt: string | null = null;
    if (d.kind === "event" && d.date && (d.endDate || d.endTime)) {
      const e = zonedToUtc(d.endDate || d.date, d.endTime, ctx.timezone);
      if (startsAt && e >= startsAt) endsAt = e;
    }
    const dueAt = d.kind === "task" && d.date ? zonedToUtc(d.date, d.time ?? "23:59", ctx.timezone) : null;

    const { data: item, error } = await db
      .from("items")
      .insert({
        family_id: ctx.familyId,
        kind: d.kind,
        category: c.category,
        title,
        details: d.details?.trim().slice(0, 4000) || null,
        child_id: childId,
        school_id: schoolId,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: allDay,
        due_at: dueAt,
        location: d.location?.trim().slice(0, 200) || null,
        amount_cents: c.amount_cents,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !item) {
      result.errors.push(`Couldn't save "${title}".`);
      continue;
    }
    await db.from("item_sources").insert({ item_id: item.id, document_id: c.document_id, family_id: ctx.familyId, evidence: c.evidence });
    await db.from("extraction_candidates").update({ status: "approved" }).eq("id", c.id);
    itemFor.set(c.id, item.id);
    result.created++;
  }

  // Same thing from other sources: link their documents to the one item.
  for (const [memberId, primaryId] of Object.entries(members)) {
    const m = byId.get(memberId);
    if (!m) continue;
    touchedDocs.add(m.document_id);
    const itemId = itemFor.get(primaryId);
    if (itemId) {
      await db.from("item_sources").upsert({ item_id: itemId, document_id: m.document_id, family_id: ctx.familyId, evidence: m.evidence });
      await db.from("extraction_candidates").update({ status: "approved" }).eq("id", m.id);
    } else if (decisions.find((d) => d.id === primaryId && !d.include)) {
      await db.from("extraction_candidates").update({ status: "rejected" }).eq("id", m.id);
    }
  }

  // Documents with nothing left to review are done.
  for (const docId of touchedDocs) {
    const { count } = await db.from("extraction_candidates").select("id", { count: "exact", head: true }).eq("document_id", docId).eq("status", "pending");
    if (!count) await db.from("source_documents").update({ status: "done" }).eq("id", docId).eq("status", "needs_review");
  }
  return result;
}
