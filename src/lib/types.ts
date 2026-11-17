/** Row types from the database, plus small shared UI types. */
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type Family = Tables["families"]["Row"];
export type FamilyMember = Tables["family_members"]["Row"];
export type Child = Tables["children"]["Row"];
export type School = Tables["schools"]["Row"];
export type Item = Tables["items"]["Row"];
export type SourceDocument = Tables["source_documents"]["Row"];
export type Candidate = Tables["extraction_candidates"]["Row"];
export type FamilyPlatform = Tables["family_platforms"]["Row"];
export type SenderRule = Tables["sender_rules"]["Row"];
export type GmailConnection = Tables["gmail_connections"]["Row"];

export type ItemKind = Enums["item_kind"];
export type ItemCategory = Enums["item_category"];
export type Channel = Enums["channel"];
export type DocumentStatus = Enums["document_status"];

export const CHILD_COLORS = ["violet", "teal", "amber", "rose", "sky", "emerald"] as const;
export type ChildColor = (typeof CHILD_COLORS)[number];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  general: "General",
  closure: "School closed",
  early_dismissal: "Early dismissal",
  supplies: "Supplies",
  permission_form: "Permission form",
  payment: "Payment",
  lunch: "Lunch",
  teacher_request: "Teacher request",
  activity: "Activity",
  reminder: "Reminder",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  upload: "Upload",
  paste: "Pasted text",
  share: "Shared",
  gmail: "Gmail",
  sms: "Text message",
  manual: "Added by hand",
  web: "School website",
};
