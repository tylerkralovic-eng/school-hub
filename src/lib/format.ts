/** Date formatting helpers. All render in the viewer's local timezone. */
import { startOfDay } from "@/lib/selectors";

const DAY_MS = 86_400_000;

function dayDiff(target: Date, now: Date): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "Just now", "35m ago", "5h ago", "Yesterday", "Mon", "Nov 3" */
export function formatReceived(iso: string, now: Date): string {
  const d = new Date(iso);
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const diff = dayDiff(d, now);
  if (diff === 0) return `${Math.round(mins / 60)}h ago`;
  if (diff === -1) return "Yesterday";
  if (diff > -7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Overdue", "Due today, 8:00 AM", "Due tomorrow", "Due Fri", "Due Nov 20" */
export function formatDue(iso: string, now: Date): { label: string; urgent: boolean } {
  const d = new Date(iso);
  const diff = dayDiff(d, now);
  if (d < now) return { label: "Overdue", urgent: true };
  if (diff === 0) return { label: `Due today, ${formatTime(d)}`, urgent: true };
  if (diff === 1) return { label: "Due tomorrow", urgent: true };
  if (diff < 7)
    return { label: `Due ${d.toLocaleDateString("en-US", { weekday: "short" })}`, urgent: false };
  return {
    label: `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    urgent: false,
  };
}

/** "Today", "Tomorrow", "Friday" (this week) or "Friday, Nov 21" */
export function formatDayHeading(d: Date, now: Date): string {
  const diff = dayDiff(d, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function formatEventWhen(item: { eventAt: string | null; allDay?: boolean; eventEndAt?: string | null }, now: Date): string {
  if (!item.eventAt) return "";
  const start = new Date(item.eventAt);
  const day = formatDayHeading(start, now);
  if (item.allDay && item.eventEndAt) {
    const end = new Date(item.eventEndAt);
    const endLabel = end.toLocaleDateString("en-US", { weekday: "short" });
    return `${day} – ${endLabel}`;
  }
  if (item.allDay) return `${day} · All day`;
  return `${day} · ${formatTime(start)}`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** "3 hours ago", "4 days ago", "a while ago" (for sentences). */
export function formatAgo(iso: string | null, now: Date): string {
  if (!iso) return "a while ago";
  const hours = Math.floor((now.getTime() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
