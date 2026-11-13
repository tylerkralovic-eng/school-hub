"use server";

import { redirect } from "next/navigation";
import { requireFamily } from "@/lib/server/context";
import { createAdminClient } from "@/lib/supabase/admin";

async function removeFamilyFiles(familyId: string) {
  const db = createAdminClient();
  // Objects live at {family}/{document}/{file}; list folders then files.
  const { data: folders } = await db.storage.from("documents").list(familyId, { limit: 1000 });
  for (const f of folders ?? []) {
    const { data: files } = await db.storage.from("documents").list(`${familyId}/${f.name}`, { limit: 100 });
    const paths = (files ?? []).map((x) => `${familyId}/${f.name}/${x.name}`);
    if (paths.length) await db.storage.from("documents").remove(paths);
  }
}

/** Owner-only: permanently deletes the family workspace, all its data and files. */
export async function deleteFamily(form: FormData) {
  const ctx = await requireFamily();
  if (ctx.me.role !== "owner") return;
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== ctx.family.name.trim().toLowerCase()) redirect("/settings/data?error=confirm");
  const db = createAdminClient();
  const { data: conns } = await db.from("gmail_connections").select("id").eq("family_id", ctx.family.id);
  // Revoking Google tokens is best-effort; rows are deleted by cascade.
  for (const c of conns ?? []) await db.from("integration_secrets").delete().eq("kind", "gmail").eq("owner_ref", c.id);
  await removeFamilyFiles(ctx.family.id);
  await db.from("families").delete().eq("id", ctx.family.id);
  console.info("family deleted", ctx.family.id);
  redirect("/onboarding");
}

/** Deletes the signed-in user's login. Owners with other members must delete the family or leave it to others first. */
export async function deleteAccount() {
  const ctx = await requireFamily();
  if (ctx.me.role === "owner" && ctx.members.length > 1) redirect("/settings/data?error=owner");
  const db = createAdminClient();
  if (ctx.me.role === "owner") {
    await removeFamilyFiles(ctx.family.id);
    await db.from("families").delete().eq("id", ctx.family.id);
  }
  await db.auth.admin.deleteUser(ctx.userId);
  await ctx.supabase.auth.signOut();
  redirect("/login");
}
