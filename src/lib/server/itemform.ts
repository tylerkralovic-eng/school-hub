import "server-only";
import type { ItemFormValues } from "@/components/ItemForm";
import type { FamilyContext } from "@/lib/server/context";
import type { Item } from "@/lib/types";
import { utcToZoned } from "@/lib/time";

export function whoOptions(ctx: FamilyContext) {
  return [
    ...ctx.children.map((c) => ({ value: c.id, label: c.first_name })),
    ...ctx.schools.map((s) => ({ value: `school:${s.id}`, label: `Everyone at ${s.short_name || s.name}` })),
  ];
}

export function toFormValues(item: Item, tz: string): ItemFormValues {
  const start = item.starts_at ?? item.due_at;
  const s = start ? utcToZoned(start, tz) : null;
  const e = item.ends_at ? utcToZoned(item.ends_at, tz) : null;
  const timed = s && !(item.kind === "event" && item.all_day) && !(item.kind === "task" && s.time === "23:59");
  return {
    id: item.id,
    kind: item.kind,
    category: item.category,
    title: item.title,
    details: item.details ?? "",
    who: item.child_id ?? (item.school_id ? `school:${item.school_id}` : ""),
    date: s?.date ?? "",
    time: timed ? s!.time : "",
    endDate: e && e.date !== s?.date ? e.date : "",
    endTime: e && !item.all_day ? e.time : "",
    location: item.location ?? "",
    assigneeId: item.assignee_id ?? "",
  };
}
