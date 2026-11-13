/** Builds the morning digest email. Pure: easy to test, no I/O. */
import { dueLabel, fmt, fmtTime } from "@/lib/time";

export interface DigestItem {
  title: string;
  kind: string;
  category: string;
  starts_at: string | null;
  all_day: boolean;
  due_at: string | null;
  childName: string | null;
  assigneeName: string | null;
}

export interface DigestInput {
  memberName: string;
  familyName: string;
  timezone: string;
  appUrl: string;
  now: Date;
  todayEvents: DigestItem[];
  tasks: DigestItem[]; // overdue + due within 2 days, open
  pendingReview: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildDigest(d: DigestInput): { subject: string; text: string; html: string } | null {
  if (!d.todayEvents.length && !d.tasks.length && !d.pendingReview) return null;
  const tz = d.timezone;
  const day = fmt(d.now, tz, { weekday: "long", month: "long", day: "numeric" });
  const who = (i: DigestItem) => (i.childName ? ` (${i.childName})` : "");
  const evLine = (e: DigestItem) => `${e.all_day ? "All day" : fmtTime(e.starts_at!, tz)} — ${e.title}${who(e)}`;
  const taskLine = (t: DigestItem) => `${dueLabel(t.due_at!, tz, d.now).label}: ${t.title}${who(t)}${t.assigneeName ? ` · ${t.assigneeName}` : ""}`;
  const closures = d.todayEvents.filter((e) => e.category === "closure" || e.category === "early_dismissal");

  const parts: string[] = [];
  const html: string[] = [];
  if (closures.length) {
    parts.push(`HEADS UP: ${closures.map((c) => c.title).join("; ")}`);
    html.push(`<p style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px"><b>Heads up:</b> ${closures.map((c) => esc(c.title)).join("; ")}</p>`);
  }
  if (d.todayEvents.length) {
    parts.push("TODAY\n" + d.todayEvents.map((e) => "• " + evLine(e)).join("\n"));
    html.push(`<h3 style="margin:16px 0 6px">Today</h3><ul>${d.todayEvents.map((e) => `<li>${esc(evLine(e))}</li>`).join("")}</ul>`);
  }
  if (d.tasks.length) {
    parts.push("TO DO\n" + d.tasks.map((t) => "• " + taskLine(t)).join("\n"));
    html.push(`<h3 style="margin:16px 0 6px">To do</h3><ul>${d.tasks.map((t) => `<li>${esc(taskLine(t))}</li>`).join("")}</ul>`);
  }
  if (d.pendingReview) {
    parts.push(`${d.pendingReview} new item(s) are waiting for your review.`);
    html.push(`<p>${d.pendingReview} new item(s) are waiting for your review.</p>`);
  }
  const subject = `${day}: ${[d.todayEvents.length && `${d.todayEvents.length} today`, d.tasks.length && `${d.tasks.length} to do`, d.pendingReview && `${d.pendingReview} to review`].filter(Boolean).join(" · ")}`;
  const text = `Good morning, ${d.memberName}!\n\n${parts.join("\n\n")}\n\nOpen School Hub: ${d.appUrl}\n\nYou can turn off this email in Settings.`;
  const htmlDoc = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#0f172a"><p>Good morning, ${esc(d.memberName)}!</p>${html.join("")}<p><a href="${d.appUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Open School Hub</a></p><p style="color:#64748b;font-size:12px">${esc(d.familyName)} · Turn off this email in Settings.</p></div>`;
  return { subject, text, html: htmlDoc };
}
