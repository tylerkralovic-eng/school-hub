/**
 * Fictional demo data. NOT real people, schools or messages.
 *
 * Dates are expressed relative to "now" so the demo always looks current.
 * Every item carries a source reference and received time, matching the
 * production rule that every update must show where it came from.
 */
import type {
  Child,
  Family,
  FamilyMember,
  FamilySnapshot,
  School,
  SchoolItem,
  Source,
} from "@/lib/types";

const FAMILY_ID = "fam_demo";

/**
 * Local date `schoolDays` weekdays after today at hh:mm, as an ISO string.
 * Counting school days (not calendar days) keeps school events off weekends
 * whatever day the demo is opened.
 */
function at(now: Date, schoolDays: number, time = "09:00"): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(now);
  let remaining = schoolDays;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) remaining--;
  }
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Calendar-day offset (used where the weekday itself matters). */
function onDay(now: Date, dayOffset: number, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** A moment `hours` before now (for received / synced timestamps). */
function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

/**
 * Day offset to the next given weekday (0=Sun..6=Sat), at least `min` days out.
 * Keeps weekday-specific items (e.g. "Friday reading log") on the right day.
 */
function nextWeekday(now: Date, weekday: number, min = 1): number {
  const diff = (weekday - now.getDay() + 7) % 7;
  return diff < min ? diff + 7 : diff;
}

export function buildDemoSnapshot(now: Date): FamilySnapshot {
  const family: Family = {
    id: FAMILY_ID,
    name: "Demo Family",
    timezone: "America/Chicago",
  };

  const members: FamilyMember[] = [
    { id: "mem_1", familyId: FAMILY_ID, displayName: "Morgan", role: "parent" },
  ];

  const schools: School[] = [
    {
      id: "sch_willow",
      name: "Willow Creek Elementary",
      shortName: "Willow Creek",
      timezone: "America/Chicago",
    },
    {
      id: "sch_ridge",
      name: "Ridgeview Middle School",
      shortName: "Ridgeview",
      timezone: "America/Chicago",
    },
  ];

  const children: Child[] = [
    {
      id: "kid_maya",
      familyId: FAMILY_ID,
      firstName: "Maya",
      grade: "4th grade",
      schoolId: "sch_willow",
      color: "violet",
    },
    {
      id: "kid_leo",
      familyId: FAMILY_ID,
      firstName: "Leo",
      grade: "7th grade",
      schoolId: "sch_ridge",
      color: "teal",
    },
  ];

  const sources: Source[] = [
    {
      id: "src_willow_email",
      familyId: FAMILY_ID,
      schoolId: "sch_willow",
      name: "Willow Creek school email",
      kind: "school_email",
      status: "connected",
      lastSyncedAt: hoursAgo(now, 0.5),
    },
    {
      id: "src_willow_teacher",
      familyId: FAMILY_ID,
      schoolId: "sch_willow",
      name: "Ms. Alvarez · classroom email",
      kind: "teacher_email",
      status: "connected",
      lastSyncedAt: hoursAgo(now, 0.5),
    },
    {
      id: "src_willow_cal",
      familyId: FAMILY_ID,
      schoolId: "sch_willow",
      name: "Willow Creek calendar (ICS)",
      kind: "calendar_feed",
      status: "connected",
      lastSyncedAt: hoursAgo(now, 3),
    },
    {
      id: "src_willow_app",
      familyId: FAMILY_ID,
      schoolId: "sch_willow",
      name: "Classroom messaging app",
      kind: "school_app",
      status: "not_connected",
      lastSyncedAt: null,
      note: "App-only messages can't be read yet. Share screenshots to include them.",
    },
    {
      id: "src_ridge_email",
      familyId: FAMILY_ID,
      schoolId: "sch_ridge",
      name: "Ridgeview school email",
      kind: "school_email",
      status: "connected",
      lastSyncedAt: hoursAgo(now, 1),
    },
    {
      id: "src_ridge_athletics",
      familyId: FAMILY_ID,
      schoolId: "sch_ridge",
      name: "Ridgeview athletics calendar (ICS)",
      kind: "calendar_feed",
      status: "stale",
      lastSyncedAt: hoursAgo(now, 4 * 24 + 2),
      note: "Last successful check was 4 days ago. Game times may have changed.",
    },
    {
      id: "src_ridge_portal",
      familyId: FAMILY_ID,
      schoolId: "sch_ridge",
      name: "Student learning portal",
      kind: "school_app",
      status: "not_connected",
      lastSyncedAt: null,
      note: "Assignments posted only in the portal are not visible here.",
    },
    {
      id: "src_manual",
      familyId: FAMILY_ID,
      schoolId: null,
      name: "Shared by you",
      kind: "manual_share",
      status: "connected",
      lastSyncedAt: hoursAgo(now, 20),
    },
  ];

  const fri = nextWeekday(now, 5);

  const items: SchoolItem[] = [
    {
      id: "itm_fieldtrip",
      familyId: FAMILY_ID,
      kind: "task",
      title: "Sign field trip permission slip + $12",
      summary:
        "Nature Center trip. Return the signed slip and $12 in an envelope labeled with Maya's name.",
      schoolId: "sch_willow",
      childId: "kid_maya",
      dueAt: at(now, 2, "08:00"),
      eventAt: null,
      priority: "high",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_willow_teacher",
          receivedAt: hoursAgo(now, 5),
          from: "Ms. Alvarez (4th grade)",
          excerpt:
            "Our trip to the Oak Hollow Nature Center is coming up! Please return the signed permission slip and $12 (cash or check) in a labeled envelope by Thursday morning.",
        },
      ],
    },
    {
      id: "itm_readinglog",
      familyId: FAMILY_ID,
      kind: "task",
      title: "Initial weekly reading log",
      summary: "20 minutes a night. Parent initials each day, due Friday.",
      schoolId: "sch_willow",
      childId: "kid_maya",
      dueAt: onDay(now, fri, "08:00"),
      eventAt: null,
      priority: "normal",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_willow_teacher",
          receivedAt: hoursAgo(now, 3 * 24),
          from: "Ms. Alvarez (4th grade)",
          excerpt:
            "Reminder: reading logs come home Monday and are due back Friday with a parent's initials for each night.",
        },
      ],
    },
    {
      id: "itm_bookfair",
      familyId: FAMILY_ID,
      kind: "event",
      title: "Fall Book Fair",
      summary: "Open to families before and after school. Students shop during library time.",
      schoolId: "sch_willow",
      childId: null,
      dueAt: null,
      eventAt: at(now, 3, "07:45"),
      eventEndAt: at(now, 5, "16:00"),
      allDay: true,
      location: "Willow Creek library",
      priority: "normal",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_willow_cal",
          receivedAt: hoursAgo(now, 3),
          excerpt: "BOOK FAIR — Library — all day",
        },
        {
          sourceId: "src_willow_email",
          receivedAt: hoursAgo(now, 26),
          from: "Willow Creek PTA",
          excerpt:
            "The Fall Book Fair is back! Families are welcome before and after school all three days.",
        },
      ],
    },
    {
      id: "itm_retakes",
      familyId: FAMILY_ID,
      kind: "event",
      title: "Picture retake day",
      summary: "Only for students who missed picture day or want a retake. Bring the original packet.",
      schoolId: "sch_willow",
      childId: null,
      dueAt: null,
      eventAt: at(now, 6, "08:30"),
      location: "Willow Creek gym",
      priority: "normal",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_willow_cal",
          receivedAt: hoursAgo(now, 3),
          excerpt: "Picture Retakes — Gym — 8:30 AM",
        },
      ],
    },
    {
      id: "itm_earlydismissal",
      familyId: FAMILY_ID,
      kind: "announcement",
      title: "Early dismissal at 1:15 PM",
      summary:
        "Staff professional development. Aftercare runs normal hours; buses leave at 1:25 PM.",
      schoolId: "sch_willow",
      childId: null,
      dueAt: null,
      eventAt: at(now, 8, "13:15"),
      priority: "high",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_willow_email",
          receivedAt: hoursAgo(now, 9),
          from: "Willow Creek Front Office",
          excerpt:
            "Please note students will be dismissed at 1:15 PM for staff development. Aftercare will be available until 6:00 PM.",
        },
      ],
    },
    {
      id: "itm_fundraiser",
      familyId: FAMILY_ID,
      kind: "announcement",
      title: "Fall fundraiser raised $8,400",
      summary: "Thank-you note from the PTA. Funds go to new library books and recess equipment.",
      schoolId: "sch_willow",
      childId: null,
      dueAt: null,
      eventAt: null,
      priority: "normal",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_willow_email",
          receivedAt: hoursAgo(now, 4 * 24),
          from: "Willow Creek PTA",
          excerpt: "THANK YOU, Willow Creek families! Together we raised $8,400 …",
        },
      ],
    },
    {
      id: "itm_sciencefair",
      familyId: FAMILY_ID,
      kind: "task",
      title: "Science fair proposal due",
      summary:
        "One-page proposal with question, hypothesis and materials. Parent signature required on page 2.",
      schoolId: "sch_ridge",
      childId: "kid_leo",
      dueAt: at(now, 4, "23:59"),
      eventAt: null,
      priority: "high",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_ridge_email",
          receivedAt: hoursAgo(now, 2),
          from: "Mr. Okafor (7th grade science)",
          excerpt:
            "Science fair proposals are due by 11:59 PM. Students must upload the signed proposal; a parent signature is required on page 2.",
        },
      ],
    },
    {
      id: "itm_conferences",
      familyId: FAMILY_ID,
      kind: "task",
      title: "Book a parent–teacher conference slot",
      summary: "15-minute slots fill quickly. Sign-up link is in the original email.",
      schoolId: "sch_ridge",
      childId: null,
      dueAt: at(now, 5, "17:00"),
      eventAt: null,
      priority: "normal",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_ridge_email",
          receivedAt: hoursAgo(now, 30),
          from: "Ridgeview Counseling Office",
          excerpt:
            "Conference sign-ups are now open and close at 5:00 PM next week. Use the link below to choose a time.",
        },
      ],
    },
    {
      id: "itm_basketball",
      familyId: FAMILY_ID,
      kind: "event",
      title: "Away basketball game vs. Lakeside",
      summary: "Bus leaves Ridgeview at 4:15 PM. Pickup at Lakeside after the game.",
      schoolId: "sch_ridge",
      childId: "kid_leo",
      dueAt: null,
      eventAt: at(now, 2, "17:30"),
      location: "Lakeside Middle School gym",
      priority: "normal",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_ridge_athletics",
          receivedAt: hoursAgo(now, 4 * 24 + 2),
          excerpt: "7B Boys Basketball @ Lakeside — 5:30 PM",
        },
      ],
    },
    {
      id: "itm_spiritweek",
      familyId: FAMILY_ID,
      kind: "announcement",
      title: "Spirit Week themes announced",
      summary: "Mon: Pajama Day · Tue: Twin Day · Wed: Decades Day · Thu: Jersey Day · Fri: Blue & Gold.",
      schoolId: "sch_ridge",
      childId: null,
      dueAt: null,
      eventAt: onDay(now, nextWeekday(now, 1, 7), "08:00"),
      priority: "normal",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_ridge_email",
          receivedAt: hoursAgo(now, 14),
          from: "Ridgeview Student Council",
          excerpt:
            "Get ready for Spirit Week! Monday is Pajama Day, Tuesday is Twin Day, Wednesday is Decades Day …",
        },
      ],
    },
    {
      id: "itm_bandconcert",
      familyId: FAMILY_ID,
      kind: "event",
      title: "Winter band concert",
      summary: "Students arrive by 6:30 PM in concert black. Family seating opens at 6:45 PM.",
      schoolId: "sch_ridge",
      childId: "kid_leo",
      dueAt: null,
      eventAt: at(now, 13, "19:00"),
      location: "Ridgeview auditorium",
      priority: "normal",
      reviewStatus: "published",
      sources: [
        {
          sourceId: "src_ridge_email",
          receivedAt: hoursAgo(now, 2 * 24),
          from: "Ms. Chen (Band)",
          excerpt:
            "Our Winter Concert is at 7:00 PM in the auditorium. Students should arrive by 6:30 PM wearing concert black.",
        },
      ],
    },
    {
      id: "itm_mathquiz",
      familyId: FAMILY_ID,
      kind: "announcement",
      title: "Math quiz may have moved",
      summary: "A screenshot mentions the unit 3 quiz moving to \"Thursday\", but no date is given.",
      schoolId: "sch_ridge",
      childId: "kid_leo",
      dueAt: null,
      eventAt: null,
      priority: "normal",
      reviewStatus: "needs_review",
      reviewNote: "Date unclear. Check the learning portal or ask Leo before relying on it.",
      sources: [
        {
          sourceId: "src_manual",
          receivedAt: hoursAgo(now, 20),
          from: "Screenshot you shared",
          excerpt: "“unit 3 quiz pushed to thursday!!” (group chat screenshot)",
        },
      ],
    },
  ];

  return { family, members, children, schools, sources, items, isDemo: true };
}
