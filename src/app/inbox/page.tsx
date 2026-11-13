"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFamily } from "@/components/FamilyProvider";
import { ItemCard } from "@/components/ItemCard";
import { EmptyState } from "@/components/ui";
import { filterItemsByChild, latestReceivedAt, sortFeed, startOfDay } from "@/lib/selectors";
import type { ItemKind, SchoolItem } from "@/lib/types";

type KindFilter = "all" | ItemKind;

const kindTabs: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "task", label: "To do" },
  { value: "event", label: "Events" },
  { value: "announcement", label: "Notices" },
];

function parseKind(v: string | null): KindFilter {
  return kindTabs.some((t) => t.value === v) ? (v as KindFilter) : "all";
}

function groupByReceived(items: SchoolItem[], now: Date) {
  const today = startOfDay(now).getTime();
  const DAY = 86_400_000;
  const buckets: { label: string; items: SchoolItem[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier this week", items: [] },
    { label: "Older", items: [] },
  ];
  for (const item of items) {
    const t = new Date(latestReceivedAt(item)).getTime();
    if (t >= today) buckets[0].items.push(item);
    else if (t >= today - DAY) buckets[1].items.push(item);
    else if (t >= today - 6 * DAY) buckets[2].items.push(item);
    else buckets[3].items.push(item);
  }
  return buckets.filter((b) => b.items.length > 0);
}

function InboxContent() {
  const { snapshot, filter, now } = useFamily();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = parseKind(params.get("kind"));

  const childItems = filterItemsByChild(snapshot, filter);
  const items = sortFeed(kind === "all" ? childItems : childItems.filter((i) => i.kind === kind));
  const groups = groupByReceived(items, now);

  const setKind = (k: KindFilter) => {
    router.replace(k === "all" ? pathname : `${pathname}?kind=${k}`, { scroll: false });
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-baseline justify-between px-1 pt-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <span className="text-sm text-slate-500">
          {items.length} {items.length === 1 ? "update" : "updates"}
        </span>
      </div>

      <div role="tablist" aria-label="Filter by type" className="grid grid-cols-4 gap-1 rounded-xl bg-slate-200/70 p-1">
        {kindTabs.map((t) => {
          const count = t.value === "all" ? childItems.length : childItems.filter((i) => i.kind === t.value).length;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={kind === t.value}
              onClick={() => setKind(t.value)}
              className={`rounded-lg py-1.5 text-sm font-medium transition-colors ${
                kind === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              {t.label}
              <span className="ml-1 text-xs text-slate-400">{count}</span>
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <EmptyState title="Nothing here" body="No updates of this type from connected sources." />
      ) : (
        groups.map((g) => (
          <section key={g.label} className="space-y-3">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</h2>
            {g.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense>
      <InboxContent />
    </Suspense>
  );
}
