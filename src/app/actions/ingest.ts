"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { features } from "@/lib/env";
import { ALLOWED_MIME, MAX_FILE_BYTES, applyReview, createDocument, processDocument, sha256, type Decision } from "@/lib/pipeline/process";
import { audit, requireFamily, type FamilyContext } from "@/lib/server/context";
import { isValidDate, isValidTime } from "@/lib/time";

function resolveWho(ctx: FamilyContext, who: string | null | undefined): { childId: string | null; schoolId: string | null } {
  if (!who) return { childId: null, schoolId: null };
  if (who.startsWith("school:")) {
    const s = ctx.schools.find((x) => x.id === who.slice(7));
    return { childId: null, schoolId: s?.id ?? null };
  }
  const c = ctx.children.find((x) => x.id === who);
  return { childId: c?.id ?? null, schoolId: c?.school_id ?? null };
}

const fileMeta = z.object({
  name: z.string().max(200),
  mime: z.enum(ALLOWED_MIME),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export interface RegisteredUpload {
  name: string;
  documentId: string;
  path: string | null; // null when this exact file was already added
  duplicate: boolean;
  batchId: string; // batch the document belongs to (an earlier one for repeats)
}

/** Step 1 of an upload: create document rows and return private storage paths. */
export async function registerUploads(files: z.infer<typeof fileMeta>[], who: string): Promise<{ batchId: string; uploads: RegisteredUpload[] } | { error: string }> {
  const ctx = await requireFamily();
  const parsed = z.array(fileMeta).min(1).max(10).safeParse(files);
  if (!parsed.success) return { error: "Choose up to 10 photos or PDFs (20 MB max each)." };
  const { childId, schoolId } = resolveWho(ctx, who);
  const batchId = randomUUID();
  const uploads: RegisteredUpload[] = [];
  for (const f of parsed.data) {
    const id = randomUUID();
    const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
    const path = `${ctx.family.id}/${id}/${safe}`;
    const doc = await createDocument(ctx.supabase, {
      id,
      familyId: ctx.family.id,
      batchId,
      channel: "upload",
      contentHash: f.sha256,
      title: f.name,
      mimeType: f.mime,
      storagePath: path,
      childHintId: childId,
      schoolHintId: schoolId,
      submittedBy: ctx.userId,
    });
    uploads.push({ name: f.name, documentId: doc.id, path: doc.duplicate ? null : path, duplicate: doc.duplicate, batchId: doc.batchId });
  }
  return { batchId, uploads };
}

/** Step 2: run AI extraction on every pending document of the batch (in parallel). */
export async function processBatch(batchId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireFamily();
  if (!features.ai()) return { ok: false, error: "AI extraction isn't configured yet. Your files are saved — try again once it's set up." };
  const { data: docs } = await ctx.supabase.from("source_documents").select("id, status").eq("family_id", ctx.family.id).eq("batch_id", batchId);
  const todo = (docs ?? []).filter((d) => d.status === "pending" || d.status === "failed");
  await Promise.all(todo.map((d) => processDocument(ctx.supabase, d.id)));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function submitText(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const text = String(form.get("text") ?? "").trim();
  if (text.length < 10) return { error: "Paste a little more of the message." };
  if (text.length > 50_000) return { error: "That's too long — paste up to 50,000 characters." };
  const { childId, schoolId } = resolveWho(ctx, String(form.get("who") ?? ""));
  const doc = await createDocument(ctx.supabase, {
    familyId: ctx.family.id,
    channel: "paste",
    contentHash: sha256(text),
    title: text.split("\n")[0].slice(0, 80),
    text,
    childHintId: childId,
    schoolHintId: schoolId,
    submittedBy: ctx.userId,
  });
  if (!doc.duplicate || doc.status === "failed" || doc.status === "pending") {
    if (!features.ai()) return { error: "AI extraction isn't configured yet." };
    await processDocument(ctx.supabase, doc.id);
  }
  revalidatePath("/", "layout");
  redirect(`/review/${doc.batchId}${doc.duplicate ? "?repeat=1" : ""}`);
}

export async function retryDocument(form: FormData) {
  const ctx = await requireFamily();
  const id = String(form.get("id"));
  const { data } = await ctx.supabase.from("source_documents").select("id, batch_id").eq("id", id).eq("family_id", ctx.family.id).single();
  if (data) await processDocument(ctx.supabase, data.id);
  revalidatePath("/", "layout");
}

/** Saves the parent's review decisions for a batch. */
export async function approveReview(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireFamily();
  const ids = form.getAll("candidate").map(String).slice(0, 300);
  const get = (id: string, f: string) => {
    const v = form.get(`${f}.${id}`);
    return typeof v === "string" ? v.trim() : "";
  };
  const decisions: Decision[] = [];
  for (const id of ids) {
    const kind = get(id, "kind");
    const date = get(id, "date") || null;
    const time = get(id, "time") || null;
    const endDate = get(id, "endDate") || null;
    const endTime = get(id, "endTime") || null;
    if (date && !isValidDate(date)) return { error: "One of the dates isn't valid." };
    if ((time && !isValidTime(time)) || (endTime && !isValidTime(endTime))) return { error: "One of the times isn't valid." };
    if (endDate && !isValidDate(endDate)) return { error: "One of the end dates isn't valid." };
    decisions.push({
      id,
      include: get(id, "include") === "on",
      merge: get(id, "merge") === "on",
      kind: kind === "task" || kind === "announcement" ? kind : "event",
      title: get(id, "title"),
      details: get(id, "details") || null,
      who: get(id, "who"),
      date,
      time,
      endDate,
      endTime,
      location: get(id, "location") || null,
    });
  }
  const result = await applyReview(ctx.supabase, { familyId: ctx.family.id, userId: ctx.userId, timezone: ctx.family.timezone, children: ctx.children, schools: ctx.schools }, decisions);
  await audit(ctx, "review.applied", undefined, { created: result.created, merged: result.merged, rejected: result.rejected });
  revalidatePath("/", "layout");
  if (result.errors.length) return { error: `${result.created + result.merged} saved. Fix the rest: ${result.errors.join(" ")}` };
  const batch = String(form.get("batch") ?? "");
  redirect(`/review/${batch}?saved=${result.created}&merged=${result.merged}&skipped=${result.rejected}`);
}

/** Deletes an original document (file + text) and its pending suggestions. Approved items stay. */
export async function deleteDocument(form: FormData) {
  const ctx = await requireFamily();
  const id = String(form.get("id"));
  const { data: doc } = await ctx.supabase.from("source_documents").select("id, storage_path").eq("id", id).eq("family_id", ctx.family.id).single();
  if (!doc) return;
  if (doc.storage_path) await ctx.supabase.storage.from("documents").remove([doc.storage_path]);
  await ctx.supabase.from("source_documents").delete().eq("id", doc.id);
  await audit(ctx, "document.deleted", doc.id);
  revalidatePath("/", "layout");
  const back = String(form.get("back") ?? "/add");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/add");
}
