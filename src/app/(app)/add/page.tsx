import Link from "next/link";
import { AddForm } from "@/components/AddForm";
import { Icon } from "@/components/Icon";
import { Card, PageTitle, SectionHeader } from "@/components/ui";
import { features } from "@/lib/env";
import { requireFamily } from "@/lib/server/context";
import { receivedLabel } from "@/lib/time";
import { CHANNEL_LABELS } from "@/lib/types";

export const metadata = { title: "Add · School Hub" };
export const maxDuration = 300;

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Waiting", tone: "bg-slate-100 text-slate-600" },
  processing: { label: "Reading…", tone: "bg-indigo-50 text-indigo-700" },
  needs_review: { label: "Review", tone: "bg-amber-100 text-amber-800" },
  done: { label: "Done", tone: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", tone: "bg-rose-50 text-rose-700" },
  ignored: { label: "Not school", tone: "bg-slate-100 text-slate-500" },
};

export default async function AddPage() {
  const ctx = await requireFamily();
  const { data: recent } = await ctx.supabase
    .from("source_documents")
    .select("id, batch_id, channel, title, sender, status, received_at, ai_summary")
    .eq("family_id", ctx.family.id)
    .order("created_at", { ascending: false })
    .limit(15);

  const who = [
    ...ctx.children.map((c) => ({ value: c.id, label: c.first_name })),
    ...ctx.schools.map((s) => ({ value: `school:${s.id}`, label: `All of ${s.short_name || s.name}` })),
  ];

  return (
    <div className="space-y-7 pb-4">
      <PageTitle title="Add school info" subtitle="Calendars, flyers, newsletters, forms, menus, screenshots or messages." />
      <AddForm who={who} aiReady={features.ai()} />

      <section id="recent">
        <SectionHeader title="Recently added" />
        {!recent?.length ? (
          <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <Card className="divide-y divide-slate-100">
            {recent.map((d) => (
              <Link key={d.id} href={`/review/${d.batch_id}`} className="flex items-center gap-3 px-4 py-3">
                <Icon name={d.channel === "paste" || d.channel === "sms" ? "text" : d.channel === "gmail" ? "mail" : "file"} className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{d.title || d.sender || CHANNEL_LABELS[d.channel]}</p>
                  <p className="truncate text-xs text-slate-500">{CHANNEL_LABELS[d.channel]} · {receivedLabel(d.received_at, ctx.family.timezone)}{d.ai_summary ? ` · ${d.ai_summary}` : ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[d.status].tone}`}>{STATUS[d.status].label}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
