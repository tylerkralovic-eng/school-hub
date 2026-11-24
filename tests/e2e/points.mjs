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
  // No points were given → balanced family rubric, explained, like-for-like across kids
  await p.getByText("I balanced the points").waitFor();
  const v = async (l) => p.getByLabel(l).inputValue();
  assert([await v("Points for Purple"), await v("Points for White"), await v("Points for Yellow"), await v("Points for Red")].join() === "3,1,0,-2", "star rubric wrong");
  assert([await v("Points for 3 Skittles"), await v("Points for 2 Skittles"), await v("Points for 1 Skittles"), await v("Points for 0 Skittles")].join() === "1,1,0,-2", "Skittles rubric wrong");
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
  await ev.getByText("Saved · White · +1 points").waitFor();
  await ev.getByRole("button", { name: /Thursday, Nov 19: not logged/ }).click();
  await ev.getByRole("button", { name: "Purple" }).last().click();
  await ev.getByText(/Saved · Purple/).waitFor();
  assert(await ev.getByRole("button", { name: /Friday, Nov 20: White/ }).isVisible(), "grid didn't update");
  const ad = p.locator("section", { has: p.getByRole("heading", { name: "Adler" }) });
  await ad.getByRole("button", { name: /Friday, Nov 20: not logged/ }).click();
  await ad.getByRole("button", { name: "3", exact: true }).last().click();
  await ad.getByText("Saved · 3 · +1 points").waitFor();
});

await step("add a weekly prize", async () => {
  const ev = p.locator("section", { has: p.getByRole("heading", { name: "Everley" }) });
  // (dates in this suite are fixed to the week of Nov 23, 2026)
  await ev.getByRole("button", { name: /Monday, Nov 23: not logged/ }).click();
  await ev.getByRole("button", { name: "Purple" }).last().click();
  await ev.getByText(/Saved · Purple/).last().waitFor();
  await ev.getByText("Add a prize").click();
  await ev.getByLabel("Prize").fill("Pick Friday's movie");
  await ev.getByLabel("Points needed").fill("4");
  await ev.getByRole("button", { name: "Add prize" }).click();
  await p.getByText("This week: Pick Friday's movie").waitFor();
  await p.getByText("3/4").first().waitFor(); // purple Monday = 3 this week
  await p.screenshot({ path: SHOTS + "/points-page.png", fullPage: true });
});

await step("rough days take points away", async () => {
  const ev = p.locator("section", { has: p.getByRole("heading", { name: "Everley" }) });
  await ev.getByRole("button", { name: /Wednesday, Nov 18: not logged/ }).click();
  await ev.getByRole("button", { name: "Red" }).last().click();
  await ev.getByText("Saved · Red · \u22122 points").waitFor();
  const ad = p.locator("section", { has: p.getByRole("heading", { name: "Adler" }) });
  await ad.getByRole("button", { name: /Thursday, Nov 19: not logged/ }).click();
  await ad.getByRole("button", { name: "0", exact: true }).last().click();
  await ad.getByText("Saved · 0 · \u22122 points").waitFor();
  await p.reload();
  await p.getByText(/Star chart · 5 points this month/).waitFor(); // 1 + 3 + 3 - 2
  await p.getByText(/Skittles · -1 points this month/).waitFor(); // 1 - 2
});

await step("Home shows a compact points row; Points tab has the details", async () => {
  await p.goto(BASE + "/");
  await p.getByRole("heading", { name: "Points", exact: true }).waitFor();
  assert(await p.getByText(/5 pts this month/).isVisible(), "Everley points missing on Home");
  assert(!(await p.getByText("How everyone's doing").count()), "detailed chart should not be on Home");
  await p.getByRole("link", { name: "Points", exact: true }).last().click();
  await p.getByRole("heading", { name: "How everyone's doing" }).waitFor();
  assert(await p.getByText("Purple 2").isVisible(), "legend missing on Points tab");
  await p.screenshot({ path: SHOTS + "/points-home.png", fullPage: true });
});

await step("kid view is big and simple", async () => {
  await p.goto(BASE + "/points/kids");
  await p.getByText("Pick Friday's movie").waitFor();
  await p.getByText(/3 of 4 points/).waitFor();
  await p.screenshot({ path: SHOTS + "/points-kids.png", fullPage: true });
});

await step("no page errors", async () => assert(p.errors.length === 0, p.errors.join(" | ")));
await browser.close();
done();
