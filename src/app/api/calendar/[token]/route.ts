import { NextResponse } from "next/server";
import { buildIcs } from "@/lib/reminders/ics";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/**
 * Private calendar subscription feed. The unguessable token in the URL is the
 * credential (standard for calendar subscriptions); parents can rotate it.
 */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!/^[a-f0-9]{48}$/.test(token)) return new NextResponse("Not found", { status: 404 });
  const db = createAdminClient();
  const { data: family } = await db.from("families").select("id, name, timezone").eq("calendar_token", token).maybeSingle();
  if (!family) return new NextResponse("Not found", { status: 404 });

  const since = new Date(Date.now() - 60 * 86400_000).toISOString();
  const [{ data: items }, { data: kids }] = await Promise.all([
    db.from("items").select("id, kind, title, details, location, starts_at, ends_at, all_day, due_at, completed_at, updated_at, child_id").eq("family_id", family.id).or(`starts_at.gte.${since},ends_at.gte.${since},due_at.gte.${since}`).limit(2000),
    db.from("children").select("id, first_name").eq("family_id", family.id),
  ]);
  const name = new Map((kids ?? []).map((k) => [k.id, k.first_name]));
  const body = buildIcs(family.name, family.timezone, (items ?? []).map((i) => ({ ...i, childName: i.child_id ? name.get(i.child_id) ?? null : null })), new URL(env.appUrl()).host);
  return new NextResponse(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900", "Content-Disposition": 'inline; filename="school-hub.ics"' },
  });
}
