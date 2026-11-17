import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolResearch } from "@/lib/onboarding/types";
import { applyReview, createDocument, sha256 } from "@/lib/pipeline/process";
import { normalizeItems } from "@/lib/pipeline/normalize";
import type { ExtractedItem } from "@/lib/pipeline/schema";
import type { Database } from "@/lib/supabase/database.types";
import { todayIn, utcToZoned } from "@/lib/time";

/**
 * Saves dates read from a school's official calendar: the web page is recorded as
 * the source document, clear dates become calendar items, unclear ones go to review.
 */
export async function importSchoolEvents(
  db: SupabaseClient<Database>,
  ctx: { familyId: string; userId: string; timezone: string; schoolId: string; schoolName: string },
  events: SchoolResearch["events"],
  source: { website: string | null; calendar_url: string | null },
): Promise<{ added: number; toReview: number; batchId: string | null }> {
  if (!events.length) return { added: 0, toReview: 0, batchId: null };
  const tz = ctx.timezone;
  const [{ data: kids }, { data: schools }] = await Promise.all([
    db.from("children").select("id, first_name, school_id, aliases").eq("family_id", ctx.familyId),
    db.from("schools").select("id, name").eq("family_id", ctx.familyId),
  ]);
  const text = `Dates read from ${ctx.schoolName}'s official calendar${source.calendar_url ? ` (${source.calendar_url})` : ""}:\n` + events.map((e) => `${e.date}${e.end_date ? `–${e.end_date}` : ""}: ${e.title}`).join("\n");
  const doc = await createDocument(db, {
    familyId: ctx.familyId, channel: "web", originRef: `web:${source.calendar_url ?? source.website ?? ctx.schoolName}:${todayIn(tz)}`, contentHash: sha256(`${ctx.schoolId}:${text}`),
    title: `${ctx.schoolName} calendar (school website)`, sender: source.website ?? source.calendar_url, text, schoolHintId: ctx.schoolId, submittedBy: ctx.userId,
  });
  if (doc.duplicate) return { added: 0, toReview: 0, batchId: doc.batchId };
  const items: ExtractedItem[] = events.map((e) => ({
    kind: "event", category: e.category, title: e.title, details: null, date: e.date, start_time: null, end_date: e.end_date, end_time: null, location: null, amount_usd: null,
    applies_to: "school", child_id: null, school_id: ctx.schoolId, evidence: e.evidence || e.title, confidence: "high", uncertainty: null,
  }));
  const drafts = normalizeItems(items, { timezone: tz, children: kids ?? [], schools: schools ?? [] }, { schoolId: ctx.schoolId, receivedDate: todayIn(tz) });
  const { data: cands } = await db.from("extraction_candidates").insert(drafts.map((d, i) => ({ ...d, family_id: ctx.familyId, document_id: doc.id, position: i }))).select("id, needs_review, kind, title, details, location, starts_at, ends_at");
  await db.from("source_documents").update({ status: "needs_review", ai_summary: `${drafts.length} dates from the official school calendar`, is_school_related: true, processed_at: new Date().toISOString() }).eq("id", doc.id);
  const auto = (cands ?? []).filter((c) => !c.needs_review);
  const res = await applyReview(db, { familyId: ctx.familyId, userId: ctx.userId, timezone: tz, children: kids ?? [], schools: schools ?? [] },
    auto.map((c) => ({
      id: c.id, include: true, merge: false, kind: c.kind, title: c.title, details: c.details, who: `school:${ctx.schoolId}`,
      date: c.starts_at ? utcToZoned(c.starts_at, tz).date : null, time: null, endDate: c.ends_at ? utcToZoned(c.ends_at, tz).date : null, endTime: null, location: c.location,
    })));
  return { added: res.created, toReview: (cands?.length ?? 0) - auto.length, batchId: doc.batchId };
}
