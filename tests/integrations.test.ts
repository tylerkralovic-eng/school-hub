import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";
import { htmlToText, type MailProvider } from "@/lib/integrations/gmail";
import { syncConnection } from "@/lib/integrations/gmail-sync";
import { gmailQuery, matchRule, normalizePattern } from "@/lib/integrations/rules";
import { buildDigest } from "@/lib/reminders/digest";
import { buildIcs } from "@/lib/reminders/ics";
import { createAdminClient } from "@/lib/supabase/admin";
import { zonedToUtc } from "@/lib/time";
import { newUser } from "./helpers";

describe("sender rules", () => {
  it("normalizes patterns", () => {
    expect(normalizePattern(" Teacher@School.org ")).toBe("teacher@school.org");
    expect(normalizePattern("remind.com")).toBe("@remind.com");
    expect(normalizePattern("@cobbk12.org")).toBe("@cobbk12.org");
    expect(normalizePattern("not an email")).toBeNull();
  });
  it("matches exact addresses before domains, including subdomains", () => {
    const rules = [
      { pattern: "@school.org", platform_key: null, child_id: null, school_id: "s1" },
      { pattern: "lopez@school.org", platform_key: null, child_id: "kid", school_id: null },
    ];
    expect(matchRule("Ms Lopez <Lopez@school.org>", rules)?.child_id).toBe("kid");
    expect(matchRule("office@mail.school.org", rules)?.school_id).toBe("s1");
    expect(matchRule("spam@evilschool.org", rules)).toBeNull();
  });
  it("builds a Gmail query", () => {
    expect(gmailQuery([{ pattern: "@remind.com", platform_key: null, child_id: null, school_id: null }], 7)).toBe("from:(remind.com) newer_than:7d -in:chats");
    expect(gmailQuery([], 7)).toBeNull();
  });
  it("converts html email to text", () => {
    expect(htmlToText("<p>Hi&nbsp;there</p><script>x()</script><div>Field trip &amp; lunch</div>")).toBe("Hi there\nField trip & lunch");
  });
});

