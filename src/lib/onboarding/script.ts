/**
 * The onboarding conversation. Pure: the next question is a function of what
 * we already know, so answers that cover several things skip later questions.
 */
import { PLATFORMS } from "@/lib/platforms";
import type { OnboardingState, Question } from "@/lib/onboarding/types";

export const PLATFORM_CHIPS = [
  { label: "Email", value: "email" },
  { label: "Texts", value: "sms" },
  ...["remind", "ctls", "myschoolbucks", "myparentview", "kambu", "connectcareworks", "classdojo", "parentsquare", "seesaw", "brightwheel"].map((k) => ({
    label: PLATFORMS.find((p) => p.key === k)!.name,
    value: k,
  })),
];

const listNames = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

export function nextQuestion(s: OnboardingState): Question {
  if (!s.me) return { id: "me", text: "Hi! I'm School Hub. In about two minutes, I'll set everything up for your family. First, what should I call you?", placeholder: "Your first name" };
  if (!s.kids.length)
    return {
      id: "kids",
      text: `Nice to meet you, ${s.me}! Who are the kids we're keeping track of?`,
      placeholder: "e.g. Everley and Adler",
    };
  const needsSchool = s.kids.find((k) => !k.school && !s.schoolAskedFor.includes(k.first_name));
  if (needsSchool) {
    const first = s.schoolAskedFor.length === 0;
    return {
      id: `school:${needsSchool.first_name}`,
      text: first
        ? `What school does ${needsSchool.first_name} go to, and what grade? Adding the town helps me find it.`
        : `And ${needsSchool.first_name}? School, grade and town.`,
      placeholder: "e.g. Maple Elementary, 2nd grade, Marietta GA",
      chips: [{ label: "Not in school yet", value: "__none__" }],
    };
  }
  if (!s.platformsAsked)
    return {
      id: "platforms",
      text: `How do you hear from ${s.kids.length > 1 ? "their schools" : `${s.kids[0].first_name}'s school`} today? Tap what you use, or just tell me — like "Remind for Adler, CTLS texts and emails for Everley."`,
      chips: PLATFORM_CHIPS,
      multi: true,
      placeholder: "Apps, emails, texts…",
    };
  if (!s.painAsked)
    return {
      id: "pain",
      text: "What gets missed or feels overwhelming right now?",
      chips: [
        { label: "Too many apps", value: "Too many apps to check" },
        { label: "Missing deadlines", value: "Missing deadlines and forms" },
        { label: "Payments", value: "Keeping up with payments" },
        { label: "One of us sees everything", value: "Only one parent sees everything" },
      ],
      multi: true,
      optional: true,
      placeholder: "Anything that slips through the cracks…",
    };
  if (!s.inviteAsked)
    return {
      id: "invite",
      text: "Should anyone else see everything — a partner, co-parent or grandparent? Share their name and email.",
      placeholder: "e.g. Morgan, morgan@email.com",
      chips: [{ label: "Just me for now", value: "__none__" }],
      optional: true,
    };
  if (s.researchConsent === null) {
    const schools = [...new Set(s.kids.map((k) => k.school).filter(Boolean) as string[])];
    return {
      id: "consent",
      text: schools.length
        ? `Here's the magic part: may I look up ${listNames(schools)} online to find their official calendars and how they communicate? I'll only search public school websites — no logins, and nothing about your kids is shared.`
        : "I have what I need. Ready to see your setup?",
      chips: schools.length ? [{ label: "Yes, look them up", value: "yes" }, { label: "Skip", value: "no" }] : [{ label: "Show me", value: "no" }],
    };
  }
  return { id: "done", text: "" };
}

export function progress(s: OnboardingState): { step: number; total: number } {
  const total = 5 + Math.max(0, s.kids.length - 1);
  const step = [s.me, s.kids.length, s.platformsAsked, s.painAsked, s.inviteAsked].filter(Boolean).length + s.schoolAskedFor.length;
  return { step: Math.min(step, total), total };
}
