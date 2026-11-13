"use client";

import { useTransition } from "react";
import { assignTask } from "@/app/actions/items";

export function AssignSelect({ id, value, members, title }: { id: string; value: string | null; members: { id: string; name: string }[]; title: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Who's handling "${title}"`}
      defaultValue={value ?? ""}
      disabled={pending}
      onChange={(e) => start(() => assignTask(id, e.target.value || null))}
      className="max-w-[8.5rem] truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
    >
      <option value="">Unassigned</option>
      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}
