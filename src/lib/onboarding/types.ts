/** Shared shapes for the conversational onboarding (client + server). */
export interface KidDraft {
  first_name: string;
  grade: string | null;
  school: string | null; // as the parent said it
  town: string | null;
}

export interface PlatformDraft {
  key: string; // catalog key
  child_names: string[]; // empty = not said
  channels: string[]; // email | sms | push | app
}

export interface InviteDraft {
  name: string | null;
  email: string;
}

export interface OnboardingState {
  me: string | null;
  kids: KidDraft[];
  kidsAsked: boolean;
  schoolAskedFor: string[]; // kid names already asked about
  platforms: PlatformDraft[];
  channelsMentioned: string[]; // generic: email, sms (school texts), etc.
  platformsAsked: boolean;
  painPoints: string | null;
  painAsked: boolean;
  invite: InviteDraft | null;
  inviteAsked: boolean;
  researchConsent: boolean | null;
}

export const emptyState = (): OnboardingState => ({
  me: null,
  kids: [],
  kidsAsked: false,
  schoolAskedFor: [],
  platforms: [],
  channelsMentioned: [],
  platformsAsked: false,
  painPoints: null,
  painAsked: false,
  invite: null,
  inviteAsked: false,
  researchConsent: null,
});

export type StepId = "me" | "kids" | `school:${string}` | "platforms" | "pain" | "invite" | "consent" | "done";

export interface Question {
  id: StepId;
  text: string;
  placeholder?: string;
  chips?: { label: string; value: string }[];
  multi?: boolean; // chips can be combined
  optional?: boolean;
}

/** Research result for one school (from public websites). */
export interface SchoolResearch {
  query: string; // what the parent said
  found: boolean;
  official_name: string | null;
  town: string | null;
  district: string | null;
  website: string | null;
  calendar_url: string | null;
  email_domains: string[];
  platforms: string[]; // catalog keys the school appears to use
  events: { title: string; date: string; end_date: string | null; category: "closure" | "early_dismissal" | "activity" | "general"; evidence: string }[];
  note: string | null;
  error?: string | null;
}
