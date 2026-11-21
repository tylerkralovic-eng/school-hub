import Link from "next/link";
import { BottomNav, TopNav } from "@/components/AppNav";
import { ChildFilterBar } from "@/components/ChildFilterBar";
import { Icon } from "@/components/Icon";
import { features } from "@/lib/env";
import { requireFamily } from "@/lib/server/context";
import { getChildFilter } from "@/lib/server/filters";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireFamily();
  const selected = await getChildFilter(ctx);
  const { count } = await ctx.supabase
    .from("extraction_candidates")
    .select("id", { count: "exact", head: true })
    .eq("family_id", ctx.family.id)
    .eq("status", "pending");
  const schoolNames = Object.fromEntries(ctx.schools.map((s) => [s.id, s.short_name || s.name]));

  return (
    <>
      {features.aiIsStub() && (
        <div role="note" className="sticky top-0 z-40 truncate bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
          TEST MODE · AI extraction is a stub — not reading your documents
        </div>
      )}
      <div className="mx-auto max-w-2xl pb-28 md:pb-12">
        <header className="flex items-center justify-between gap-3 px-4 pt-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm">SH</span>
            <span className="truncate text-lg font-semibold tracking-tight">{ctx.family.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <TopNav reviewCount={count ?? 0} />
            <Link href="/points" aria-label="Points" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200/60">
              <Icon name="star" className="h-5 w-5" />
            </Link>
            <Link href="/connections" aria-label="Connections" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200/60">
              <Icon name="plug" className="h-5 w-5" />
            </Link>
            <Link href="/settings" aria-label="Settings" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200/60">
              <Icon name="gear" className="h-5 w-5" />
            </Link>
          </div>
        </header>
        <ChildFilterBar kids={ctx.children} selected={selected} schoolNames={schoolNames} />
        <main className={`px-4 ${ctx.children.length < 2 ? "pt-4" : ""}`}>{children}</main>
      </div>
      <BottomNav reviewCount={count ?? 0} />
    </>
  );
}
