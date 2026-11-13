import { NextResponse } from "next/server";
import { audit, requireFamily } from "@/lib/server/context";

/** Downloads all of the family's data as JSON (files are listed by path, not embedded). */
export async function GET() {
  const ctx = await requireFamily();
  const f = ctx.family.id;
  const q = <T extends string>(t: T) => ctx.supabase.from(t as "items").select("*").eq("family_id", f).limit(10000);
  const [items, docs, sources, candidates, platforms, rules] = await Promise.all([q("items"), q("source_documents"), q("item_sources"), q("extraction_candidates"), q("family_platforms"), q("sender_rules")]);
  await audit(ctx, "data.exported");
  const body = {
    exported_at: new Date().toISOString(),
    family: { name: ctx.family.name, timezone: ctx.family.timezone },
    members: ctx.members.map((m) => ({ name: m.display_name, email: m.email, role: m.role })),
    children: ctx.children,
    schools: ctx.schools,
    items: items.data,
    item_sources: sources.data,
    source_documents: docs.data,
    review_candidates: candidates.data,
    platforms: platforms.data,
    sender_rules: rules.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="school-hub-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}
