/**
 * Finds likely school senders in a parent's inbox from headers only (who sent
 * it + subject line), so the parent can approve them with one tap instead of
 * typing addresses. Pure helpers here; the AI step lives in discover-ai.ts.
 */
import { senderAddress } from "@/lib/integrations/rules";
import type { MailHeaders } from "@/lib/integrations/gmail";

export interface SenderSummary {
  address: string;
  name: string;
  domain: string;
  count: number;
  subjects: string[];
  last: string;
}

export interface SenderSuggestion extends SenderSummary {
  pattern: string; // what the rule will match: "@domain" or the exact address
  platform_key: string | null;
  child_name: string | null;
  reason: string;
  confidence: "high" | "medium";
}

/** Known school-app sending domains → platform. */
export const PLATFORM_DOMAINS: Record<string, string> = {
  "remind.com": "remind",
  "myschoolbucks.com": "myschoolbucks",
  "parentsquare.com": "parentsquare",
  "classdojo.com": "classdojo",
  "seesaw.me": "seesaw",
  "brightwheel.com": "brightwheel",
  "mybrightwheel.com": "brightwheel",
  "classroom.google.com": "google_classroom",
  "powerschool.com": "powerschool",
  "infinitecampus.com": "infinite_campus",
  "infinitecampus.org": "infinite_campus",
};

/** Personal email domains: match a specific address, never the whole domain. */
export const PERSONAL_DOMAINS = new Set(["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "me.com", "aol.com", "live.com", "msn.com", "comcast.net", "att.net", "proton.me", "protonmail.com"]);

const SCHOOL_WORDS = /\b(school|schools|k12|elementary|middle school|high school|preschool|pre-k|daycare|academy|montessori|district|pta|pto|teacher|classroom|kindergarten|principal|field trip|lunch|cafeteria|report card|conference|early release|early dismissal|homework|room parent|spirit week|picture day|ctls|isd|usd)\b/i;

export function domainOf(address: string): string {
  return address.split("@")[1]?.toLowerCase() ?? "";
}

function displayName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return (m?.[1] ?? "").trim();
}

/** Groups messages by sender address, newest first, with up to 3 sample subjects. */
export function aggregateSenders(heads: MailHeaders[]): SenderSummary[] {
  const map = new Map<string, SenderSummary>();
  for (const h of heads) {
    const address = senderAddress(h.from);
    if (!address.includes("@")) continue;
    const cur = map.get(address) ?? { address, name: displayName(h.from), domain: domainOf(address), count: 0, subjects: [], last: h.date };
    cur.count++;
    if (h.subject && cur.subjects.length < 3 && !cur.subjects.includes(h.subject)) cur.subjects.push(h.subject.slice(0, 120));
    if (h.date > cur.last) cur.last = h.date;
    map.set(address, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}

/** The rule pattern for a sender: whole domain for organizations, exact address for personal mailboxes. */
export function patternFor(s: Pick<SenderSummary, "address" | "domain">): string {
  return PERSONAL_DOMAINS.has(s.domain) ? s.address : `@${s.domain}`;
}

/** Rule-based guess (used without AI, and to shortlist for the AI). */
export function heuristicSuggestion(s: SenderSummary): SenderSuggestion | null {
  const platform = Object.entries(PLATFORM_DOMAINS).find(([d]) => s.domain === d || s.domain.endsWith("." + d))?.[1] ?? null;
  const text = `${s.name} ${s.domain} ${s.subjects.join(" ")}`;
  const edu = /\.(k12\.[a-z]{2}\.us|edu)$|k12\./.test(s.domain);
  if (platform) return { ...s, pattern: `@${s.domain}`, platform_key: platform, child_name: null, reason: "School app", confidence: "high" };
  if (edu) return { ...s, pattern: `@${s.domain}`, platform_key: null, child_name: null, reason: "School or district address", confidence: "high" };
  if (SCHOOL_WORDS.test(text)) return { ...s, pattern: patternFor(s), platform_key: null, child_name: null, reason: "Mentions school topics", confidence: "medium" };
  return null;
}

/** Collapses suggestions that resolve to the same pattern (e.g. several teachers @district.org). */
export function mergeByPattern(list: SenderSuggestion[]): SenderSuggestion[] {
  const map = new Map<string, SenderSuggestion>();
  for (const s of list) {
    const cur = map.get(s.pattern);
    if (!cur) map.set(s.pattern, { ...s });
    else {
      cur.count += s.count;
      cur.subjects = [...new Set([...cur.subjects, ...s.subjects])].slice(0, 3);
      if (s.confidence === "high") cur.confidence = "high";
      cur.child_name = cur.child_name ?? s.child_name;
      cur.platform_key = cur.platform_key ?? s.platform_key;
    }
  }
  return [...map.values()].sort((a, b) => (a.confidence === b.confidence ? b.count - a.count : a.confidence === "high" ? -1 : 1));
}
