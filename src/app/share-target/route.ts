import { after, NextResponse } from "next/server";
import { processDocument } from "@/lib/pipeline/process";
import { getUser } from "@/lib/server/context";
import { ingestSubmission } from "@/lib/server/ingest-files";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

/**
 * PWA Web Share Target (Android Chrome after "Install app"). The OS posts
 * shared files/text here; the parent's own session (RLS) stores them.
 */
export async function POST(req: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/add", req.url), 303);
  const { data: m } = await supabase.from("family_members").select("family_id").eq("user_id", user.id).maybeSingle();
  if (!m) return NextResponse.redirect(new URL("/onboarding", req.url), 303);

  const form = await req.formData();
  const files: { name: string; data: Uint8Array }[] = [];
  for (const v of form.getAll("files")) if (v instanceof File && v.size) files.push({ name: v.name || "shared", data: new Uint8Array(await v.arrayBuffer()) });
  const text = [form.get("title"), form.get("text"), form.get("url")].filter((x) => typeof x === "string" && x.trim()).join("\n");

  if (!files.length && !text.trim()) return NextResponse.redirect(new URL("/add", req.url), 303);
  const { batchId, docIds } = await ingestSubmission(supabase, { familyId: m.family_id, userId: user.id, channel: "share", files, text });
  if (!docIds.length) return NextResponse.redirect(new URL("/add?repeat=1", req.url), 303);
  // Background extraction runs after the response, outside the request's cookie
  // scope, so it uses the service client for documents we just created and verified.
  after(async () => {
    const db = createAdminClient();
    for (const id of docIds) await processDocument(db, id);
  });
  return NextResponse.redirect(new URL(`/review/${batchId}`, req.url), 303);
}