describe("token encryption", () => {
  it("round-trips and detects tampering", () => {
    const blob = encryptSecret("1//refresh-token");
    expect(blob).not.toContain("refresh");
    expect(decryptSecret(blob)).toBe("1//refresh-token");
    const parts = blob.split(".");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
  it("accepts a long passphrase as the key", () => {
    const prev = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "correct horse battery staple, but much longer than that";
    expect(decryptSecret(encryptSecret("abc"))).toBe("abc");
    process.env.TOKEN_ENCRYPTION_KEY = "too short";
    expect(() => encryptSecret("abc")).toThrow(/32 characters/);
    process.env.TOKEN_ENCRYPTION_KEY = prev;
  });
});

describe("reminders", () => {
  const tz = "America/New_York";
  const now = new Date("2026-11-20T12:00:00Z");
  it("builds a digest only when there is something to say", () => {
    expect(buildDigest({ memberName: "Tyler", familyName: "F", timezone: tz, appUrl: "https://x", now, todayEvents: [], tasks: [], pendingReview: 0 })).toBeNull();
    const d = buildDigest({
      memberName: "Tyler", familyName: "F", timezone: tz, appUrl: "https://x", now, pendingReview: 2,
      todayEvents: [{ title: "No school", kind: "event", category: "closure", starts_at: zonedToUtc("2026-11-20", null, tz), all_day: true, due_at: null, childName: "Everley", assigneeName: null }],
      tasks: [{ title: "Return <form>", kind: "task", category: "permission_form", starts_at: null, all_day: false, due_at: zonedToUtc("2026-11-21", "23:59", tz), childName: null, assigneeName: "Morgan" }],
    })!;
    expect(d.subject).toContain("1 today");
    expect(d.text).toContain("HEADS UP: No school");
    expect(d.text).toContain("Due tomorrow: Return <form> · Morgan");
    expect(d.html).toContain("Return &lt;form&gt;");
  });
  it("builds a valid iCalendar feed", () => {
    const ics = buildIcs("Fam, Inc", tz, [
      { id: "e1", kind: "event", title: "Concert; grades K-2", details: null, location: "Gym", starts_at: "2026-12-14T23:00:00.000Z", ends_at: null, all_day: false, due_at: null, completed_at: null, updated_at: "2026-11-13T00:00:00.000Z", childName: "Everley" },
      { id: "e2", kind: "event", title: "Winter break", details: null, location: null, starts_at: zonedToUtc("2026-12-21", null, tz), ends_at: zonedToUtc("2027-01-01", null, tz), all_day: true, due_at: null, completed_at: null, updated_at: "2026-11-13T00:00:00.000Z", childName: null },
      { id: "t1", kind: "task", title: "Pay fee", details: null, location: null, starts_at: null, ends_at: null, all_day: false, due_at: zonedToUtc("2026-12-04", "23:59", tz), completed_at: null, updated_at: "2026-11-13T00:00:00.000Z", childName: null },
    ], "schoolhub.app");
    expect(ics).toContain("SUMMARY:Everley: Concert\\; grades K-2");
    expect(ics).toContain("DTSTART:20261214T230000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261221");
    expect(ics).toContain("DTEND;VALUE=DATE:20270102");
    expect(ics).toContain("SUMMARY:Due: Pay fee");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});

describe("gmail sync (fake mailbox, real database)", () => {
  it("ingests matching school emails once, with hints, and skips everything else", async () => {
    const u = await newUser("gm");
    const fam = (await u.client.rpc("create_family", { p_name: "G", p_timezone: "America/New_York", p_display_name: "P" })).data!;
    const kid = (await u.client.from("children").insert({ family_id: fam, first_name: "Everley" }).select("id").single()).data!.id;
    await u.client.from("sender_rules").insert({ family_id: fam, pattern: "@remind.com", platform_key: "remind", child_id: kid });
    const db = createAdminClient();
    const conn = (await db.from("gmail_connections").insert({ family_id: fam, user_id: u.id, google_email: "p@gmail.com" }).select("*").single()).data!;

    const mailbox: Record<string, { from: string; subject: string; text: string }> = {
      m1: { from: "Remind <no-reply@remind.com>", subject: "Ms. Lopez: Field trip Nov 20", text: "Please return the field trip form by Nov 18. Trip is Nov 20 at 9:00 am." },
      m2: { from: "Deals <promo@store.com>", subject: "Sale", text: "50% off" },
    };
    const queries: string[] = [];
    const fake: MailProvider = {
      async list(q) { queries.push(q); return Object.keys(mailbox); },
      async get(id) { return { id, ...mailbox[id], date: new Date().toISOString(), attachments: [] }; },
      async headers(id) { return { id, from: mailbox[id].from, subject: mailbox[id].subject, date: new Date().toISOString() }; },
    };
    const r1 = await syncConnection(db, conn, fake);
    expect(queries[0]).toContain("from:(remind.com)");
    expect(r1.created).toBe(1);
    const { data: docs } = await db.from("source_documents").select("*").eq("family_id", fam);
    expect(docs).toHaveLength(1);
    expect(docs![0].platform_key).toBe("remind");
    expect(docs![0].child_hint_id).toBe(kid);
    expect(docs![0].status).toBe("needs_review");
    const { count } = await db.from("extraction_candidates").select("id", { count: "exact", head: true }).eq("document_id", docs![0].id);
    expect(count).toBeGreaterThan(0);

    const r2 = await syncConnection(db, { ...conn, last_success_at: new Date().toISOString() }, fake);
    expect(r2.created).toBe(0);
    const { data: after } = await db.from("gmail_connections").select("*").eq("id", conn.id).single();
    expect(after!.status).toBe("connected");
    expect(after!.last_success_at).not.toBeNull();
  });

  it("records an auth error without crashing", async () => {
    const u = await newUser("gm2");
    const fam = (await u.client.rpc("create_family", { p_name: "G2", p_timezone: "America/New_York", p_display_name: "P" })).data!;
    await u.client.from("sender_rules").insert({ family_id: fam, pattern: "@school.org" });
    const db = createAdminClient();
    const conn = (await db.from("gmail_connections").insert({ family_id: fam, user_id: u.id, google_email: "p@gmail.com" }).select("*").single()).data!;
    const r = await syncConnection(db, conn); // no stored token → auth error
    expect(r.status).toBe("auth_error");
    const { data } = await db.from("gmail_connections").select("status, last_error").eq("id", conn.id).single();
    expect(data!.status).toBe("error");
    expect(data!.last_error).toMatch(/Reconnect/);
  });
});

import { aggregateSenders, heuristicSuggestion, mergeByPattern, patternFor } from "@/lib/integrations/discover";
import { discoverSchoolSenders } from "@/lib/integrations/discover-ai";

describe("finding school senders from headers only", () => {
  const inbox: Record<string, { from: string; subject: string }> = {
    a: { from: "Remind <no-reply@remind.com>", subject: "Ms. Rivera: Pajama day Wednesday" },
    b: { from: "Remind <no-reply@remind.com>", subject: "Ms. Rivera: Picture day" },
    c: { from: "Frey Elementary <frey@cobbk12.org>", subject: "Early release Friday" },
    d: { from: "Cobb Schools <news@cobbk12.org>", subject: "Thanksgiving break reminder" },
    e: { from: "Amazon <ship-confirm@amazon.com>", subject: "Your order has shipped" },
    f: { from: "Ms Lopez <jlopez.teacher@gmail.com>", subject: "2nd grade field trip permission slip" },
    g: { from: "Chase <alerts@chase.com>", subject: "Your statement is ready" },
    h: { from: "MySchoolBucks <noreply@myschoolbucks.com>", subject: "Low balance alert" },
  };
  const provider = {
    async list() { return Object.keys(inbox); },
    async get(): Promise<never> { throw new Error("bodies must not be read during discovery"); },
    async headers(id: string) { return { id, ...inbox[id], date: "2026-11-20T15:00:00.000Z" }; },
  };

  it("groups senders and picks patterns safely", () => {
    const agg = aggregateSenders(Object.entries(inbox).map(([id, m]) => ({ id, ...m, date: "2026-11-20T15:00:00.000Z" })));
    expect(agg[0]).toMatchObject({ address: "no-reply@remind.com", count: 2 });
    expect(patternFor({ address: "jlopez.teacher@gmail.com", domain: "gmail.com" })).toBe("jlopez.teacher@gmail.com"); // never all of gmail
    expect(patternFor({ address: "frey@cobbk12.org", domain: "cobbk12.org" })).toBe("@cobbk12.org");
    expect(heuristicSuggestion(agg.find((s) => s.domain === "amazon.com")!)).toBeNull();
  });

  it("suggests school apps, the district and the teacher — not shopping or banks — without reading bodies", async () => {
    const r = await discoverSchoolSenders(provider, { kids: [{ first_name: "Everley", school: "Frey Elementary" }], existingPatterns: ["@myschoolbucks.com"] });
    const patterns = r.suggestions.map((s) => s.pattern);
    expect(patterns).toContain("@remind.com");
    expect(patterns).toContain("@cobbk12.org");
    expect(patterns).toContain("jlopez.teacher@gmail.com");
    expect(patterns).not.toContain("@amazon.com");
    expect(patterns).not.toContain("@chase.com");
    expect(patterns).not.toContain("@myschoolbucks.com"); // already watched
    expect(r.suggestions.find((s) => s.pattern === "@cobbk12.org")!.count).toBe(2); // merged
    expect(r.suggestions.find((s) => s.pattern === "@remind.com")!.platform_key).toBe("remind");
    expect(r.scanned).toBe(8);
  });

  it("merges by pattern", () => {
    const base = { name: "", domain: "x.org", subjects: [], last: "", platform_key: null, child_name: null, reason: "", confidence: "medium" as const };
    const m = mergeByPattern([{ ...base, address: "a@x.org", count: 1, pattern: "@x.org" }, { ...base, address: "b@x.org", count: 2, pattern: "@x.org", confidence: "high" }]);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ count: 3, confidence: "high" });
  });
});
