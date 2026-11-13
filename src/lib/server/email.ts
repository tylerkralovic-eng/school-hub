import "server-only";
import nodemailer from "nodemailer";
import { env, features } from "@/lib/env";

/** Sends a transactional email if SMTP is configured. Returns false if not sent. */
export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  if (!features.email()) return false;
  try {
    const transport = nodemailer.createTransport(env.smtpUrl()!);
    await transport.sendMail({ from: env.emailFrom(), to, subject, text, html });
    return true;
  } catch (e) {
    console.error("email send failed", e);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
