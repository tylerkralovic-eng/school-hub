/**
 * Built-in understanding of onboarding answers — works without AI (and is the
 * fallback when AI is unavailable). Deliberately conservative.
 */
import { PLATFORM_ALIASES, PLATFORMS } from "@/lib/platforms";
import type { InviteDraft, KidDraft, PlatformDraft } from "@/lib/onboarding/types";

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export function parseMe(answer: string): string | null {
  const cleaned = answer.trim().replace(/^(hi|hey|hello)[,!.\s]+/i, "").replace(/^(i'?m|i am|it'?s|my name is|call me|this is)\s+/i, "");
  const word = cleaned.split(/[\s,.!]+/)[0];
  return word && /^[\p{L}'-]{1,30}$/u.test(word) ? cap(word) : null;
}

const NOT_NAMES = new Set(["and", "my", "kids", "are", "is", "the", "we", "have", "two", "three", "one", "son", "daughter", "both", "plus", "our", "a", "an", "with", "child", "children"]);

export function parseKids(answer: string): KidDraft[] {
  const parts = answer.replace(/\(.*?\)/g, "").split(/,|&|\band\b|\bplus\b|\n|;/i);
  const kids: KidDraft[] = [];
  for (const part of parts) {
    const words = part.trim().split(/\s+/).filter((w) => /^[\p{L}'-]+$/u.test(w) && !NOT_NAMES.has(w.toLowerCase()));
    const name = words.find((w) => /^\p{Lu}/u.test(w)) ?? words[0];
    if (name && name.length <= 30 && !kids.some((k) => k.first_name.toLowerCase() === name.toLowerCase()))
      kids.push({ first_name: cap(name), grade: null, school: null, town: null });
  }
  return kids.slice(0, 8);
}

const GRADE_RE = /\b(pre-?k(?:indergarten)?|pk|kindergarten|k|(\d{1,2})(?:st|nd|rd|th)?\s*grade|grade\s*(\d{1,2}))\b/i;
const STAGE_RE = /\b(preschool|daycare|toddler|infant)\b/i;

export function parseSchool(answer: string): { school: string | null; grade: string | null; town: string | null } {
  if (answer === "__none__") return { school: null, grade: null, town: null };
  let rest = answer.trim();
  let grade: string | null = null;
  const g = rest.match(GRADE_RE);
  if (g) {
    const n = g[2] ?? g[3];
    grade = n ? `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[Number(n)] ?? "th"} grade` : /pre|pk/i.test(g[1]) ? "Pre-K" : "Kindergarten";
    rest = rest.replace(g[0], " ");
  } else {
    const st = rest.match(STAGE_RE);
    if (st) grade = cap(st[1].toLowerCase()); // keep the word: it's often part of the school name
  }
  rest = rest.replace(/\b(she|he|they)\s+(goes|go|attends|attend|is|are)\s+(to|at|in)\b/gi, " ").replace(/\b(goes to|attends|is at|at|in the)\b/gi, " ");
  // "School name, Town ST" → split off town after the last comma if it looks like a place
  const segments = rest.split(/,|\bin\b/i).map((x) => x.trim()).filter(Boolean);
  let town: string | null = null;
  if (segments.length > 1) {
    const last = segments[segments.length - 1];
    if (!/school|academy|elementary|middle|high|preschool|daycare|montessori/i.test(last)) {
      town = last;
      segments.pop();
    }
  }
  const school = segments.join(", ").replace(/\s{2,}/g, " ").replace(/^[\s.,-]+|[\s.,-]+$/g, "");
  return { school: school || null, grade, town };
}

export function parsePlatforms(answer: string, kidNames: string[]): { platforms: PlatformDraft[]; channels: string[] } {
  const text = ` ${answer.toLowerCase()} `;
  const platforms: PlatformDraft[] = [];
  for (const [key, aliases] of Object.entries(PLATFORM_ALIASES)) {
    const idx = aliases.map((a) => text.indexOf(a)).filter((i) => i >= 0);
    if (key === "google_classroom" && !text.includes("google")) continue;
    if (!idx.length) continue;
    // Kids mentioned in the same clause as the platform
    const clause = answer.split(/[,;.]|\band\b(?=\s+[A-Z])/).find((c) => aliases.some((a) => c.toLowerCase().includes(a))) ?? "";
    const kids = kidNames.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(clause));
    const p = PLATFORMS.find((x) => x.key === key)!;
    const ch: string[] = [];
    if (/\btext|sms\b/i.test(clause)) ch.push("sms");
    if (/e-?mail/i.test(clause)) ch.push("email");
    if (/push|notification|app\b/i.test(clause)) ch.push("push");
    platforms.push({ key, child_names: kids, channels: ch.length ? ch : [...p.typicalChannels] });
  }
  const channels: string[] = [];
  if (/\bemails?\b|e-mail|\bemail\b/.test(text)) channels.push("email");
  if (/\btexts?\b|\bsms\b/.test(text)) channels.push("sms");
  return { platforms, channels };
}

export function parseInvite(answer: string): InviteDraft | null {
  if (answer === "__none__") return null;
  const email = answer.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
  if (!email) return null;
  const name = answer.replace(email, " ").replace(/[,<>()]/g, " ").trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w) && !/^(my|is|at|and|email|wife|husband|partner)$/i.test(w))[0];
  return { name: name ? cap(name) : null, email: email.toLowerCase() };
}
