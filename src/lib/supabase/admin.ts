import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role client: bypasses RLS. Only for trusted server paths that have
 * no user session (inbound webhooks, cron jobs, encrypted secrets). Every
 * query made with it MUST filter by a family_id established by the caller.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl(), env.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
