import "server-only";
import type { FamilyContext } from "@/lib/server/context";
import type { Channel, Item } from "@/lib/types";

export const ITEM_SELECT =
  "*, item_sources(evidence, created_at, document:source_documents(id, channel, title, sender, received_at, platform_key, mime_type, storage_path, origin_ref, origin_account))";

export interface ItemSourceView {
  evidence: string | null;
  created_at: string;
  document: {
    id: string;
    channel: Channel;
    title: string | null;
    sender: string | null;
    received_at: string;
    platform_key: string | null;
    mime_type: string | null;
    storage_path: string | null;
    origin_ref: string | null;
    origin_account: string | null;
  } | null;
}
export type ItemView = Item & { item_sources: ItemSourceView[] };

/** PostgREST "or" filter: items for a child, their school, or the whole family. */
export function childOrFilter(ctx: FamilyContext, childId: string): string {
  const child = ctx.children.find((c) => c.id === childId);
  const parts = [`child_id.eq.${childId}`, "and(child_id.is.null,school_id.is.null)"];
  if (child?.school_id) parts.push(`and(child_id.is.null,school_id.eq.${child.school_id})`);
  return parts.join(",");
}

/** Most recent time any source delivered this item (fallback: created). */
export function receivedAt(item: ItemView): string {
  return item.item_sources.reduce((acc, s) => (s.document && s.document.received_at > acc ? s.document.received_at : acc), item.item_sources[0]?.document?.received_at ?? item.created_at);
}

/** Date the item belongs to on a calendar (event start or task due). */
export function itemDate(item: Item): string | null {
  return item.starts_at ?? item.due_at ?? null;
}

/** Deep link to the original email in the right Gmail account (null if not an email we can link). */
export function inboxLink(doc: { channel: string; origin_ref: string | null; origin_account: string | null } | null): string | null {
  if (!doc || doc.channel !== "gmail" || !doc.origin_ref?.startsWith("gmail:") || !doc.origin_account?.includes("@")) return null;
  return `https://mail.google.com/mail/u/${encodeURIComponent(doc.origin_account)}/#all/${encodeURIComponent(doc.origin_ref.slice(6))}`;
}
