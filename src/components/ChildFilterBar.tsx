"use client";

import { useOptimistic, useTransition } from "react";
import { setChildFilter } from "@/app/actions/prefs";
import { ChildAvatar, colorOf } from "@/components/ui";
import type { Child } from "@/lib/types";

export function ChildFilterBar({ kids, selected, schoolNames }: { kids: Child[]; selected: string | null; schoolNames: Record<string, string> }) {
  const [optimistic, setOptimistic] = useOptimistic(selected ?? "all");
  const [, start] = useTransition();
  if (kids.length < 2) return null;

  const choose = (id: string) =>
    start(async () => {
      setOptimistic(id);
      await setChildFilter(id);
    });

  return (
    <div role="radiogroup" aria-label="Filter by child" className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
      <button type="button" role="radio" aria-checked={optimistic === "all"} onClick={() => choose("all")}
        className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${optimistic === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
        <span className="flex -space-x-1.5">
          {kids.slice(0, 3).map((c) => <ChildAvatar key={c.id} child={c} size="h-5 w-5 text-[10px] ring-2 ring-white" />)}
        </span>
        Everyone
      </button>
      {kids.map((child) => {
        const active = optimistic === child.id;
        return (
          <button key={child.id} type="button" role="radio" aria-checked={active} onClick={() => choose(child.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors ${active ? `border-transparent bg-white ring-2 ${colorOf(child).ring}` : "border-slate-200 bg-white"}`}>
            <ChildAvatar child={child} size="h-6 w-6 text-[11px]" />
            <span className="font-medium text-slate-900">{child.first_name}</span>
            {child.school_id && schoolNames[child.school_id] && <span className="hidden text-xs text-slate-500 sm:inline">{schoolNames[child.school_id]}</span>}
          </button>
        );
      })}
    </div>
  );
}
