import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TaskToggle } from "@/components/TaskToggle";
import { ChildChip, FamilyChip, KindIcon } from "@/components/ui";
import { platformName } from "@/lib/platforms";
import type { FamilyContext } from "@/lib/server/context";
import { inboxLink, receivedAt, type ItemSourceView, type ItemView } from "@/lib/server/items";
import { dueLabel, fmt, fmtTime, receivedLabel, relativeDay } from "@/lib/time";
import { CATEGORY_LABELS, CHANNEL_LABELS } from "@/lib/types";

export type CardCtx = Pick<FamilyContext, "family" | "children" | "schools" | "members">;

export function sourceName(s: ItemSourceView): string {
  const d = s.document;
  if (!d) return "Original deleted";
  const via = CHANNEL_LABELS[d.channel];
  if (d.platform_key) return `${platformName(d.platform_key)} · via ${via}`;
  if (d.sender) return `${d.sender} · ${via}`;
  return d.title ? `${d.title} · ${via}` : via;
}

export function WhenLine({ item, ctx }: { item: ItemView; ctx: CardCtx }) {
  const tz = ctx.family.timezone;
  const parts: React.ReactNode[] = [];
  if (item.kind === "task" && item.due_at) {
    const due = dueLabel(item.due_at, tz);
    const tone = item.completed_at ? "text-slate-500" : due.tone === "overdue" ? "text-rose-600" : due.tone === "soon" ? "text-rose-600" : "text-slate-600";
    parts.push(
      <span key="due" className={`inline-flex items-center gap-1 font-medium ${tone}`}>
        <Icon name="clock" className="h-3.5 w-3.5" />
        {item.completed_at ? "Done" : due.label}
      </span>,
    );
  }
  if (item.starts_at) {
    let when = relativeDay(item.starts_at, tz);
    if (item.ends_at && item.all_day) {
      const endDay = fmt(item.ends_at, tz, { month: "short", day: "numeric" });
      if (endDay !== fmt(item.starts_at, tz, { month: "short", day: "numeric" })) when += ` – ${fmt(item.ends_at, tz, { weekday: "short", month: "short", day: "numeric" })}`;
    } else if (!item.all_day) {
      when += ` · ${fmtTime(item.starts_at, tz)}`;
      if (item.ends_at) when += `–${fmtTime(item.ends_at, tz)}`;
    } else when += " · All day";
    parts.push(
      <span key="when" className="inline-flex items-center gap-1 font-medium text-slate-600">
        <Icon name="calendar" className="h-3.5 w-3.5" />
        {when}
      </span>,
    );
  }
  if (item.location)
    parts.push(
      <span key="loc" className="inline-flex items-center gap-1 text-slate-500">
        <Icon name="pin" className="h-3.5 w-3.5" />
        {item.location}
      </span>,
    );
  if (item.amount_cents != null)
    parts.push(
      <span key="amt" className="font-medium text-slate-600">
        ${(item.amount_cents / 100).toFixed(2)}
      </span>,
    );
  if (!parts.length) return null;
  return <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">{parts}</div>;
}

export function WhoChips({ item, ctx }: { item: Pick<ItemView, "child_id" | "school_id">; ctx: CardCtx }) {
  const child = ctx.children.find((c) => c.id === item.child_id);
  const school = ctx.schools.find((s) => s.id === item.school_id);
  if (child) return <ChildChip child={child} />;
  if (school) {
    const kids = ctx.children.filter((c) => c.school_id === school.id);
    return (
      <>
        {kids.map((k) => <ChildChip key={k.id} child={k} />)}
        <span className="text-xs text-slate-500">{school.short_name || school.name} · school-wide</span>
      </>
    );
  }
  return <FamilyChip />;
}

export function ItemCard({ item, ctx, compact = false, back }: { item: ItemView; ctx: CardCtx; compact?: boolean; back?: string }) {
  const tz = ctx.family.timezone;
  const done = item.kind === "task" && Boolean(item.completed_at);
  const assignee = ctx.members.find((m) => m.user_id === item.assignee_id);
  const sources = item.item_sources;
  const first = sources[0];

  return (
    <article className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${done ? "opacity-60" : ""}`}>
      <div className="flex gap-3">
        <KindIcon kind={item.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <h3 className={`flex-1 text-[15px] font-semibold leading-snug text-slate-900 ${done ? "line-through decoration-slate-400" : ""}`}>
              <Link href={`/items/${item.id}${back ? `?back=${encodeURIComponent(back)}` : ""}`} className="hover:underline">{item.title}</Link>
            </h3>
            {item.kind === "task" && <TaskToggle id={item.id} title={item.title} done={done} />}
          </div>
          {!compact && item.details && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{item.details}</p>}
          <WhenLine item={item} ctx={ctx} />
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <WhoChips item={item} ctx={ctx} />
            {item.category !== "general" && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{CATEGORY_LABELS[item.category]}</span>
            )}
            {assignee && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                <Icon name="user" className="h-3 w-3" /> {assignee.display_name}
              </span>
            )}
          </div>

          <details className="group mt-3 border-t border-slate-100 pt-2.5">
            <summary className="-mx-1 flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-0.5 text-xs text-slate-500 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-slate-600">{first ? sourceName(first) : "Added by hand"}</span>
                {" · "}
                {receivedLabel(receivedAt(item), tz)}
                {sources.length > 1 && ` · ${sources.length} sources`}
              </span>
              <span className="shrink-0 font-medium text-indigo-600">Source</span>
              <Icon name="chevronDown" className="h-3.5 w-3.5 shrink-0 text-indigo-600 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 space-y-2">
              {sources.length === 0 && <p className="text-xs text-slate-500">Created by a parent in School Hub on {fmt(item.created_at, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.</p>}
              {sources.length > 1 && <p className="text-xs text-slate-500">Merged from {sources.length} sources describing the same thing.</p>}
              {sources.map((s, i) => (
                <figure key={i} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  {s.evidence && <blockquote className="text-[13px] italic leading-relaxed text-slate-700">“{s.evidence}”</blockquote>}
                  <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                    <span className="font-medium">{sourceName(s)}</span>
                    {s.document && <span>· Received {fmt(s.document.received_at, tz, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                    {s.document && inboxLink(s.document) ? (
                      <>
                        <a href={inboxLink(s.document)!} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600">Open in Gmail</a>
                        <Link href={`/documents/${s.document.id}`} className="text-slate-500 underline">copy in School Hub</Link>
                      </>
                    ) : (
                      s.document && <Link href={`/documents/${s.document.id}`} className="font-medium text-indigo-600">View original</Link>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}
