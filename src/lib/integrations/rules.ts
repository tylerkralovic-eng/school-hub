/** Sender-rule helpers (pure). Rules are an email address or "@domain". */
export interface Rule {
  pattern: string;
  platform_key: string | null;
  child_id: string | null;
  school_id: string | null;
}

export function normalizePattern(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (/^@[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return s;
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return s;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return "@" + s;
  return null;
}

/** Extracts the bare address from a From header: "Ms Lopez <lopez@school.org>" → lopez@school.org */
export function senderAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

export function matchRule(from: string, rules: Rule[]): Rule | null {
  const addr = senderAddress(from);
  const exact = rules.find((r) => !r.pattern.startsWith("@") && r.pattern === addr);
  if (exact) return exact;
  return rules.find((r) => r.pattern.startsWith("@") && (addr.endsWith(r.pattern) || addr.endsWith("." + r.pattern.slice(1)))) ?? null;
}

/** Gmail search query covering all rules. */
export function gmailQuery(rules: Rule[], newerThanDays: number): string | null {
  if (!rules.length) return null;
  const froms = rules.map((r) => (r.pattern.startsWith("@") ? r.pattern.slice(1) : r.pattern));
  return `from:(${froms.join(" OR ")}) newer_than:${newerThanDays}d -in:chats`;
}
