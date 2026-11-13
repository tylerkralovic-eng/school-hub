// Generates fictional school documents for tests: a monthly calendar photo and a newsletter PDF.
import { createRequire } from "node:module";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const out = path.dirname(new URL(import.meta.url).pathname);

const events = {
  1: ["Book Fair begins", "(through Dec 4)"],
  3: ["PTA Meeting 6:30 PM", "Library"],
  4: ["Book Fair ends"],
  7: ["Picture Retake Day"],
  9: ["EARLY RELEASE 12:30 PM"],
  10: ["2nd Grade Field Trip", "Science Museum – $12 due Dec 4"],
  11: ["Ugly Sweater Day"],
  14: ["Winter Concert 6:00 PM", "Gym · grades K-2"],
  16: ["Report cards go home"],
  18: ["Pajama Day", "Class parties 1:30 PM"],
  21: ["NO SCHOOL", "Winter Break"],
  22: ["Winter Break"], 23: ["Winter Break"], 24: ["Winter Break"], 25: ["Winter Break"], 28: ["Winter Break"], 29: ["Winter Break"], 30: ["Winter Break"], 31: ["Winter Break"],
};
let cells = "";
const startDow = 2; // Dec 1 2026 is a Tuesday
for (let i = 0; i < startDow; i++) cells += `<td class="empty"></td>`;
for (let d = 1; d <= 31; d++) {
  const ev = (events[d] ?? []).map((e, i) => `<div class="${i ? "sub" : "ev"} ${/NO SCHOOL|EARLY/.test(e) ? "red" : ""}">${e}</div>`).join("");
  cells += `<td><div class="n">${d}</div>${ev}</td>`;
  if ((startDow + d) % 7 === 0) cells += "</tr><tr>";
}
const calendarHtml = `<html><body style="margin:0;background:#d8d2c4;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="transform:rotate(-1.6deg);background:#fffdf7;padding:28px 30px;box-shadow:0 10px 30px rgba(0,0,0,.35);font-family:Georgia,serif;width:1100px">
<div style="display:flex;justify-content:space-between;align-items:end"><h1 style="margin:0;font-size:40px">December 2026</h1><div style="font-size:20px">Maple Elementary School · Room 12 · Ms. Lopez</div></div>
<style>table{border-collapse:collapse;width:100%;margin-top:14px;table-layout:fixed}th{background:#244;color:#fff;padding:6px;font-size:16px}td{border:1px solid #888;height:110px;vertical-align:top;padding:4px;font-size:15px}.n{font-weight:bold;font-size:18px}.ev{margin-top:4px;font-weight:600}.sub{font-size:13px;color:#333}.red{color:#b00}.empty{background:#eee}</style>
<table><tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr><tr>${cells}</tr></table>
<p style="font-size:15px;margin:10px 0 0">Reminders: Please send a labeled water bottle daily. Field trip permission slips and $12 due Friday, Dec 4.</p></div></body></html>`;

const newsletterHtml = `<html><body style="font-family:Helvetica,Arial;padding:40px;max-width:700px">
<h1>Little Oaks Preschool — Bumblebees Class News</h1><p><i>Week of November 30, 2026</i></p>
<p>Hello Bumblebee families! This week we are learning about winter animals.</p>
<h3>Important dates</h3><ul>
<li><b>Wednesday, Dec 2</b> – Pajama &amp; movie day. Children may wear pajamas.</li>
<li><b>Friday, Dec 4</b> – Holiday photos with Santa, 9:00–11:00 AM. Order forms due Thursday, Dec 3.</li>
<li><b>Monday, Dec 7</b> – School closed for staff training.</li></ul>
<h3>Please send in</h3><p>A complete change of clothes and mittens labeled with your child's name by Monday, Nov 30.</p>
<h3>Tuition</h3><p>December tuition of $845 is due December 1 through ConnectCareWorks.</p>
<p>Thank you! — Ms. Rivera</p></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1250, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent(calendarHtml);
await page.screenshot({ path: path.join(out, "calendar-december.jpg"), type: "jpeg", quality: 82 });
await page.setContent(newsletterHtml);
await page.pdf({ path: path.join(out, "newsletter.pdf"), format: "Letter" });
await browser.close();
console.log("fixtures written");
