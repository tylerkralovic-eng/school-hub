import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { purgeExpiredDocuments, sendDigests } from "@/lib/server/jobs";
import { syncAllGmail } from "@/lib/integrations/gmail-sync";
import { syncAllMeetings } from "@/lib/server/meeting";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

function authorized(req: Request) {
  const secret = env.cronSecret();
  const got = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const want = `Bearer ${secret}`;
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** Scheduled job (Vercel Cron): Gmail sync, morning digests, retention purge, family meetings. */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const result: Record<string, unknown> = {};
  for (const [name, job] of [
    ["gmail", () => syncAllGmail(db)],
    ["digests", () => sendDigests(db)],
    ["purged", () => purgeExpiredDocuments(db)],
    ["meetings", () => syncAllMeetings(db)],
  ] as const) {
    try {
      result[name] = await job();
    } catch (e) {
      console.error(`cron ${name} failed`, e);
      result[name] = { error: true };
    }
  }
  return NextResponse.json(result);
}
