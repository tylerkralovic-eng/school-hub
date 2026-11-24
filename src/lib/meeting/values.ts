/**
 * Value of the week: a small, kid-sized idea the family practices together.
 * Written for ages ~4–10: one simple meaning, one question, one thing to try.
 */
export interface Value {
  key: string;
  name: string;
  /** What it means, said to a kid. */
  kid: string;
  /** A question to talk about at the meeting. */
  ask: string;
  /** The family challenge for the week. */
  try: string;
}

export const VALUES: Value[] = [
  { key: "kindness", name: "Kindness", kid: "Doing something nice for someone, even when nobody asks.", ask: "Who was kind to you this week? How did it feel?", try: "Do one secret kind thing for someone in the family." },
  { key: "gratitude", name: "Gratitude", kid: "Noticing the good things and saying thank you.", ask: "What is one thing you're thankful for today?", try: "At dinner, everyone shares one thank-you." },
  { key: "honesty", name: "Honesty", kid: "Telling the truth, even when it's hard.", ask: "Why is it brave to tell the truth?", try: "If you make a mistake, say so — we'll fix it together." },
  { key: "responsibility", name: "Responsibility", kid: "Doing your jobs without being reminded.", ask: "What's one job you can do all by yourself?", try: "Pick one job this week and do it every day." },
  { key: "patience", name: "Patience", kid: "Waiting calmly, even when you really want something.", ask: "When is it hardest for you to wait?", try: "When you feel impatient, take three slow breaths." },
  { key: "courage", name: "Courage", kid: "Trying something even when you feel a little scared.", ask: "What's something new you want to try?", try: "Everyone tries one new thing this week." },
  { key: "respect", name: "Respect", kid: "Treating people and things the way they deserve.", ask: "How can we show respect at school?", try: "Use please, thank you and kind words all week." },
  { key: "perseverance", name: "Never giving up", kid: "Keep trying, even when something is hard.", ask: "What's something that used to be hard but is easy now?", try: "When something is hard, say: \"I can't do it YET.\"" },
  { key: "teamwork", name: "Teamwork", kid: "Working together makes big jobs easier.", ask: "What can our family do better as a team?", try: "Do one family clean-up together — set a timer!" },
  { key: "empathy", name: "Caring how others feel", kid: "Imagining how someone else feels.", ask: "How can you tell when a friend is sad?", try: "When someone looks sad, ask: \"Are you okay?\"" },
  { key: "generosity", name: "Sharing", kid: "Giving some of what you have to others.", ask: "What's something you could share?", try: "Share a toy, a snack or your time with someone." },
  { key: "self-control", name: "Self-control", kid: "Being the boss of your body and your words.", ask: "What helps you calm down when you're upset?", try: "Use your calm-down trick once this week and tell us about it." },
  { key: "listening", name: "Listening", kid: "Using your eyes, ears and body to really hear someone.", ask: "How do you know someone is really listening to you?", try: "Look at people when they talk to you." },
  { key: "forgiveness", name: "Forgiveness", kid: "Letting go of being mad after someone says sorry.", ask: "Why is it good to forgive?", try: "Say \"I forgive you\" when someone apologizes." },
  { key: "curiosity", name: "Curiosity", kid: "Asking questions and wanting to learn more.", ask: "What's something you wonder about?", try: "Bring one big question to dinner each night." },
  { key: "helpfulness", name: "Helping out", kid: "Seeing what needs doing and jumping in.", ask: "How can you help at home without being asked?", try: "Help with one thing every day before anyone asks." },
  { key: "friendship", name: "Being a good friend", kid: "Including others and being someone people can trust.", ask: "What makes someone a good friend?", try: "Invite someone new to play at recess." },
  { key: "positivity", name: "A good attitude", kid: "Looking for the bright side, even on hard days.", ask: "What's one good thing that happened on a hard day?", try: "Each night, share one good thing about your day." },
  { key: "tidiness", name: "Taking care of our things", kid: "Putting things back where they belong.", ask: "How do you feel when your room is clean?", try: "Five-minute tidy before bed every night." },
  { key: "fairness", name: "Fairness", kid: "Taking turns and following the rules for everyone.", ask: "What does playing fair look like?", try: "Take turns choosing the game or the show this week." },
  { key: "trying-your-best", name: "Doing your best", kid: "Putting in your full effort — that matters more than winning.", ask: "When did you try your very best this week?", try: "Tell us about one thing you gave your best effort." },
  { key: "manners", name: "Good manners", kid: "Little words like please, thank you and excuse me.", ask: "Which manners do you use the most?", try: "Catch each other using good manners — give a high five!" },
  { key: "bravery-to-speak", name: "Using your voice", kid: "Speaking up kindly for yourself and others.", ask: "When is it important to speak up?", try: "Raise your hand and share an idea in class." },
  { key: "joy", name: "Joy", kid: "Noticing what makes you happy and sharing it.", ask: "What made you laugh this week?", try: "Plan one silly family moment — dance party, joke night or pillow fort." },
];

const byKey = new Map(VALUES.map((v) => [v.key, v]));
export const valueByKey = (key: string | null | undefined) => (key ? byKey.get(key) : undefined);

/** Deterministic default for a meeting: rotates weekly, skipping values used recently. */
export function pickValue(meetingDate: string, recentlyUsed: string[] = []): Value {
  const weeks = Math.floor(Date.parse(`${meetingDate}T00:00:00Z`) / (7 * 86400_000));
  for (let i = 0; i < VALUES.length; i++) {
    const v = VALUES[(weeks + i) % VALUES.length];
    if (!recentlyUsed.includes(v.key)) return v;
  }
  return VALUES[weeks % VALUES.length];
}

/** Next value in the list after `key` (for "pick another"). */
export function nextValue(key: string): Value {
  const i = VALUES.findIndex((v) => v.key === key);
  return VALUES[(i + 1) % VALUES.length];
}
