/**
 * Catalog of school platforms families report using. Capabilities are what
 * families told us, NOT verified integrations. School Hub has no direct
 * connection to any of these platforms in V1; information arrives indirectly
 * through the channels the platform notifies on (email → Gmail, SMS → forwarding,
 * push/app-only → screenshots).
 */
export interface PlatformInfo {
  key: string;
  name: string;
  purpose: string;
  /** Channels the platform commonly notifies on (family-reported). */
  typicalChannels: ("email" | "sms" | "push" | "app")[];
  /** Sender address patterns to suggest for Gmail rules; unverified suggestions. */
  suggestedSenders: string[];
  /** What a direct integration would need (for the roadmap). */
  directIntegrationNote: string;
}

export const PLATFORMS: PlatformInfo[] = [
  {
    key: "myschoolbucks",
    name: "MySchoolBucks",
    purpose: "Lunch payments and balances",
    typicalChannels: ["email", "sms"],
    suggestedSenders: ["@myschoolbucks.com"],
    directIntegrationNote: "No public parent API known. Low-balance emails can be read via Gmail.",
  },
  {
    key: "myparentview",
    name: "MyParentView",
    purpose: "Permission forms, grades, attendance, pickup barcode",
    typicalChannels: ["app", "email"],
    suggestedSenders: [],
    directIntegrationNote: "Portal login only. Grades/attendance are out of scope for V1; share screenshots of forms.",
  },
  {
    key: "ctls",
    name: "CTLS",
    purpose: "School, county and teacher announcements",
    typicalChannels: ["email", "sms", "push"],
    suggestedSenders: [],
    directIntegrationNote: "Turn on CTLS email notifications so Gmail can pick them up. Add the sender address you see in your inbox.",
  },
  {
    key: "remind",
    name: "Remind",
    purpose: "Teacher messages and reminders",
    typicalChannels: ["email", "sms", "app"],
    suggestedSenders: ["@remind.com"],
    directIntegrationNote: "Enable Remind email notifications so messages reach Gmail.",
  },
  {
    key: "connectcareworks",
    name: "ConnectCareWorks",
    purpose: "Preschool tuition, lunch payments, student info",
    typicalChannels: ["email", "app"],
    suggestedSenders: [],
    directIntegrationNote: "No known public API. Invoices/receipts by email can be read via Gmail.",
  },
  {
    key: "kambu",
    name: "Kambu",
    purpose: "Preschool announcements and pictures",
    typicalChannels: ["sms", "push", "app"],
    suggestedSenders: [],
    directIntegrationNote: "No email notifications. Share screenshots of important announcements.",
  },
  {
    key: "classdojo",
    name: "ClassDojo",
    purpose: "Classroom messages, photos and behavior points",
    typicalChannels: ["app", "push", "email"],
    suggestedSenders: [],
    directIntegrationNote: "No parent API. Turn on email notifications if available, or share screenshots.",
  },
  {
    key: "parentsquare",
    name: "ParentSquare",
    purpose: "School and district messages, forms and sign-ups",
    typicalChannels: ["email", "sms", "push"],
    suggestedSenders: [],
    directIntegrationNote: "Choose email delivery in ParentSquare so Gmail can pick messages up.",
  },
  {
    key: "seesaw",
    name: "Seesaw",
    purpose: "Class journal, announcements and messages",
    typicalChannels: ["app", "push", "email"],
    suggestedSenders: [],
    directIntegrationNote: "Announcements may arrive by email; otherwise share screenshots.",
  },
  {
    key: "brightwheel",
    name: "Brightwheel",
    purpose: "Childcare check-in, messages, photos and billing",
    typicalChannels: ["app", "push", "email"],
    suggestedSenders: [],
    directIntegrationNote: "Billing and some messages arrive by email; share screenshots of important posts.",
  },
  {
    key: "google_classroom",
    name: "Google Classroom",
    purpose: "Assignments and class announcements",
    typicalChannels: ["email", "app"],
    suggestedSenders: [],
    directIntegrationNote: "Guardian email summaries can be read via Gmail.",
  },
  {
    key: "powerschool",
    name: "PowerSchool",
    purpose: "Grades, attendance and school notices",
    typicalChannels: ["email", "app"],
    suggestedSenders: [],
    directIntegrationNote: "Grades and attendance are out of scope for V1; school notices by email can be read via Gmail.",
  },
  {
    key: "infinite_campus",
    name: "Infinite Campus",
    purpose: "Grades, attendance and school notices",
    typicalChannels: ["email", "app"],
    suggestedSenders: [],
    directIntegrationNote: "Grades and attendance are out of scope for V1; school notices by email can be read via Gmail.",
  },
];

/** Words people use for each platform (for understanding free-text answers). */
export const PLATFORM_ALIASES: Record<string, string[]> = {
  myschoolbucks: ["myschoolbucks", "my school bucks", "school bucks", "lunch money"],
  myparentview: ["myparentview", "my parent view", "parentview", "parent view"],
  ctls: ["ctls", "cobb teaching", "ctls parent"],
  remind: ["remind", "remind app", "remind.com"],
  connectcareworks: ["connectcareworks", "connect care works", "careworks"],
  kambu: ["kambu"],
  classdojo: ["classdojo", "class dojo", "dojo"],
  parentsquare: ["parentsquare", "parent square"],
  seesaw: ["seesaw", "see saw"],
  brightwheel: ["brightwheel", "bright wheel"],
  google_classroom: ["google classroom", "classroom"],
  powerschool: ["powerschool", "power school"],
  infinite_campus: ["infinite campus", "campus parent"],
};

export function platformName(key: string): string {
  return PLATFORMS.find((p) => p.key === key)?.name ?? key;
}
