import { BASE, assert, done, launch, onboard, signUp, step, uid } from "./lib.mjs";

const SHOTS = process.env.SHOTS ?? "/tmp";
const { browser, newPhone } = await launch();
const p = await newPhone();
console.log("Family meeting deck");

await step("family with points tracking", async () => {
  await signUp(p, `mtg-${uid()}@e2e.local`);
  await onboard(p, { family: "Meeting Family", kids: [["Everley", "2nd", "Frey Elementary"], ["Adler", "Pre-K", "Sunbrook"]] });
  await p.goto(BASE + "/points/setup");
  await p.getByLabel("How the schools track behavior").fill("Everley's school tracks stars. Normal day is white, yellow talked to, red bad, purple superb. Adler keeps 3 skittles, 0 is bad.");
  await p.getByRole("button", { name: "Set it up" }).click();
  await p.getByRole("button", { name: "Looks right — start tracking" }).click();
  await p.waitForURL("**/points?setup=done");
  const ev = p.locator("section", { has: p.getByRole("heading", { name: "Everley" }) });
  await ev.getByRole("button", { name: /Monday, Nov 23: not logged/ }).click();
  await ev.getByRole("button", { name: "Purple" }).last().click();
  await ev.getByText(/Saved · Purple/).last().waitFor();
  await ev.getByText("Add a prize").click();
  await ev.getByLabel("Prize").fill("Pick Friday's movie");
  await ev.getByLabel("Points needed").fill("4");
  await ev.getByRole("button", { name: "Add prize" }).click();
  await p.getByText("This week: Pick Friday's movie").waitFor();
});

await step("Points tab opens the meeting deck", async () => {
  await p.getByRole("link", { name: "Family meeting" }).click();
  await p.waitForURL("**/meeting");
  await p.getByRole("region", { name: "Welcome" }).waitFor();
  for (const s of ["Everley's week", "Adler's week", "Points and prizes", "Next week", "Coming up", "Value of the week", "Wrap-up"])
    assert(await p.getByRole("region", { name: s }).isVisible(), `missing slide ${s}`);
  const ev = p.getByRole("region", { name: "Everley's week" });
  assert(await ev.getByText("Purple", { exact: true }).isVisible(), "Monday purple missing");
  assert(await p.getByRole("region", { name: "Points and prizes" }).getByText("Pick Friday's movie").isVisible(), "prize missing");
});

await step("turn on weekly Sunday 7pm meetings → on the calendar", async () => {
  await p.getByRole("button", { name: "Turn on" }).click();
  await p.waitForURL("**/meeting?saved=1");
  await p.getByText("Every Sunday at 7:00 PM").waitFor();
  const res = await p.request.get(BASE + "/api/meeting/ics");
  const ics = await res.text();
  assert(res.ok() && ics.includes("RRULE:FREQ=WEEKLY;BYDAY=SU") && ics.includes("T190000"), "ics wrong");
  await p.goto(BASE + "/calendar");
  await p.getByText("Family meeting").first().waitFor();
});

await step("swap the value of the week", async () => {
  await p.goto(BASE + "/meeting");
  const before = await p.getByRole("region", { name: "Value of the week" }).locator("h2").innerText();
  await p.getByRole("button", { name: "Try another" }).click();
  await p.waitForFunction((b) => document.querySelector('[aria-label="Value of the week"] h2')?.textContent !== b, before);
});

await step("present mode: one slide at a time, arrows, done", async () => {
  await p.getByRole("button", { name: "Present", exact: true }).click();
  await p.getByRole("dialog", { name: /Slide 1 of 8: Welcome/ }).waitFor();
  await p.keyboard.press("ArrowRight");
  await p.getByRole("dialog", { name: /Slide 2 of 8/ }).waitFor();
  await p.getByRole("button", { name: "Done" }).click();
  assert(!(await p.getByRole("dialog").count()), "present mode didn't close");
});

await step("save as PDF: one landscape page per slide", async () => {
  await p.emulateMedia({ media: "print" });
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  if (process.env.SHOTS) (await import("node:fs")).writeFileSync(SHOTS + "/meeting-deck.pdf", pdf);
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  assert(pages === 8, `expected 8 pages, got ${pages}`);
  await p.emulateMedia({ media: "screen" });
});

await step("no page errors", async () => assert(p.errors.length === 0, p.errors.join(" | ")));
await browser.close();
done();
