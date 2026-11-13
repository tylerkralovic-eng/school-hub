import { z } from "zod";

/**
 * Contract between the AI model and School Hub. The model returns this shape
 * (enforced with structured outputs) and we validate it again with Zod before
 * anything touches the database. Dates are wall-clock strings in the family's
 * time zone; null means "not stated" — the model must never guess.
 */
export const ITEM_KINDS = ["event", "task", "announcement"] as const;
export const ITEM_CATEGORIES = [
  "general", "closure", "early_dismissal", "supplies", "permission_form",
  "payment", "lunch", "teacher_request", "activity", "reminder",
] as const;

export const ExtractedItemSchema = z.object({
  kind: z.enum(ITEM_KINDS).describe("event = happens at a time; task = parent must do something by a deadline; announcement = information only"),
  category: z.enum(ITEM_CATEGORIES),
  title: z.string().describe("Short, specific, parent-friendly title, e.g. 'No school – Thanksgiving break'"),
  details: z.string().nullable().describe("Useful specifics: what to bring, cost, instructions. Null if none."),
  date: z.string().nullable().describe("YYYY-MM-DD. Event start date, or task due date. Null if the source does not state a date."),
  start_time: z.string().nullable().describe("HH:MM 24-hour, only if stated"),
  end_date: z.string().nullable().describe("YYYY-MM-DD for multi-day events, else null"),
  end_time: z.string().nullable().describe("HH:MM 24-hour, only if stated"),
  location: z.string().nullable(),
  amount_usd: z.number().nullable().describe("Money owed or requested, in US dollars, only if stated"),
  applies_to: z.enum(["child", "school", "family", "unknown"]).describe("child = one specific child; school = everyone at a school; family = whole family; unknown = cannot tell"),
  child_id: z.string().nullable().describe("Exact id from the roster when applies_to = child, else null"),
  school_id: z.string().nullable().describe("Exact id from the roster when known, else null"),
  evidence: z.string().describe("Short verbatim quote from the source that supports this item"),
  confidence: z.enum(["high", "medium", "low"]),
  uncertainty: z.string().nullable().describe("If anything is unclear (date, time, which child), explain briefly; else null"),
});

export const ExtractionSchema = z.object({
  is_school_related: z.boolean().describe("False for content unrelated to school or children's activities"),
  document_type: z.enum(["calendar", "newsletter", "permission_form", "flyer", "lunch_menu", "message", "receipt", "other"]),
  summary: z.string().describe("One or two sentences describing the source for the parent"),
  items: z.array(ExtractedItemSchema),
});

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;
