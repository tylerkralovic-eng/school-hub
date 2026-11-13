/**
 * Pure functions over a FamilySnapshot. No React, no I/O, so they can be
 * reused server-side and by future agents/automations (e.g. reminders).
 */
import type { Child, FamilySnapshot, School, SchoolItem, Source } from "@/lib/types";

export type ChildFilter = "all" | string;

export function itemAppliesToChild(item: SchoolItem, child: Child): boolean {
  if (item.childId) return item.childId === child.id;
  // School-wide items apply to every child at that school.
  return item.schoolId === child.schoolId;
}

export function filterItemsByChild(
  snapshot: FamilySnapshot,
  filter: ChildFilter,
): SchoolItem[] {
  if (filter === "all") return snapshot.items;
  const child = snapshot.children.find((c) => c.id === filter);
  if (!child) return snapshot.items;
  return snapshot.items.filter((item) => itemAppliesToChild(item, child));
}

export function childrenForItem(snapshot: FamilySnapshot, item: SchoolItem): Child[] {
  return snapshot.children.filter((c) => itemAppliesToChild(item, c));
}

export function schoolById(snapshot: FamilySnapshot, id: string | null): School | undefined {
  return id ? snapshot.schools.find((s) => s.id === id) : undefined;
}

export function sourceById(snapshot: FamilySnapshot, id: string): Source | undefined {
  return snapshot.sources.find((s) => s.id === id);
}

/** Most recent time any source delivered this item. */
export function latestReceivedAt(item: SchoolItem): string {
  return item.sources.reduce(
    (latest, s) => (s.receivedAt > latest ? s.receivedAt : latest),
    item.sources[0]?.receivedAt ?? "",
  );
}

/** Newest first, by when the update reached the family. */
export function sortFeed(items: SchoolItem[]): SchoolItem[] {
  return [...items].sort((a, b) => latestReceivedAt(b).localeCompare(latestReceivedAt(a)));
}

/** Tasks ordered by due date (undated last). */
export function sortTasks(items: SchoolItem[]): SchoolItem[] {
  return items
    .filter((i) => i.kind === "task")
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
}

export interface AgendaEntry {
  key: string;
  at: Date;
  type: "event" | "deadline";
  item: SchoolItem;
}

/**
 * Calendar entries: events (and dated announcements) by event time, tasks by
 * due date. Entries from the start of today up to `days` ahead.
 */
export function buildAgenda(items: SchoolItem[], now: Date, days: number): AgendaEntry[] {
  const start = startOfDay(now);
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  const entries: AgendaEntry[] = [];
  for (const item of items) {
    if (item.eventAt) {
      entries.push({ key: `${item.id}:event`, at: new Date(item.eventAt), type: "event", item });
    }
    if (item.kind === "task" && item.dueAt) {
      entries.push({ key: `${item.id}:due`, at: new Date(item.dueAt), type: "deadline", item });
    }
  }
  return entries
    .filter((e) => e.at >= start && e.at < end)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export interface SourceHealthSummary {
  connected: number;
  stale: number;
  notConnected: number;
}

export function summarizeSources(sources: Source[]): SourceHealthSummary {
  return {
    connected: sources.filter((s) => s.status === "connected").length,
    stale: sources.filter((s) => s.status === "stale").length,
    notConnected: sources.filter((s) => s.status === "not_connected").length,
  };
}

/** Sources relevant to the current child filter (their school + family-level). */
export function sourcesForFilter(snapshot: FamilySnapshot, filter: ChildFilter): Source[] {
  if (filter === "all") return snapshot.sources;
  const child = snapshot.children.find((c) => c.id === filter);
  if (!child) return snapshot.sources;
  return snapshot.sources.filter((s) => s.schoolId === null || s.schoolId === child.schoolId);
}
