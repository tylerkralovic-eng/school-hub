import { BASE, assert, done, launch, onboard, signUp, step, uid } from "./lib.mjs";

const { browser, newPhone } = await launch();
const p1 = await newPhone();
const p2 = await newPhone();
const outsider = await newPhone();
const email1 = `tyler-${uid()}@e2e.local`;
const email2 = `morgan-${uid()}@e2e.local`;
let inviteLink;

console.log("M1: accounts & family workspace");

await step("signed-out users are sent to login", async () => {
  await p1.goto(BASE + "/calendar");
  await p1.waitForURL("**/login?next=%2Fcalendar");
});

await step("weak passwords are rejected", async () => {
  await p1.goto(BASE + "/signup");
  await p1.getByLabel("Email").fill(email1);
  await p1.getByLabel("Password").fill("password12");
  await p1.getByRole("button", { name: "Create account" }).click();
  await p1.getByText("Include an uppercase letter").waitFor();
});

await step("parent 1 signs up and creates a family with 2 children at 2 schools", async () => {
  await signUp(p1, email1);
  await onboard(p1);
  await p1.getByText("Good", { exact: false }).first().waitFor();
  assert(await p1.getByRole("radio", { name: /Everley/ }).isVisible(), "child filter missing");
  assert(await p1.getByRole("radio", { name: /Adler/ }).isVisible(), "child filter missing");
  await p1.screenshot({ path: process.env.SHOTS + "/m1-home-empty.png", fullPage: true });
});

await step("settings lists children and schools", async () => {
  await p1.goto(BASE + "/settings");
  await p1.getByText("2nd · Maple Elementary").waitFor();
  assert(await p1.getByText("Pre-K · Little Oaks Preschool").isVisible(), "school missing");
});

await step("parent 1 invites parent 2 and gets a shareable link", async () => {
  await p1.getByLabel("Their email").fill(email2);
  await p1.getByRole("button", { name: "Send invitation" }).click();
  const box = p1.getByLabel("Invitation link");
  await box.waitFor();
  inviteLink = await box.inputValue();
  assert(inviteLink.includes("/invite/"), "no link");
  await p1.screenshot({ path: process.env.SHOTS + "/m1-settings.png", fullPage: true });
});

await step("a different account cannot use the invite", async () => {
  await signUp(outsider, `other-${uid()}@e2e.local`);
  await outsider.waitForURL("**/onboarding");
  await outsider.goto(inviteLink);
  await outsider.getByText("Different email address").waitFor();
});

await step("parent 2 signs up from the invite and joins the same family", async () => {
  await p2.goto(inviteLink);
  await p2.getByRole("link", { name: "Create account" }).click();
  await p2.getByLabel("Email").fill(email2);
  await p2.getByLabel("Password").fill("Testpassword123");
  await p2.getByRole("button", { name: "Create account" }).click();
  await p2.getByRole("heading", { name: "Join Test Family" }).waitFor();
  await p2.getByLabel("Your first name").fill("Morgan");
  await p2.getByRole("button", { name: "Join family" }).click();
  await p2.waitForURL((u) => u.pathname === "/");
  await p2.getByText("Good", { exact: false }).first().waitFor();
  assert(await p2.getByRole("radio", { name: /Everley/ }).isVisible(), "parent 2 doesn't see children");
});

await step("both parents are listed", async () => {
  await p1.goto(BASE + "/settings");
  await p1.getByText("Morgan").first().waitFor();
});

await step("no page errors", async () => {
  const errs = [...p1.errors, ...p2.errors];
  assert(errs.length === 0, errs.join(" | "));
});

await browser.close();
done();
