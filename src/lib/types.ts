/**
 * Core domain types for School Hub.
 *
 * These mirror the entities in docs/02 Technical Architecture
 * (families, children, schools, sources, school_items, item_sources) so the
 * same shapes can later be backed by Supabase tables and produced by the
 * server-side AI extraction pipeline without changing the UI.
 */

export type ISODateString = string;

export interface Family {
  id: string;
  name: string;
  /** IANA timezone the family lives in; school timezones can differ. */
  timezone: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  displayName: string;
  role: "parent" | "caregiver";
}

export type ChildColor = "violet" | "teal";

export interface Child {
  id: string;
  familyId: string;
  firstName: string;
  grade: string;
  schoolId: string;
  color: ChildColor;
}

export interface School {
  id: string;
  name: string;
  shortName: string;
  timezone: string;
}

export type SourceKind =
  | "school_email"
  | "teacher_email"
  | "calendar_feed"
  | "school_app"
  | "manual_share";

/**
 * Source health. "not_connected" must never be presented as "no updates":
 * the product promise is to be honest about what we cannot see.
 */
export type SourceStatus = "connected" | "stale" | "not_connected";

export interface Source {
  id: string;
  familyId: string;
  /** null for family-level sources such as "Shared by you". */
  schoolId: string | null;
  name: string;
  kind: SourceKind;
  status: SourceStatus;
  lastSyncedAt: ISODateString | null;
  note?: string;
}

export type ItemKind = "task" | "event" | "announcement";

export type ReviewStatus = "published" | "needs_review";

export type Priority = "high" | "normal";

/**
 * The provenance of an item: which source it came from, when it was
 * received and the evidence it was derived from. Maps to source_documents +
 * item_sources. An item can have several (duplicate announcements merged).
 */
export interface ItemSourceRef {
  sourceId: string;
  receivedAt: ISODateString;
  /** Verbatim excerpt from the original message ("source evidence"). */
  excerpt: string;
  /** Sender as shown to the parent, e.g. "Ms. Alvarez (4th grade)". */
  from?: string;
}

/**
 * A family-scoped school item. Field names follow the extraction contract:
 * kind, title, child match or null, due_at or null, event_at or null,
 * source evidence, needs_review.
 */
export interface SchoolItem {
  id: string;
  familyId: string;
  kind: ItemKind;
  title: string;
  summary: string;
  schoolId: string;
  /** null = applies to every child at schoolId (e.g. school-wide notices). */
  childId: string | null;
  dueAt: ISODateString | null;
  eventAt: ISODateString | null;
  eventEndAt?: ISODateString | null;
  allDay?: boolean;
  location?: string;
  priority: Priority;
  reviewStatus: ReviewStatus;
  /** Why the item needs review, shown to the parent. */
  reviewNote?: string;
  sources: ItemSourceRef[];
}

/** Everything the dashboard needs for one family, loaded in one call. */
export interface FamilySnapshot {
  family: Family;
  members: FamilyMember[];
  children: Child[];
  schools: School[];
  sources: Source[];
  items: SchoolItem[];
  /** True while the app is running on fictional fixture data. */
  isDemo: boolean;
}
