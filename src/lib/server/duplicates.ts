import "server-only";
import { sameThingScore } from "@/lib/pipeline/dedupe";
import type { FamilyContext } from "@/lib/server/context";
import { ITEM_SELECT, type ItemView } from "@/lib/server/items";

/** Groups of saved items that look like the same thing (minus pairs the parent said are different). */
export async function findDuplicateItems(ctx: FamilyContext): Promise<ItemView[][]> {
  const [{ data }, { data: notDup }] = await Promise.all([
    ctx.supabase.from("items").select(ITEM_SELECT).eq("family_id", ctx.family.id).order("created_at").limit(800),
    ctx.supabase.from("not_duplicates").select("item_a, item_b").eq("family_id", ctx.family.id),
  ]);
  const items = (data ?? []) as ItemView[];
  const skip = new Set((notDup ?? []).flatMap((p) => [`${p.item_a}|${p.item_b}`, `${p.item_b}|${p.item_a}`]));
  const tz = ctx.family.timezone;
  const parent = new Map(items.map((x) => [x.id, x.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      if (skip.has(`${items[i].id}|${items[j].id}`)) continue;
      if (sameThingScore(items[i], items[j], tz) > 0) parent.set(find(items[i].id), find(items[j].id));
    }
  const groups = new Map<string, ItemView[]>();
  for (const x of items) groups.set(find(x.id), [...(groups.get(find(x.id)) ?? []), x]);
  return [...groups.values()].filter((g) => g.length > 1);
}

/** The item to keep: most sources, then most details, then oldest. */
export function pickKeeper(group: ItemView[]): ItemView {
  const score = (i: ItemView) => i.item_sources.length * 10 + (i.details ? 3 : 0) + (i.location ? 2 : 0) + (i.child_id ? 1 : 0);
  return [...group].sort((a, b) => score(b) - score(a) || a.created_at.localeCompare(b.created_at))[0];
}
