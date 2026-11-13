import Link from "next/link";
import { AssignSelect } from "@/components/AssignSelect";
import { WhoChips } from "@/components/ItemCard";
import { QuickAddTask } from "@/components/QuickAddTask";
import { TaskToggle } from "@/components/TaskToggle";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { getChildFilter } from "@/lib/server/filters";
import { ITEM_SELECT, childOrFilter, type ItemView } from "@/lib/server/items";
import { whoOptions } from "@/lib/server/itemform";
import { addDays, dueLabel, fmt, todayIn, zonedToUtc } from "@/lib/time";
import { CATEGORY_LABELS } from "@/lib/types";

export const metadata = { title: "Tasks · School Hub" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; mine?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFamily();
  const tz = ctx.family.timezone;
  const childId = await getChildFilter(ctx);
  const done = sp.view === "done";
  const mine = sp.mine === "1";

  let q = ctx.supabase.from("items").select(ITEM_SELECT).eq("family_id", ctx.family.id).eq("kind", "task");
  q = done ? q.not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(50) : q.is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(200);
  if (childId) q = q.or(childOrFilter(ctx, childId));
  if (mine) q = q.or(`assignee_id.eq.${ctx.userId},assignee_id.is.null`);
  const { data } = await q;
  const tasks = (data ?? []) as ItemView[];

  const now = new Date();
  const startToday = zonedToUtc(todayIn(tz), null, tz);
  const weekEnd = zonedToUtc(addDays(todayIn(tz), 7), null, tz);
  const groups = done
    ? [{ label: "Completed", items: tasks }]
    : [
        { label: "Overdue", items: tasks.filter((t) => t.due_at && t.due_at < startToday) },
        { label: "This week", items: tasks.filter((t) => t.due_at && t.due_at >= startToday && t.due_at < weekEnd) },
        { label: "Later", items: tasks.filter((t) => t.due_at && t.due_at >= weekEnd) },
        { label: "No due date", items: tasks.filter((t) => !t.due_at) },
      ];
  const members = ctx.members.map((m) => ({ id: m.user_id, name: m.display_name }));
  const link = (p: { view?: string; mine?: string }) => {
    const u = new URLSearchParams();
    const v = { view: done ? "done" : undefined, mine: mine ? "1" : undefined, ...p };
    Object.entries(v).forEach(([k, val]) => val && u.set(k, val));
    return `/tasks${u.size ? `?${u}` : ""}`;
  };

  return (
    <div className="space-y-5 pb-4">
      <PageTitle title="Tasks" subtitle={done ? "Recently completed" : `${tasks.length} open`} />
      <div className="flex gap-2">
        <nav aria-label="Task view" className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
          <Link href={link({ view: undefined })} aria-current={!done ? "page" : undefined} className={`rounded-lg py-1.5 text-center text-sm font-medium ${!done ? "bg-white shadow-sm" : "text-slate-600"}`}>Open</Link>
          <Link href={link({ view: "done" })} aria-current={done ? "page" : undefined} className={`rounded-lg py-1.5 text-center text-sm font-medium ${done ? "bg-white shadow-sm" : "text-slate-600"}`}>Done</Link>
        </nav>
        {ctx.members.length > 1 && (
          <Link href={link({ mine: mine ? undefined : "1" })} aria-pressed={mine} className={`rounded-xl border px-3 py-1.5 text-sm font-medium ${mine ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Mine</Link>
        )}
      </div>
      {!done && <QuickAddTask whoOptions={whoOptions(ctx)} />}

      {tasks.length === 0 ? (
        <EmptyState icon="task" title={done ? "Nothing completed yet" : "All caught up"} body={done ? "Completed tasks show here." : "No open school tasks. New ones appear when you add documents or messages."} />
      ) : (
        groups.filter((g) => g.items.length).map((g) => (
          <section key={g.label}>
            <h2 className={`mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider ${g.label === "Overdue" ? "text-rose-600" : "text-slate-500"}`}>{g.label}</h2>
            <Card className="divide-y divide-slate-100">
              {g.items.map((t) => {
                const due = t.due_at ? dueLabel(t.due_at, tz, now) : null;
                return (
                  <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="pt-0.5"><TaskToggle id={t.id} title={t.title} done={Boolean(t.completed_at)} /></div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/items/${t.id}?back=/tasks`} className={`block text-[15px] font-medium leading-snug ${t.completed_at ? "text-slate-500 line-through" : ""}`}>{t.title}</Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        {done ? (
                          <span className="text-slate-500">Done {fmt(t.completed_at!, tz, { month: "short", day: "numeric" })}{t.completed_by ? ` by ${ctx.members.find((m) => m.user_id === t.completed_by)?.display_name ?? "someone"}` : ""}</span>
                        ) : (
                          due && <span className={due.tone === "later" ? "text-slate-500" : "font-semibold text-rose-600"}>{due.label}</span>
                        )}
                        <WhoChips item={t} ctx={ctx} />
                        {t.category !== "general" && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{CATEGORY_LABELS[t.category]}{t.amount_cents != null ? ` $${(t.amount_cents / 100).toFixed(2)}` : ""}</span>}
                      </div>
                    </div>
                    {!done && ctx.members.length > 1 && <AssignSelect id={t.id} title={t.title} value={t.assignee_id} members={members} />}
                  </div>
                );
              })}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
