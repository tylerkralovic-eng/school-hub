import "server-only";
import { env } from "@/lib/env";
import { buildDigest } from "@/lib/reminders/digest";
import { sendEmail } from "@/lib/server/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, todayIn, utcToZoned, zonedToUtc } from "@/lib/time";

type Admin = ReturnType<typeof createAdminClient>;

/** Deletes raw originals older than each family's retention setting. Extracted items remain. */
export async function purgeExpiredDocuments(db: Admin) {
  const { data: families } = await db.from("families").select("id, document_retention_days").not("document_retention_days", "is", null);
  let purged = 0;
  for (const f of families ?? []) {
    const cutoff = new Date(Date.now() - f.document_retention_days! * 86400_000).toISOString();
    const { data: docs } = await db.from("source_documents").select("id, storage_path").eq("family_id", f.id).lt("received_at", cutoff).or("storage_path.not.is.null,text_content.not.is.null").limit(500);
    if (!docs?.length) continue;
    const paths = docs.map((d) => d.storage_path).filter(Boolean) as string[];
    if (paths.length) await db.storage.from("documents").remove(paths);
    await db.from("source_documents").update({ storage_path: null, text_content: null }).in("id", docs.map((d) => d.id));
    await db.from("audit_events").insert({ family_id: f.id, action: "retention.purged", metadata: { count: docs.length } });
    purged += docs.length;
  }
  return purged;
}

/** Sends the morning digest to members whose local time is past 6am and who haven't had one today. */
export async function sendDigests(db: Admin, now = new Date()) {
  const { data: members } = await db.from("family_members").select("family_id, user_id, display_name, email, last_digest_on, families(name, timezone)").eq("digest_enabled", true);
  let sent = 0;
  for (const m of members ?? []) {
    const fam = m.families as unknown as { name: string; timezone: string } | null;
    if (!fam) continue;
    const tz = fam.timezone;
    const today = todayIn(tz, now);
    const hour = Number(utcToZoned(now, tz).time.slice(0, 2));
    if (hour < 6 || m.last_digest_on === today) continue;

    const start = zonedToUtc(today, null, tz);
    const end = zonedToUtc(addDays(today, 1), null, tz);
    const dueBy = zonedToUtc(addDays(today, 2), null, tz);
    const [{ data: events }, { data: tasks }, { count }, { data: kids }, { data: fm }] = await Promise.all([
      db.from("items").select("*").eq("family_id", m.family_id).not("starts_at", "is", null).lt("starts_at", end).or(`starts_at.gte.${start},ends_at.gte.${start}`).order("starts_at"),
      db.from("items").select("*").eq("family_id", m.family_id).eq("kind", "task").is("completed_at", null).lt("due_at", dueBy).or(`assignee_id.is.null,assignee_id.eq.${m.user_id}`).order("due_at"),
      db.from("extraction_candidates").select("id", { count: "exact", head: true }).eq("family_id", m.family_id).eq("status", "pending"),
      db.from("children").select("id, first_name").eq("family_id", m.family_id),
      db.from("family_members").select("user_id, display_name").eq("family_id", m.family_id),
    ]);
    const kid = (id: string | null) => kids?.find((k) => k.id === id)?.first_name ?? null;
    const who = (id: string | null) => fm?.find((x) => x.user_id === id)?.display_name ?? null;
    const map = (i: NonNullable<typeof events>[number]) => ({ title: i.title, kind: i.kind, category: i.category, starts_at: i.starts_at, all_day: i.all_day, due_at: i.due_at, childName: kid(i.child_id), assigneeName: who(i.assignee_id) });
    const digest = buildDigest({ memberName: m.display_name, familyName: fam.name, timezone: tz, appUrl: env.appUrl(), now, todayEvents: (events ?? []).map(map), tasks: (tasks ?? []).map(map), pendingReview: count ?? 0 });
    if (digest) {
      // Only mark as sent on success so a failed send is retried on the next run.
      if (!(await sendEmail(m.email, digest.subject, digest.text, digest.html))) continue;
      sent++;
    }
    await db.from("family_members").update({ last_digest_on: today }).eq("family_id", m.family_id).eq("user_id", m.user_id);
  }
  return sent;
}
