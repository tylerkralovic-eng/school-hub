import Link from "next/link";
import { keepSeparate, mergeAll, mergeItems } from "@/app/actions/duplicates";
import { SubmitButton } from "@/components/forms";
import { WhoChips, sourceName } from "@/components/ItemCard";
import { Card, EmptyState, PageTitle, buttonClass } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { findDuplicateItems, pickKeeper } from "@/lib/server/duplicates";
import { fmt } from "@/lib/time";

export const metadata = { title: "Duplicates · School Hub" };

/** Saved items that look like the same thing from different sources — merge with one tap. */
export default async function DuplicatesPage() {
  const ctx = await requireFamily();
  const groups = await findDuplicateItems(ctx);
  const tz = ctx.family.timezone;
  const when = (i: { starts_at: string | null; due_at: string | null; all_day: boolean }) => {
    const t = i.starts_at ?? i.due_at;
    return t ? fmt(t, tz, { weekday: "short", month: "short", day: "numeric", ...(i.all_day || !i.starts_at ? {} : { hour: "numeric", minute: "2-digit" }) }) : "No date";
  };

  return (
    <div className="space-y-5 pb-6">
      <PageTitle title="Possible duplicates" subtitle="The same thing found in more than one place. Merging keeps one item with all its sources." />
      {groups.length === 0 ? (
        <EmptyState icon="check" title="No duplicates found" body="Everything on your calendar and lists is unique." action={<Link href="/" className={buttonClass.secondary}>Back to Home</Link>} />
      ) : (
        <>
          <form action={mergeAll}>
            <SubmitButton className="w-full" pendingText="Merging…">Merge all {groups.length}</SubmitButton>
          </form>
          {groups.map((g) => {
            const keep = pickKeeper(g);
            return (
              <Card key={g.map((i) => i.id).join()} className="space-y-3 p-4">
                <ul className="space-y-2">
                  {g.map((i) => (
                    <li key={i.id} className={`rounded-xl p-2.5 ${i.id === keep.id ? "bg-indigo-50" : "bg-slate-50"}`}>
                      <p className="text-[15px] font-semibold">{i.title} {i.id === keep.id && <span className="text-xs font-medium text-indigo-700">· will keep</span>}</p>
                      <p className="text-xs text-slate-600">{when(i)} · {i.item_sources.map(sourceName).join(", ") || "Added by hand"}</p>
                      <div className="mt-1 flex flex-wrap gap-1"><WhoChips item={i} ctx={ctx} /></div>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <form action={keepSeparate} className="flex-1">
                    {g.map((i) => <input key={i.id} type="hidden" name="id" value={i.id} />)}
                    <SubmitButton variant="secondary" className="w-full" pendingText="…">Keep separate</SubmitButton>
                  </form>
                  <form action={mergeItems} className="flex-1">
                    {g.map((i) => <input key={i.id} type="hidden" name="id" value={i.id} />)}
                    <SubmitButton className="w-full" pendingText="Merging…">Merge</SubmitButton>
                  </form>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
