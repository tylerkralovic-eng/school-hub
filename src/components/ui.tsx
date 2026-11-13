/** Presentational building blocks shared across screens. */
import type { Child, ChildColor, ItemKind, SourceStatus } from "@/lib/types";
import { Icon, type IconName } from "@/components/Icon";

export const childColors: Record<ChildColor, { chip: string; dot: string; avatar: string; ring: string }> = {
  violet: {
    chip: "bg-violet-100 text-violet-800",
    dot: "bg-violet-500",
    avatar: "bg-violet-500 text-white",
    ring: "ring-violet-500",
  },
  teal: {
    chip: "bg-teal-100 text-teal-800",
    dot: "bg-teal-500",
    avatar: "bg-teal-600 text-white",
    ring: "ring-teal-600",
  },
};

export function ChildAvatar({ child, size = "h-7 w-7 text-xs" }: { child: Child; size?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${size} ${childColors[child.color].avatar}`}
      aria-hidden="true"
    >
      {child.firstName[0]}
    </span>
  );
}

export function ChildChip({ child }: { child: Child }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${childColors[child.color].chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${childColors[child.color].dot}`} />
      {child.firstName}
    </span>
  );
}

const kindMeta: Record<ItemKind, { label: string; icon: IconName; style: string }> = {
  task: { label: "To do", icon: "task", style: "bg-rose-50 text-rose-700" },
  event: { label: "Event", icon: "calendar", style: "bg-sky-50 text-sky-700" },
  announcement: { label: "Notice", icon: "megaphone", style: "bg-amber-50 text-amber-700" },
};

export function KindIcon({ kind }: { kind: ItemKind }) {
  const m = kindMeta[kind];
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${m.style}`}>
      <Icon name={m.icon} className="h-[18px] w-[18px]" />
      <span className="sr-only">{m.label}</span>
    </span>
  );
}

export function kindLabel(kind: ItemKind): string {
  return kindMeta[kind].label;
}

export const statusMeta: Record<SourceStatus, { label: string; dot: string; text: string }> = {
  connected: { label: "Connected", dot: "bg-emerald-500", text: "text-emerald-700" },
  stale: { label: "Out of date", dot: "bg-amber-500", text: "text-amber-700" },
  not_connected: { label: "Not connected", dot: "bg-slate-300", text: "text-slate-500" },
};

export function StatusDot({ status }: { status: SourceStatus }) {
  return (
    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusMeta[status].dot}`} aria-hidden="true" />
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}
