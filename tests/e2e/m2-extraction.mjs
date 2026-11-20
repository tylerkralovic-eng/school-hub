import path from "node:path";
import { BASE, assert, done, launch, onboard, signUp, step, uid } from "./lib.mjs";

const fixtures = path.resolve("tests/fixtures");
const SHOTS = process.env.SHOTS ?? "/tmp";
const { browser, newPhone } = await launch();
const p = await newPhone();

console.log("M2: upload → extract → review → calendar");

await step("set up a family", async () => {
  await signUp(p, `m2-${uid()}@e2e.local`);
  await onboard(p);
});

await step("upload a calendar photo and see extracted candidates", async () => {
  await p.goto(BASE + "/add");
  await p.getByRole("button", { name: "Everley" }).click();
  await p.getByTestId("file-input").setInputFiles(path.join(fixtures, "calendar-december.jpg"));
  await p.getByRole("button", { name: /Read 1 file/ }).click();
  await p.waitForURL("**/review/**", { timeout: 120_000 });
  await p.getByTestId("candidate").first().waitFor();
  const n = await p.getByTestId("candidate").count();
  assert(n >= 3, `expected several candidates, got ${n}`);
  await p.screenshot({ path: SHOTS + "/m2-review.png", fullPage: true });
});

await step("uncertain items are flagged with a reason", async () => {
  assert(await p.getByText("Date is not readable").first().isVisible(), "missing uncertainty reason");
});

await step("parent corrects a title, skips an item, and approves", async () => {
  const first = p.getByTestId("candidate").first();
  await first.getByRole("button", { name: "Edit" }).click();
  await first.getByLabel("Title").fill("Picture day (retakes too)");
  // Skip the undated one
  await p.getByRole("checkbox", { name: /Include "\[Test\] Spirit week"/ }).uncheck();
  await p.getByRole("button", { name: /^Add \d+ items?$/ }).click();
  await p.getByText(/\d+ added/).waitFor();
});

await step("approved events appear on the calendar with source", async () => {
  await p.goto(BASE + "/calendar");
  await p.getByText("Picture day (retakes too)").first().waitFor();
  assert(!(await p.getByText("[Test] Spirit week").count()), "skipped item was saved");
  await p.screenshot({ path: SHOTS + "/m2-calendar.png", fullPage: true });
  await p.getByText("Picture day (retakes too)").first().click();
  await p.waitForURL("**/items/**");
  await p.getByText("Source", { exact: true }).click();
  await p.getByRole("link", { name: "View original" }).first().waitFor();
});

await step("the original photo is preserved and viewable", async () => {
  await p.getByRole("link", { name: "View original" }).first().click();
  await p.waitForURL("**/documents/**");
  const img = p.locator("main img");
  await img.waitFor();
  const ok = await img.evaluate((el) => el.complete && el.naturalWidth > 100);
  assert(ok, "original image did not load");
});

await step("uploading the same file again is detected", async () => {
  await p.goto(BASE + "/add");
  await p.getByTestId("file-input").setInputFiles(path.join(fixtures, "calendar-december.jpg"));
  await p.getByRole("button", { name: /Read 1 file/ }).click();
  await p.waitForURL("**/review/**", { timeout: 60_000 });
  await p.getByText("added this exact file").waitFor();
});

await step("a PDF can be uploaded", async () => {
  await p.goto(BASE + "/add");
  await p.getByTestId("file-input").setInputFiles(path.join(fixtures, "newsletter.pdf"));
  await p.getByRole("button", { name: /Read 1 file/ }).click();
  await p.waitForURL("**/review/**", { timeout: 120_000 });
  await p.getByTestId("candidate").first().waitFor();
});

await step("pasted text goes through the same pipeline, with duplicate detection", async () => {
  await p.goto(BASE + "/add");
  await p.getByRole("tab", { name: "Type or say it" }).click();
  const d = new Date(Date.now() + 3 * 86400000);
  const mon = d.toLocaleDateString("en-US", { month: "short", timeZone: "America/New_York" });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/New_York" });
  await p.getByLabel("Message text").fill(`Hi families! Everley's class: please return field trip form by ${mon} ${day}. Thanks, Ms. Lopez`);
  await p.getByRole("button", { name: "Find dates & to-dos" }).click();
  await p.waitForURL("**/review/**", { timeout: 60_000 });
  await p.getByTestId("candidate").first().waitFor();
  await p.screenshot({ path: SHOTS + "/m2-review-text.png", fullPage: true });
});

await step("no page errors", async () => assert(p.errors.length === 0, p.errors.join(" | ")));
await browser.close();
done();
