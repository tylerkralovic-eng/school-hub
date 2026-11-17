import { describe, expect, it } from "vitest";
import { parseInvite, parseKids, parseMe, parsePlatforms, parseSchool } from "@/lib/onboarding/parse";
import { nextQuestion } from "@/lib/onboarding/script";
import { emptyState } from "@/lib/onboarding/types";

describe("built-in answer understanding", () => {
  it("names", () => {
    expect(parseMe("hi, I'm tyler")).toBe("Tyler");
    expect(parseMe("Morgan")).toBe("Morgan");
  });
  it("kids", () => {
    expect(parseKids("Everley and Adler").map((k) => k.first_name)).toEqual(["Everley", "Adler"]);
    expect(parseKids("my kids are everley, adler & june").map((k) => k.first_name)).toEqual(["Everley", "Adler", "June"]);
  });
  it("schools", () => {
    expect(parseSchool("Maple Elementary, 2nd grade, Marietta GA")).toEqual({ school: "Maple Elementary", grade: "2nd grade", town: "Marietta GA" });
    expect(parseSchool("She goes to Little Oaks Preschool in Kennesaw, pre-k")).toMatchObject({ school: "Little Oaks Preschool", grade: "Pre-K", town: "Kennesaw" });
    expect(parseSchool("__none__").school).toBeNull();
  });
  it("platforms with kids and channels", () => {
    const r = parsePlatforms("Remind for Adler, CTLS texts and emails for Everley, Kambu for photos", ["Everley", "Adler"]);
    const remind = r.platforms.find((p) => p.key === "remind")!;
    expect(remind.child_names).toEqual(["Adler"]);
    const ctls = r.platforms.find((p) => p.key === "ctls")!;
    expect(ctls.child_names).toEqual(["Everley"]);
    expect(ctls.channels.sort()).toEqual(["email", "sms"]);
    expect(r.platforms.map((p) => p.key)).toContain("kambu");
    expect(r.channels).toEqual(["email", "sms"]);
  });
  it("invite", () => {
    expect(parseInvite("Morgan, Morgan.K@Email.com")).toEqual({ name: "Morgan", email: "morgan.k@email.com" });
    expect(parseInvite("__none__")).toBeNull();
  });
});

describe("conversation flow", () => {
  it("asks only what it doesn't know", () => {
    const s = emptyState();
    expect(nextQuestion(s).id).toBe("me");
    s.me = "Tyler";
    expect(nextQuestion(s).id).toBe("kids");
    s.kids = [{ first_name: "Everley", grade: "2nd grade", school: "Maple", town: null }, { first_name: "Adler", grade: null, school: null, town: null }];
    s.kidsAsked = true;
    expect(nextQuestion(s).id).toBe("school:Adler"); // Everley's school already known
    s.schoolAskedFor.push("Adler");
    expect(nextQuestion(s).id).toBe("platforms");
    s.platformsAsked = true; s.painAsked = true; s.inviteAsked = true;
    const consent = nextQuestion(s);
    expect(consent.id).toBe("consent");
    expect(consent.text).toContain("Maple");
    expect(consent.text).not.toContain("Everley"); // research never includes kids' names
    s.researchConsent = true;
    expect(nextQuestion(s).id).toBe("done");
  });
});
