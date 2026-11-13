import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/integrations/crypto";
import { GMAIL_SCOPES, exchangeCode } from "@/lib/integrations/gmail";
import { getUser } from "@/lib/server/context";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/connections?gmail=${q}`, url.origin));
    res.cookies.delete({ name: "sh_gmail_state", path: "/api/gmail" });
    return res;
  };
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  const expected = (await cookies()).get("sh_gmail_state")?.value ?? "";
  const got = url.searchParams.get("state") ?? "";
  if (!expected || expected.length !== got.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(got))) return back("state_mismatch");
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code) return back("error");

  const { data: membership } = await supabase.from("family_members").select("family_id").eq("user_id", user.id).maybeSingle();
  if (!membership) return back("error");

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch {
    return back("error");
  }
  if (!tokens.scopes.includes(GMAIL_SCOPES[2])) return back("scope_missing");

  // Service client: secrets table is not accessible to users by design.
  const db = createAdminClient();
  const { data: conn, error } = await db
    .from("gmail_connections")
    .upsert({ family_id: membership.family_id, user_id: user.id, google_email: tokens.email, status: "connected", last_error: null }, { onConflict: "family_id,user_id" })
    .select("id")
    .single();
  if (error || !conn) return back("error");
  await db.from("integration_secrets").upsert({ family_id: membership.family_id, kind: "gmail", owner_ref: conn.id, ciphertext: encryptSecret(tokens.refreshToken), updated_at: new Date().toISOString() }, { onConflict: "kind,owner_ref" });
  await db.from("audit_events").insert({ family_id: membership.family_id, user_id: user.id, action: "gmail.connected", target: tokens.email });
  return back("connected");
}
