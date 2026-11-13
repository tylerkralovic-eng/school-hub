import Link from "next/link";
import { ItemCard } from "@/components/ItemCard";
import { EmptyState, PageTitle, buttonClass } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { getChildFilter } from "@/lib/server/filters";
import { ITEM_SELECT, childOrFilter, receivedAt, type ItemView } from "@/lib/server/items";
import { addDays, todayIn, utcToZoned } from "@/lib/time";
import { CATEGORY_LABELS, type ItemCategory } from "@/lib/types";

export const metadata = { title: "Inbox · School Hub" };

const TYPES = [
  { v: "", l: "All" },
  { v: "task", l: "To do" },
  { v: "event", l: "Events" },
  { v: "announcement", l: "Notices" },
] as const;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ type?: string; school?: string; category?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFamily();
  const tz = ctx.family.timezone;
  const childId = await getChildFilter(ctx);
  const type = TYPES.some((t) => t.v === sp.type) ? sp.type ?? "" : "";
  const school = ctx.schools.find((s) => s.id === sp.school);
  const category = sp.category && sp.category in CATEGORY_LABELS ? (sp.category as ItemCategory) : null;

  let q = ctx.supabase.from("items").select(ITEM_SELECT).eq("family_id", ctx.family.id).order("created_at", { ascending: false }).limit(150);
  if (childId) q = q.or(childOrFilter(ctx, childId));
  if (type) q = q.eq("kind", type as "task");
  if (school) q = q.or(`school_id.eq.${school.id},child_id.in.(${ctx.children.filter((c) => c.school_id === school.id).map((c) => c.id).join(",") || "00000000-0000-0000-0000-000000000000"})`);
  if (category) q = q.eq("category", category);
  const { data } = await q;
  const items = ((data ?? []) as ItemView[]).sort((a, b) => receivedAt(b).localeCompare(receivedAt(a)));

  const today = todayIn(tz);
  const groups: { label: string; items: ItemView[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const it of items) {
    const d = utcToZoned(receivedAt(it), tz).date;
    if (d >= today) groups[0].items.push(it);
    else if (d === addDays(today, -1)) groups[1].items.push(it);
    else if (d >= addDays(today, -7)) groups[2].items.push(it);
    else groups[3].items.push(it);
  }

  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { type, school: school?.id, category: category ?? undefined, ...p };
    Object.entries(merged).forEach(([k, v]) => v && u.set(k, v));
    const s = u.toString();
    return `/inbox${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5 pb-4">
      <PageTitle title="Inbox" subtitle={`${items.length} ${items.length === 1 ? "update" : "updates"}, newest first`} />
      <nav aria-label="Filter by type" className="grid grid-cols-4 gap-1 rounded-xl bg-slate-200/70 p-1">
        {TYPES.map((t) => (
          <Link key={t.v} href={href({ type: t.v || undefined })} aria-current={type === t.v ? "page" : undefined} className={`rounded-lg py-1.5 text-center text-sm font-medium ${type === t.v ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{t.l}</Link>
        ))}
      </nav>
      {(ctx.schools.length > 1 || category) && (
        <nav aria-label="Filter by school" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Link href={href({ school: undefined, category: undefined })} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${!school && !category ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>All schools</Link>
          {ctx.schools.map((s) => (
            <Link key={s.id} href={href({ school: s.id })} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${school?.id === s.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{s.short_name || s.name}</Link>
          ))}
          {(["payment", "permission_form", "closure"] as const).map((c) => (
            <Link key={c} href={href({ category: category === c ? undefined : c })} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${category === c ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{CATEGORY_LABELS[c]}</Link>
          ))}
        </nav>
      )}
      {items.length === 0 ? (
        <EmptyState icon="inbox" title="Nothing here yet" body="Updates you add or that arrive from Gmail and texts show up here, each with its source." action={<Link href="/add" className={buttonClass.primary}>Add school info</Link>} />
      ) : (
        groups.filter((g) => g.items.length).map((g) => (
          <section key={g.label} className="space-y-3">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</h2>
            {g.items.map((it) => <ItemCard key={it.id} item={it} ctx={ctx} back="/inbox" />)}
          </section>
        ))
      )}
    </div>
  );
}
