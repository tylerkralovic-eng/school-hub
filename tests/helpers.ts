import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/supabase/database.types";

export const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function admin() {
  return createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function newUser(label: string): Promise<{ client: SupabaseClient<Database>; id: string; email: string }> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.schoolhub.local`;
  const password = "Testpassword123";
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient<Database>(url(), anonKey(), { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { client, id: data.user!.id, email };
}
