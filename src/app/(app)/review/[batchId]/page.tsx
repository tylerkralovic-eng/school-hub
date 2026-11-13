import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDocument, retryDocument } from "@/app/actions/ingest";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icon";
import { ReviewForm, type ReviewCandidate } from "@/components/ReviewForm";
import { Card, Notice, PageTitle, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { requireFamily } from "@/lib/server/context";
import { fmt, utcToZoned } from "@/lib/time";
import { CATEGORY_LABELS, CHANNEL_LABELS, type ItemCategory } from "@/lib/types";

export const metadata = { title: "Review · School Hub" };
export const maxDuration = 300;

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: Promise<{ saved?: string; merged?: string; skipped?: string; repeat?: string }> }) {
  const { batchId } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(batchId)) notFound();
  const ctx = await requireFamily();
  const tz = ctx.family.timezone;

  const { data: docs } = await ctx.supabase.from("source_documents").select("*").eq("family_id", ctx.family.id).eq("batch_id", batchId).order("created_at");
  if (!docs?.length) notFound();
  const { data: cands } = await ctx.supabase
    .from("extraction_candidates")
    .select("*")
    .in("document_id", docs.map((d) => d.id))
    .eq("status", "pending")
    .order("document_id")
    .order("position");
  const dupIds = [...new Set((cands ?? []).map((c) => c.duplicate_of).filter(Boolean) as string[])];
  const { data: dups } = dupIds.length ? await ctx.supabase.from("items").select("id, title").in("id", dupIds) : { data: [] };

  const busy = docs.some((d) => d.status === "processing" || d.status === "pending");
  const whoOptions = [
    ...ctx.children.map((c) => ({ value: c.id, label: c.first_name })),
    ...ctx.schools.map((s) => ({ value: `school:${s.id}`, label: `Everyone at ${s.short_name || s.name}` })),
  ];

  const candidates: ReviewCandidate[] = (cands ?? []).map((c) => {
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
    };
  });

  const saved = sp.saved !== undefined;

  return (
    <div className="space-y-5 pb-4">
      {busy && <AutoRefresh seconds={3} />}
      <PageTitle title={saved ? "Saved" : "Review"} subtitle={saved ? undefined : "Check what School Hub found. Nothing is added until you save."} />

      {saved && (
        <Notice tone="ok" title={`${sp.saved} added${Number(sp.merged) ? `, ${sp.merged} linked to existing items` : ""}`}>
          {Number(sp.skipped) ? `${sp.skipped} skipped. ` : ""}
          <span className="mt-2 flex gap-3">
            <Link href="/calendar" className="font-semibold underline">Open calendar</Link>
            <Link href="/tasks" className="font-semibold underline">Tasks</Link>
            <Link href="/add" className="font-semibold underline">Add more</Link>
          </span>
        </Notice>
      )}
      {sp.repeat && <Notice tone="info">You&apos;ve added this exact file or message before, so it wasn&apos;t processed again.</Notice>}

      <div className="space-y-2">
        {docs.map((d) => (
          <Card key={d.id} className="p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Icon name={d.mime_type?.startsWith("image/") ? "image" : d.mime_type === "application/pdf" ? "file" : "text"} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{d.title || CHANNEL_LABELS[d.channel]}</p>
                <p className="text-xs text-slate-500">
                  {CHANNEL_LABELS[d.channel]}{d.sender ? ` · ${d.sender}` : ""} · {fmt(d.received_at, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
                {d.status === "processing" || d.status === "pending" ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-indigo-700"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />Reading…</p>
                ) : d.status === "failed" ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-rose-700">{d.error}</p>
                    <form action={retryDocument}><input type="hidden" name="id" value={d.id} /><SubmitButton variant="secondary" pendingText="Retrying…" className="!py-1.5 text-sm">Retry</SubmitButton></form>
                  </div>
                ) : (
                  d.ai_summary && <p className="mt-1.5 text-sm text-slate-600">{d.ai_summary}</p>
                )}
                {d.status === "ignored" && <p className="mt-1 text-xs text-slate-500">Doesn&apos;t look school-related — nothing to add.</p>}
              </div>
            </div>
            <div className="mt-2 flex gap-4 pl-[52px] text-sm">
              <Link href={`/documents/${d.id}`} className="font-medium text-indigo-600">View original</Link>
              <form action={deleteDocument}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="back" value="/add" />
                <button className="font-medium text-slate-500">Delete</button>
              </form>
            </div>
          </Card>
        ))}
      </div>

      {candidates.length > 0 ? (
        <ReviewForm batchId={batchId} candidates={candidates} whoOptions={whoOptions} />
      ) : (
        !busy && !saved && docs.every((d) => d.status !== "failed") && (
          <Notice tone="info" title="Nothing to review">
            No dates or to-dos were found{docs.some((d) => d.status === "done") ? " (or they've already been reviewed)" : ""}.{" "}
            <Link href="/add" className="font-semibold underline">Add something else</Link>
          </Notice>
        )
      )}
      {saved && candidates.length === 0 && <Link href="/" className={`${buttonClass.secondary} w-full`}>Back to home</Link>}
    </div>
  );
}
