import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Child, Family, FamilyMember, School } from "@/lib/types";

/** Signed-in user (verified with the auth server), or null. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
});

export interface FamilyContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string;
  family: Family;
  me: FamilyMember;
  members: FamilyMember[];
  children: Child[];
  schools: School[];
}

/**
 * Loads the current user's family workspace. Redirects to /login when signed
 * out and to /onboarding when the user has no family yet. Cached per request.
 */
export const requireFamily = cache(async (): Promise<FamilyContext> => {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("*, families(*)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !membership.families) redirect("/onboarding");

  const familyId = membership.family_id;
  const [members, children, schools] = await Promise.all([
    supabase.from("family_members").select("*").eq("family_id", familyId).order("created_at"),
    supabase.from("children").select("*").eq("family_id", familyId).order("created_at"),
    supabase.from("schools").select("*").eq("family_id", familyId).order("created_at"),
  ]);

  const { families, ...me } = membership;
  return {
    supabase,
    userId: user.id,
    email: user.email ?? "",
    family: families as Family,
    me: me as FamilyMember,
    members: members.data ?? [],
    children: children.data ?? [],
    schools: schools.data ?? [],
  };
});

/** Records a security-relevant action. Never throws (auditing must not break UX). */
export async function audit(ctx: Pick<FamilyContext, "supabase" | "family" | "userId">, action: string, target?: string, metadata: Record<string, unknown> = {}) {
  try {
    await ctx.supabase.from("audit_events").insert({
      family_id: ctx.family.id,
      user_id: ctx.userId,
      action,
      target: target ?? null,
      metadata: metadata as never,
    });
  } catch {
    // ignore
  }
}
