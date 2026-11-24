import Link from "next/link";
import { ReviewForm } from "@/components/ReviewForm";
import { EmptyState, Notice, PageTitle, buttonClass } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { whoOptions } from "@/lib/server/itemform";
import { loadReview } from "@/lib/server/review";

export const metadata = { title: "Review · School Hub" };
export const maxDuration = 300;

/** Everything waiting for review, from every source — grouped, de-duplicated and triaged. */
export default async function ReviewAllPage({ searchParams }: { searchParams: Promise<{ saved?: string; merged?: string; skipped?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFamily();
  const candidates = await loadReview(ctx);
  const saved = sp.saved !== undefined;

  return (
    <div className="space-y-5 pb-4">
      <PageTitle title="Review" subtitle="Everything new from email, photos and messages — sorted by what needs you first." />
      {saved && (
        <Notice tone="ok" title={`${sp.saved} added${Number(sp.merged) ? `, ${sp.merged} linked to existing items` : ""}`}>
          {Number(sp.skipped) ? `${sp.skipped} skipped. ` : ""}
          <Link href="/" className="font-semibold underline">Back to Home</Link>
        </Notice>
      )}
      {candidates.length ? (
        <ReviewForm batchId="" candidates={candidates} whoOptions={whoOptions(ctx)} />
      ) : (
        !saved && <EmptyState icon="check" title="All caught up" body="Nothing waiting for review." action={<Link href="/review/duplicates" className={buttonClass.secondary}>Check for duplicates</Link>} />
      )}
    </div>
  );
}
