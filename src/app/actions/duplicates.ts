"use server";

import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";
import { audit, requireFamily } from "@/lib/server/context";
import { findDuplicateItems, pickKeeper } from "@/lib/server/duplicates";

/** Merges a group of saved items into one: keeps the most complete, moves every source onto it. */
export async function mergeItems(form: FormData) {
  const ctx = await requireFamily();
  const ids = form.getAll("id").map(String);
  const groups = await findDuplicateItems(ctx);
  const group = groups.find((g) => ids.every((id) => g.some((i) => i.id === id)));
  if (!group || ids.length < 2) return;
  const members = group.filter((i) => ids.includes(i.id));
  const keep = pickKeeper(members);
  const others = members.filter((i) => i.id !== keep.id);
  // Fill gaps on the keeper from the others (details, location, child, end time, amount).
  const patch: Database["public"]["Tables"]["items"]["Update"] = {};
  for (const o of others) {
    if (!keep.details && o.details && !patch.details) patch.details = o.details;
    if (!keep.location && o.location && !patch.location) patch.location = o.location;
    if (!keep.child_id && o.child_id && !patch.child_id) patch.child_id = o.child_id;
    if (!keep.ends_at && o.ends_at && !patch.ends_at) patch.ends_at = o.ends_at;
    if (keep.amount_cents == null && o.amount_cents != null && patch.amount_cents == null) patch.amount_cents = o.amount_cents;
    if (!keep.assignee_id && o.assignee_id && !patch.assignee_id) patch.assignee_id = o.assignee_id;
    if (!keep.completed_at && o.completed_at && !patch.completed_at) { patch.completed_at = o.completed_at; patch.completed_by = o.completed_by; }
  }
  if (Object.keys(patch).length) await ctx.supabase.from("items").update(patch).eq("id", keep.id).eq("family_id", ctx.family.id);
  for (const o of others) {
    for (const s of o.item_sources) {
      if (s.document) await ctx.supabase.from("item_sources").upsert({ item_id: keep.id, document_id: s.document.id, family_id: ctx.family.id, evidence: s.evidence });
    }
    await ctx.supabase.from("items").delete().eq("id", o.id).eq("family_id", ctx.family.id);
  }
  await audit(ctx, "items.merged", keep.id, { merged: others.length });
  revalidatePath("/", "layout");
}

export async function keepSeparate(form: FormData) {
  const ctx = await requireFamily();
  const ids = form.getAll("id").map(String).slice(0, 20);
  const rows = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => ({ family_id: ctx.family.id, item_a: a, item_b: b })));
  if (rows.length) await ctx.supabase.from("not_duplicates").upsert(rows, { ignoreDuplicates: true });
  revalidatePath("/review/duplicates");
}

/** Merges every suggested group in one go. */
export async function mergeAll() {
  const ctx = await requireFamily();
  const groups = await findDuplicateItems(ctx);
  for (const g of groups) {
    const form = new FormData();
    g.forEach((i) => form.append("id", i.id));
    await mergeItems(form);
  }
  await audit(ctx, "items.merge_all", undefined, { groups: groups.length });
  revalidatePath("/", "layout");
}
