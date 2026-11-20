import { BASE, assert, done, launch, signUp, step, uid } from "./lib.mjs";

const SHOTS = process.env.SHOTS ?? "/tmp";
const { browser, newPhone } = await launch();
const p = await newPhone();
const morganEmail = `morgan-${uid()}@e2e.local`;
let inviteLink;

async function say(text) {
  await p.getByLabel("Your answer").fill(text);
  await p.getByRole("button", { name: "Send" }).click();
}
async function waitBot(re) {
  await p.getByText(re).last().waitFor({ timeout: 30000 });
  await p.waitForTimeout(300);
}

console.log("Conversational onboarding");

await step("sign up lands in a conversation, not a form", async () => {
  await signUp(p, `tyler-${uid()}@e2e.local`);
  await p.waitForURL("**/onboarding");
  await waitBot(/what should I call you/);
});

await step("answers flow naturally and skip what's already known", async () => {
  await say("I'm Tyler");
  await waitBot(/Nice to meet you, Tyler/);
  await say("Everley and Adler");
  await waitBot(/What school does Everley go to/);
  await say("Maple Elementary, 2nd grade, Marietta GA");
  await waitBot(/And Adler\?/);
  await say("Little Oaks Preschool, pre-k, Kennesaw");
  await waitBot(/How do you hear from/);
  await p.getByRole("button", { name: "Remind", exact: true }).click();
  await p.getByLabel("Your answer").fill("CTLS texts and emails for Everley");
  await p.getByRole("button", { name: "Send" }).click();
  await waitBot(/gets missed/);
  await p.getByRole("button", { name: "Too many apps" }).click();
  await p.getByRole("button", { name: "Send" }).click();
  await waitBot(/anyone else see everything/);
  await say(`Morgan, ${morganEmail}`);
  await waitBot(/magic part/);
  const consent = await p.getByText(/magic part/).last().textContent();
  assert(consent.includes("Maple Elementary") && consent.includes("Little Oaks Preschool"), "consent should name both schools");
  await p.screenshot({ path: SHOTS + "/chat-1.png", fullPage: true });
});

await step("with permission, schools are looked up and a summary is shown", async () => {
  await p.getByRole("button", { name: "Yes, look them up" }).click();
  await p.getByRole("heading", { name: "Here's your School Hub" }).waitFor({ timeout: 60000 });
  assert(await p.getByText("[Test] Maple Elementary").first().isVisible(), "school research missing");
  assert(await p.getByText(/3 dates/).first().isVisible(), "calendar dates missing");
  assert(await p.getByText(/Invite Morgan/).isVisible(), "invite missing");
  await p.screenshot({ path: SHOTS + "/chat-summary.png", fullPage: true });
});

await step("approve → live within seconds, with an invite link", async () => {
  const t0 = Date.now();
  await p.getByRole("button", { name: /Looks good — set it up/ }).click();
  await p.getByRole("heading", { name: "You're live!" }).waitFor({ timeout: 60000 });
  console.log(`     (setup took ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  inviteLink = await p.getByLabel("Invitation link").inputValue();
  await p.getByRole("heading", { name: "Make it automatic" }).waitFor();
  assert(await p.getByRole("button", { name: "Link my phone" }).isVisible(), "one-tap texting missing");
  assert(inviteLink.includes("/invite/"), "no invite link");
  await p.screenshot({ path: SHOTS + "/chat-live.png", fullPage: true });
  await p.getByRole("button", { name: "Open School Hub" }).click();
  await p.waitForURL((u) => u.pathname === "/");
});

await step("the app is already loaded: kids, school dates, platforms", async () => {
  assert(await p.getByRole("radio", { name: /Everley/ }).isVisible(), "kids missing");
  await p.goto(BASE + "/calendar");
  await p.getByText("[Test] Teacher workday – no school").first().waitFor();
  await p.goto(BASE + "/connections");
  await p.getByText("Your school apps").waitFor();
  assert(await p.getByText(/^Remind/).first().isVisible(), "Remind missing from school apps");
  await p.getByText("Advanced settings").click();
  assert(await p.getByText("@example.org", { exact: true }).isVisible(), "school email domain rule missing");
  assert(await p.getByText("@remind.com", { exact: true }).isVisible(), "Remind sender rule missing");
  await p.screenshot({ path: SHOTS + "/chat-home.png", fullPage: true });
});

await step("Quick question keeps learning (which kids use Remind?)", async () => {
  await p.goto(BASE + "/");
  await p.screenshot({ path: SHOTS + "/chat-home-before-q.png", fullPage: true });
  await p.getByRole("region", { name: "Quick question" }).waitFor();
  const text = await p.getByRole("region", { name: "Quick question" }).textContent();
  assert(/Which of your kids|What school/.test(text), "unexpected question: " + text);
  if (/Which of your kids get messages through Remind/.test(text)) {
    await p.getByRole("region", { name: "Quick question" }).getByRole("button", { name: "Adler" }).click();
    await p.getByRole("button", { name: "Save" }).click();
    await p.getByText(/match messages to the right kid/).waitFor();
  }
  await p.screenshot({ path: SHOTS + "/chat-quickq.png", fullPage: true });
});

await step("Morgan joins from the invite link", async () => {
  const m = await newPhone();
  await m.goto(inviteLink);
  await m.getByRole("link", { name: "Create account" }).click();
  await m.getByLabel("Email").fill(morganEmail);
  await m.getByLabel("Password").fill("Testpassword123");
  await m.getByRole("button", { name: "Create account" }).click();
  await m.getByLabel("Your first name").fill("Morgan");
  await m.getByRole("button", { name: "Join family" }).click();
  await m.waitForURL((u) => u.pathname === "/");
  assert(await m.getByRole("radio", { name: /Adler/ }).isVisible(), "Morgan doesn't see the family");
});

await step("no page errors", async () => assert(p.errors.length === 0, p.errors.join(" | ")));
await browser.close();
done();
