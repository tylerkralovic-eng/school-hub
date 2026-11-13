import "server-only";
import { cookies } from "next/headers";
import type { FamilyContext } from "@/lib/server/context";

/** Selected child id, or null for everyone. Ignores ids not in this family. */
export async function getChildFilter(ctx: FamilyContext): Promise<string | null> {
  const v = (await cookies()).get("sh_child")?.value;
  return v && ctx.children.some((c) => c.id === v) ? v : null;
}
