"use client";

import { useOptimistic, useTransition } from "react";
import { toggleTask } from "@/app/actions/items";
import { Icon } from "@/components/Icon";

export function TaskToggle({ id, title, done }: { id: string; title: string; done: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={optimistic ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleTask(id, !optimistic);
        })
      }
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90 ${
        optimistic ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-emerald-400 hover:text-emerald-300"
      }`}
    >
      <Icon name="check" className="h-4 w-4" strokeWidth={3} />
    </button>
  );
}
