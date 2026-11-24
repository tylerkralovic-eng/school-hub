import "server-only";
import type { ReviewCandidate } from "@/components/ReviewForm";
import { buildGroups } from "@/lib/review-model";
import type { FamilyContext } from "@/lib/server/context";
import { utcToZoned } from "@/lib/time";
import { CATEGORY_LABELS, CHANNEL_LABELS, type Channel, type ItemCategory } from "@/lib/types";

/** Loads pending review items (optionally for some documents), grouped and triaged. */
export async function loadReview(ctx: FamilyContext, documentIds?: string[]): Promise<ReviewCandidate[]> {
  const tz = ctx.family.timezone;
  let q = ctx.supabase
    .from("extraction_candidates")
    .select("*, source_documents(channel, title, sender)")
    .eq("family_id", ctx.family.id)
    .eq("status", "pending")
    .order("created_at")
    .limit(600);
  if (documentIds) q = q.in("document_id", documentIds.length ? documentIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: cands } = await q;
  const list = cands ?? [];
  const dupIds = [...new Set(list.map((c) => c.duplicate_of).filter(Boolean) as string[])];
  const { data: dups } = dupIds.length ? await ctx.supabase.from("items").select("id, title").in("id", dupIds) : { data: [] };
  const sourceLabel = (c: (typeof list)[number]) => {
    const d = c.source_documents as { channel: Channel; title: string | null; sender: string | null } | null;
    return d ? `${CHANNEL_LABELS[d.channel]}${d.title ? `: ${d.title.slice(0, 40)}` : ""}` : "Source";
  };

  return buildGroups(list, tz).map((g) => {
    const c = g.primary;
    const start = c.starts_at ?? c.due_at;
    const local = start ? utcToZoned(start, tz) : null;
    const end = c.ends_at ? utcToZoned(c.ends_at, tz) : null;
    const timed = local && !(c.kind === "event" && c.all_day) && !(c.kind === "task" && local.time === "23:59");
    return {
      id: c.id,
      kind: c.kind,
      category: c.category,
      categoryLabel: CATEGORY_LABELS[c.category as ItemCategory],
      title: c.title,
      details: c.details,
      who: c.child_id ?? (c.school_id ? `school:${c.school_id}` : ""),
      date: local?.date ?? null,
      time: timed ? local!.time : null,
      endDate: end && end.date !== local?.date ? end.date : null,
      endTime: end && !c.all_day ? end.time : null,
      location: c.location,
      amount: c.amount_cents != null ? (c.amount_cents / 100).toFixed(2) : null,
      evidence: c.evidence,
      needsReview: c.needs_review,
      reviewReason: c.review_reason,
      duplicateTitle: dups?.find((d) => d.id === c.duplicate_of)?.title ?? null,
      section: g.section,
      flag: g.flag,
      sourceLabel: sourceLabel(c),
      members: g.members.map((m) => ({ id: m.id, label: sourceLabel(m) })),
    };
  });
}
