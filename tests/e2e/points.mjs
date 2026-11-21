import { BASE, assert, done, launch, onboard, signUp, step, uid } from "./lib.mjs";

const SHOTS = process.env.SHOTS ?? "/tmp";
const { browser, newPhone } = await launch();
const p = await newPhone();
console.log("Points tracking");

await step("family set up; Home invites tracking", async () => {
  await signUp(p, `pts-${uid()}@e2e.local`);
  await onboard(p, { family: "Points Family", kids: [["Everley", "2nd", "Frey Elementary"], ["Adler", "Pre-K", "Sunbrook"]] });
  await p.getByText("Track how school days go").click();
  await p.waitForURL("**/points/setup");
});

await step("describe both systems in plain words → understood per child", async () => {
  await p.getByLabel("How the schools track behavior").fill(
    "Everley's school tracks stars each day. Normal day is white star, yellow is had to be talked to a few times, red is bad, purple is superb day. Adler's tracks skittles. They leave school with 3 skittles as a treat unless they get in trouble. 3 is best, 0 is really bad.",
  );
  await p.getByRole("button", { name: "Set it up" }).click();
  await p.getByRole("heading", { name: /Everley · Star chart/ }).waitFor({ timeout: 60000 });
  assert(await p.getByRole("heading", { name: /Adler · Skittles/ }).isVisible(), "Adler's system missing");
  await p.getByLabel("Check-in time for Everley").fill("14:30");
  await p.getByLabel("Check-in time for Adler").fill("14:50");
  await p.screenshot({ path: SHOTS + "/points-setup.png", fullPage: true });
  await p.getByRole("button", { name: "Looks right — start tracking" }).click();
  await p.waitForURL("**/points?setup=done");
});

await step("fill in past days by tapping the month grid", async () => {
  const ev = p.locator("section", { has: p.getByRole("heading", { name: "Everley" }) });
  await ev.getByRole("button", { name: /Friday, Nov 20: not logged/ }).click();
  await ev.getByRole("button", { name: "White" }).last().click();
  await ev.getByText("Saved · White · +2 points").waitFor();
  await ev.getByRole("button", { name: /Thursday, Nov 19: not logged/ }).click();
  await ev.getByRole("button", { name: "Purple" }).last().click();
  await ev.getByText(/Saved · Purple/).waitFor();
  assert(await ev.getByRole("button", { name: /Friday, Nov 20: White/ }).isVisible(), "grid didn't update");
  const ad = p.locator("section", { has: p.getByRole("heading", { name: "Adler" }) });
  await ad.getByRole("button", { name: /Friday, Nov 20: not logged/ }).click();
  await ad.getByRole("button", { name: "3", exact: true }).last().click();
  await ad.getByText("Saved · 3 · +3 points").waitFor();
});

await step("add a weekly prize", async () => {
  const ev = p.locator("section", { has: p.getByRole("heading", { name: "Everley" }) });
  await ev.getByText("Add a prize").click();
  await ev.getByLabel("Prize").fill("Pick Friday's movie");
  await ev.getByLabel("Points needed").fill("5");
  await ev.getByRole("button", { name: "Add prize" }).click();
  await ev.getByText("Earned!").waitFor(); // 2 + 3 = 5 this week
  await p.screenshot({ path: SHOTS + "/points-page.png", fullPage: true });
});

await step("Home shows how everyone's doing", async () => {
  await p.goto(BASE + "/");
  await p.getByRole("heading", { name: "How everyone's doing" }).waitFor();
  assert(await p.getByText(/5 points in November/).isVisible(), "Everley points missing");
  assert(await p.getByText("2-day streak").isVisible(), "streak missing");
  assert(await p.getByText("Purple 1").isVisible(), "legend missing");
  await p.screenshot({ path: SHOTS + "/points-home.png", fullPage: true });
});

await step("kid view is big and simple", async () => {
  await p.goto(BASE + "/points/kids");
  await p.getByText("Pick Friday's movie").waitFor();
  assert(await p.getByText("You did it!").isVisible(), "prize state missing");
  await p.screenshot({ path: SHOTS + "/points-kids.png", fullPage: true });
});

await step("no page errors", async () => assert(p.errors.length === 0, p.errors.join(" | ")));
await browser.close();
done();
