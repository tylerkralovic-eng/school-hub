import { createHmac } from "node:crypto";
import fs from "node:fs";
import { BASE, assert, done, launch, onboard, signUp, step, uid } from "./lib.mjs";

process.loadEnvFile?.(".env.local");
const SHOTS = process.env.SHOTS ?? "/tmp";
const TWILIO_TOKEN = "test_twilio_token";
const { browser, newPhone } = await launch();
const p1 = await newPhone();
const p2 = await newPhone();
const PHONE = `+1555${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const email2 = `morgan-${uid()}@e2e.local`;

function twilioPost(params, { badSig = false } = {}) {
  const url = `${process.env.APP_URL}/api/inbound/sms`;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const sig = createHmac("sha1", TWILIO_TOKEN).update(data).digest("base64");
  return fetch(`${BASE}/api/inbound/sms`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": badSig ? "bad" + sig : sig }, body: new URLSearchParams(params) });
}

console.log("M3–M5: tasks, inbox, reminders, SMS, sharing, connections, data");

await step("two parents share a family", async () => {
  await signUp(p1, `tyler-${uid()}@e2e.local`);
  await onboard(p1, { family: "Kral Test Family" });
  await p1.goto(BASE + "/settings");
  await p1.getByLabel("Their email").fill(email2);
  await p1.getByRole("button", { name: "Send invitation" }).click();
  const link = await p1.getByLabel("Invitation link").inputValue();
  await signUp(p2, email2, new URL(link).pathname);
  await p2.getByLabel("Your first name").fill("Morgan");
  await p2.getByRole("button", { name: "Join family" }).click();
  await p2.waitForURL((u) => u.pathname === "/");
});

const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

await step("parent 1 adds a task and assigns it to parent 2", async () => {
  await p1.goto(BASE + "/tasks");
  await p1.getByLabel("New to-do").fill("Buy poster board");
  await p1.getByLabel("Due date").fill(tomorrow);
  await p1.getByLabel("For").selectOption({ label: "Everley" });
  await p1.getByRole("button", { name: "Add", exact: true }).click();
  await p1.getByRole("link", { name: "Buy poster board" }).waitFor();
  await p1.getByLabel(`Who's handling "Buy poster board"`).selectOption({ label: "Morgan" });
  await p1.waitForTimeout(800);
  await p1.screenshot({ path: SHOTS + "/m3-tasks.png", fullPage: true });
});

await step("parent 2 sees it under Mine and completes it", async () => {
  await p2.goto(BASE + "/tasks?mine=1");
  await p2.getByRole("link", { name: "Buy poster board" }).waitFor();
  await p2.getByRole("checkbox", { name: /Mark "Buy poster board" as done/ }).click();
  await p2.waitForTimeout(800);
  await p2.goto(BASE + "/tasks?view=done");
  await p2.getByText(/Done .* by Morgan/).waitFor();
});

await step("parent 1 sees it completed by parent 2", async () => {
  await p1.goto(BASE + "/tasks?view=done");
  await p1.getByText(/by Morgan/).waitFor();
});

await step("inbox lists the item with its source and filters by type", async () => {
  await p1.goto(BASE + "/inbox");
  await p1.getByRole("link", { name: "Buy poster board" }).waitFor();
  assert(await p1.getByText("Added by hand").first().isVisible(), "source label missing");
  await p1.getByRole("link", { name: "Events", exact: true }).click();
  await p1.getByText("Nothing here yet").waitFor();
});

await step("connections page is honest about what isn't set up", async () => {
  await p1.goto(BASE + "/connections");
  await p1.getByRole("heading", { name: "Connect", exact: true }).waitFor();
  assert(await p1.getByText(/Coming soon to your School Hub: .*reading Gmail/).isVisible(), "should say Gmail isn't available yet");
  assert(!(await p1.getByText("Connect Gmail").count()), "Gmail button shown although not configured");
  await p1.screenshot({ path: SHOTS + "/m5-connections.png", fullPage: true });
});

let code;
await step("SMS: parent links a phone by texting a code", async () => {
  await p1.getByRole("button", { name: "Link my phone" }).click();
  const link = p1.getByRole("link", { name: "Open Messages and send" });
  await link.waitFor();
  const href = await link.getAttribute("href");
  assert(href.startsWith("sms:+15555550100?&body=LINK%20"), "sms link not prefilled: " + href);
  code = decodeURIComponent(href.split("body=")[1]);
  const bad = await twilioPost({ From: PHONE, Body: code, MessageSid: "SMx1" }, { badSig: true });
  assert(bad.status === 403, "bad signature accepted");
  const res = await twilioPost({ From: PHONE, Body: code, MessageSid: "SMlink1" });
  assert((await res.text()).includes("Linked"), "link reply missing");
  await p1.getByRole("heading", { name: "Text School Hub anything" }).waitFor({ timeout: 15000 }); // flips by itself
  assert((await p1.getByRole("link", { name: /Text \(555\) 555-0100/ }).getAttribute("href")) === "sms:+15555550100", "text link wrong");
  const vcf = await p1.request.get(BASE + "/api/contact");
  assert((await vcf.text()).includes("TEL;TYPE=CELL:+15555550100"), "vCard missing number");
});

