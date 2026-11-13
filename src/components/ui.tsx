/** Presentational building blocks shared across screens (server-safe). */
import type { Child, ItemKind } from "@/lib/types";
import { Icon, type IconName } from "@/components/Icon";

const palette: Record<string, { chip: string; dot: string; avatar: string; ring: string }> = {
  violet: { chip: "bg-violet-100 text-violet-800", dot: "bg-violet-500", avatar: "bg-violet-500 text-white", ring: "ring-violet-500" },
  teal: { chip: "bg-teal-100 text-teal-800", dot: "bg-teal-500", avatar: "bg-teal-600 text-white", ring: "ring-teal-600" },
  amber: { chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500", avatar: "bg-amber-500 text-white", ring: "ring-amber-500" },
  rose: { chip: "bg-rose-100 text-rose-800", dot: "bg-rose-500", avatar: "bg-rose-500 text-white", ring: "ring-rose-500" },
  sky: { chip: "bg-sky-100 text-sky-800", dot: "bg-sky-500", avatar: "bg-sky-600 text-white", ring: "ring-sky-600" },
  emerald: { chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500", avatar: "bg-emerald-600 text-white", ring: "ring-emerald-600" },
};

export function colorOf(child: Pick<Child, "color">) {
  return palette[child.color] ?? palette.violet;
}

export function ChildAvatar({ child, size = "h-7 w-7 text-xs" }: { child: Pick<Child, "color" | "first_name">; size?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${size} ${colorOf(child).avatar}`}
      aria-hidden="true"
    >
      {child.first_name[0]?.toUpperCase()}
    </span>
  );
}

export function ChildChip({ child }: { child: Pick<Child, "color" | "first_name"> }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorOf(child).chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colorOf(child).dot}`} />
      {child.first_name}
    </span>
  );
}

export function FamilyChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      Whole family
    </span>
  );
}

const kindMeta: Record<ItemKind, { label: string; icon: IconName; style: string }> = {
  task: { label: "To do", icon: "task", style: "bg-rose-50 text-rose-700" },
  event: { label: "Event", icon: "calendar", style: "bg-sky-50 text-sky-700" },
  announcement: { label: "Notice", icon: "megaphone", style: "bg-amber-50 text-amber-700" },
};

export function kindLabel(kind: ItemKind) {
  return kindMeta[kind].label;
}

export function KindIcon({ kind, small = false }: { kind: ItemKind; small?: boolean }) {
  const m = kindMeta[kind];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl ${small ? "h-8 w-8" : "h-9 w-9"} ${m.style}`}>
      <Icon name={m.icon} className="h-[18px] w-[18px]" />
      <span className="sr-only">{m.label}</span>
    </span>
  );
}

export function SectionHeader({ title, action, id }: { title: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3 px-1">
      <h2 id={id} className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-1 pt-1">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
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

export function EmptyState({ icon = "sparkle", title, body, action }: { icon?: IconName; title: string; body: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-3 font-medium text-slate-800">{title}</p>
      <div className="mt-1 text-sm text-slate-500">{body}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "error" | "ok"; title?: string; children: React.ReactNode }) {
  const styles = {
    info: "border-indigo-200 bg-indigo-50 text-indigo-950",
    warn: "border-amber-300 bg-amber-50 text-amber-950",
    error: "border-rose-300 bg-rose-50 text-rose-950",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-950",
  }[tone];
  const icon: IconName = tone === "ok" ? "check" : tone === "info" ? "sparkle" : "alert";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-2xl border p-3.5 text-sm ${styles}`}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>
      </div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-[15px] font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50",
  ghost: "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50",
};

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
