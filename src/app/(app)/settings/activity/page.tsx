import { Card, PageTitle } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { fmt } from "@/lib/time";

export const metadata = { title: "Activity · School Hub" };

const LABELS: Record<string, string> = {
  "family.created": "Created the family", "family.updated": "Changed family settings", "invite.created": "Invited", "invite.accepted": "Joined the family",
  "member.removed": "Removed a member", "child.deleted": "Removed a child", "gmail.connected": "Connected Gmail", "gmail.disconnected": "Disconnected Gmail",
  "sms.phone_linked": "Linked a phone for texts", "sms.phone_unlinked": "Unlinked a phone", "ingest_token.created": "Created a Shortcut key", "ingest_token.revoked": "Revoked a Shortcut key",
  "document.deleted": "Deleted an original document", "item.deleted": "Deleted an item", "item.updated": "Edited an item", "review.applied": "Reviewed extracted items",
  "data.exported": "Exported family data", "calendar.token_rotated": "Reset the calendar link", "retention.purged": "Old originals deleted (retention)",
};

export default async function ActivityPage() {
  const ctx = await requireFamily();
  const { data } = await ctx.supabase.from("audit_events").select("*").eq("family_id", ctx.family.id).order("created_at", { ascending: false }).limit(100);
  const who = (id: string | null) => ctx.members.find((m) => m.user_id === id)?.display_name ?? (id ? "Former member" : "School Hub");
  return (
    <div className="space-y-5 pb-6">
      <PageTitle title="Activity log" subtitle="Security-relevant actions in your family workspace." />
      <Card className="divide-y divide-slate-100">
        {(data ?? []).map((e) => (
          <div key={e.id} className="px-4 py-2.5 text-sm">
            <p><b>{who(e.user_id)}</b> · {LABELS[e.action] ?? e.action}{e.target && e.action.startsWith("invite") ? ` ${e.target}` : ""}</p>
            <p className="text-xs text-slate-500">{fmt(e.created_at, ctx.family.timezone, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
          </div>
        ))}
        {!data?.length && <p className="px-4 py-3 text-sm text-slate-500">No activity yet.</p>}
      </Card>
    </div>
  );
}
