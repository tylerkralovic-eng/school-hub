/**
 * Data access boundary. The UI only reads family data through this module.
 *
 * Stage A (now): returns typed fictional fixtures.
 * Stage B: replace with a server-side Supabase query scoped by family
 * membership (RLS), keeping the FamilySnapshot shape stable.
 */
import { buildDemoSnapshot } from "@/lib/fixtures/demo-family";
import type { FamilySnapshot } from "@/lib/types";

export function getFamilySnapshot(now: Date = new Date()): FamilySnapshot {
  return buildDemoSnapshot(now);
}
