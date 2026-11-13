"use client";

import { useFamily } from "@/components/FamilyProvider";
import { ChildAvatar, childColors } from "@/components/ui";
import { schoolById } from "@/lib/selectors";

export function ChildFilterBar() {
  const { snapshot, filter, setFilter } = useFamily();

  return (
    <div
      role="radiogroup"
      aria-label="Filter by child"
      className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3"
    >
      <button
        type="button"
        role="radio"
        aria-checked={filter === "all"}
        onClick={() => setFilter("all")}
        className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
          filter === "all"
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
        }`}
      >
        <span className="flex -space-x-1.5">
          {snapshot.children.map((c) => (
            <ChildAvatar key={c.id} child={c} size="h-5 w-5 text-[10px] ring-2 ring-white" />
          ))}
        </span>
        Everyone
      </button>
      {snapshot.children.map((child) => {
        const active = filter === child.id;
        const school = schoolById(snapshot, child.schoolId);
        return (
          <button
            key={child.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setFilter(child.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors ${
              active
                ? `border-transparent bg-white ring-2 ${childColors[child.color].ring}`
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <ChildAvatar child={child} size="h-6 w-6 text-[11px]" />
            <span className="font-medium text-slate-900">{child.firstName}</span>
            <span className="hidden text-xs text-slate-500 sm:inline">{school?.shortName}</span>
          </button>
        );
      })}
    </div>
  );
}