await step("SMS: forwarded school text is ingested; unknown numbers are ignored", async () => {
  const d = new Date(Date.now() + 5 * 86400000);
  const mon = d.toLocaleDateString("en-US", { month: "short", timeZone: "America/New_York" });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/New_York" });
  const stranger = await twilioPost({ From: "+15555550999", Body: `No school ${mon} ${day}`, MessageSid: "SMstr" });
  assert(!(await stranger.text()).includes("<Message>"), "replied to stranger");
  const r = await twilioPost({ From: PHONE, Body: `Little Oaks: Pajama day ${mon} ${day}! Adler can wear PJs.`, MessageSid: "SMfwd1", NumMedia: "0" });
  assert(r.status === 200, "webhook failed");
  await twilioPost({ From: PHONE, Body: `Little Oaks: Pajama day ${mon} ${day}! Adler can wear PJs.`, MessageSid: "SMfwd1", NumMedia: "0" }); // Twilio retry
  await p1.waitForTimeout(2500);
  await p1.goto(BASE + "/add");
  await p1.getByText("Text message ·").first().waitFor();
  assert((await p1.getByText(/Pajama day/).count()) === 1, "duplicate SMS ingested or missing");
  await p1.getByText(/Pajama day/).first().click();
  await p1.getByTestId("candidate").first().waitFor({ timeout: 30000 });
  assert(await p1.getByText("Forwarded by Tyler").first().isVisible(), "sender missing");
});

let key;
await step("Shortcut key: create once, then share text via the API", async () => {
  await p1.goto(BASE + "/connections");
  await p1.getByText("Advanced settings").click();
  await p1.getByLabel("Key name").fill("Test iPhone");
  await p1.getByRole("button", { name: "Create Shortcut key" }).click();
  key = await p1.getByLabel("Invitation link").inputValue(); // ActionForm's copy box
  assert(key.startsWith("shk_"), "no key");
  const unauth = await fetch(BASE + "/api/ingest", { method: "POST", headers: { Authorization: "Bearer shk_wrong" }, body: "x" });
  assert(unauth.status === 401, "bad key accepted");
  const fd = new FormData();
  fd.append("text", "Science fair projects due Dec 10. Everley needs a tri-fold board.");
  fd.append("files", new Blob([fs.readFileSync("tests/fixtures/newsletter.pdf")], { type: "application/pdf" }), "newsletter.pdf");
  fd.append("files", new Blob([Buffer.from("not really an image")], { type: "image/png" }), "fake.png");
  const res = await fetch(BASE + "/api/ingest", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd });
  const json = await res.json();
  assert(json.ok && json.added === 2, "ingest failed " + JSON.stringify(json));
  assert(json.rejected.includes("fake.png"), "spoofed file type accepted");
  await p1.waitForTimeout(3000);
  await p1.goto(new URL(json.review_url).pathname.replace(/^/, BASE));
  await p1.getByTestId("candidate").first().waitFor({ timeout: 30000 });
});

await step("calendar subscription feed works and is private", async () => {
  await p1.goto(BASE + "/connections");
  await p1.getByText("Advanced settings").click();
  const url = await p1.getByLabel("Calendar link").inputValue();
  const ics = await (await fetch(url.replace(process.env.APP_URL, BASE))).text();
  assert(ics.startsWith("BEGIN:VCALENDAR"), "not ics");
  assert((await fetch(BASE + "/api/calendar/" + "0".repeat(48) + ".ics")).status === 404, "guessable");
});

await step("daily job requires the secret, then sends digests", async () => {
  assert((await fetch(BASE + "/api/cron/daily")).status === 401, "cron open");
  const r = await fetch(BASE + "/api/cron/daily", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const j = await r.json();
  assert(r.status === 200 && typeof j.digests === "number", JSON.stringify(j));
});

await step("export downloads the family's data", async () => {
  const res = await p1.request.get(BASE + "/api/export");
  const j = await res.json();
  assert(j.items.some((i) => i.title === "Buy poster board"), "export missing items");
  assert(j.children.length === 2, "export missing children");
});

await step("parent 2 can't see another family's export or review pages", async () => {
  const other = await newPhone();
  await signUp(other, `other-${uid()}@e2e.local`);
  await onboard(other, { family: "Other Family", kids: [["Sam", "1", "Elm School"]] });
  const j = await (await other.request.get(BASE + "/api/export")).json();
  assert(!j.items.some((i) => i.title === "Buy poster board"), "LEAK across families");
  await other.goto(BASE + "/connections");
  assert(!(await other.getByText(PHONE).count()), "LEAK phone");
  // delete that family
  await other.goto(BASE + "/settings/data");
  await other.getByLabel(/Type/).fill("Other Family");
  other.once("dialog", (d) => d.accept());
  await other.getByRole("button", { name: "Delete family workspace" }).click();
  await other.waitForURL("**/onboarding");
});

await step("no page errors", async () => assert(p1.errors.length + p2.errors.length === 0, [...p1.errors, ...p2.errors].join(" | ")));
await browser.close();
done();
