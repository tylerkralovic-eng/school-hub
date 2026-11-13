// Minimal e2e harness on the preinstalled Playwright (no extra dependency).
import { createRequire } from "node:module";
// Uses the machine's installed Playwright (CommonJS resolution honors NODE_PATH).
const { chromium, devices } = createRequire(import.meta.url)("playwright");

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const PASSWORD = "Testpassword123";
export const uid = () => Math.random().toString(36).slice(2, 8);

let failures = 0;
export async function step(name, fn) {
  try {
    await fn();
    console.log("  ✓", name);
  } catch (e) {
    failures++;
    console.log("  ✗", name, "\n    ", e.message.split("\n")[0]);
  }
}
export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
export function done() {
  console.log(failures ? `\n${failures} failed` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

export async function launch() {
  const browser = await chromium.launch();
  const newPhone = async () => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await ctx.newPage();
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push(e.message));
    return page;
  };
  return { browser, newPhone };
}

export async function signUp(page, email, next) {
  await page.goto(`${BASE}/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function onboard(page, { family = "Test Family", me = "Tyler", kids = [["Everley", "2nd", "Maple Elementary"], ["Adler", "Pre-K", "Little Oaks Preschool"]] } = {}) {
  await page.waitForURL("**/onboarding");
  await page.getByLabel("Family name").fill(family);
  await page.getByLabel("Your first name").fill(me);
  for (let i = 0; i < kids.length; i++) {
    if (i > 0) await page.getByRole("button", { name: "Add another child" }).click();
    await page.getByLabel("First name", { exact: true }).nth(i).fill(kids[i][0]);
    await page.getByLabel("Grade", { exact: true }).nth(i).fill(kids[i][1]);
    await page.getByLabel("School", { exact: true }).nth(i).fill(kids[i][2]);
  }
  await page.getByRole("button", { name: "Create our School Hub" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}
