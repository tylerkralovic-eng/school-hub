import "server-only";
import { env } from "@/lib/env";
import { contentImageUrls, fetchPublicImage } from "@/lib/integrations/images";

/**
 * Minimal Gmail API client (REST, no SDK). Scope: gmail.readonly — the least
 * privilege that can read message bodies. We never send, modify or delete mail.
 */
export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];

export function redirectUri() {
  return `${env.appUrl()}/api/gmail/callback`;
}

export function authUrl(state: string, loginHint?: string) {
  const p = new URLSearchParams({
    client_id: env.googleClientId()!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  if (loginHint) p.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export class GmailAuthError extends Error {}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.googleClientId()!, client_secret: env.googleClientSecret()!, ...body }),
  });
  const json = (await res.json()) as Record<string, string>;
  if (!res.ok) {
    if (json.error === "invalid_grant") throw new GmailAuthError("Google access was revoked or expired");
    throw new Error(`Google token error: ${json.error ?? res.status}`);
  }
  return json;
}

export async function exchangeCode(code: string): Promise<{ refreshToken: string; accessToken: string; email: string; scopes: string[] }> {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new Error("Google did not return a refresh token");
  // id_token came straight from Google's token endpoint over TLS; read the email claim.
  const payload = JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString("utf8"));
  return { refreshToken: t.refresh_token, accessToken: t.access_token, email: String(payload.email ?? ""), scopes: (t.scope ?? "").split(" ") };
}

export async function accessTokenFor(refreshToken: string): Promise<string> {
  return (await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" })).access_token;
}

export async function revokeToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
}

// ---------------------------------------------------------------- reading mail

export interface MailAttachment {
  filename: string;
  mime: string;
  data: Buffer;
}
export interface MailMessage {
  id: string;
  from: string;
  subject: string;
  date: string; // ISO
  text: string;
  /** PDFs and images: attached, embedded inline, or loaded from the web by the email. */
  attachments: MailAttachment[];
}
export interface MailHeaders {
  id: string;
  from: string;
  subject: string;
  date: string; // ISO
}
export interface MailProvider {
  list(query: string, max: number): Promise<string[]>;
  get(id: string): Promise<MailMessage>;
  /** From/Subject/Date only — never the body. Used to discover school senders. */
  headers(id: string): Promise<MailHeaders>;
}

interface Part {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: Part[];
}

const ATTACH_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_ATTACH = 8 * 1024 * 1024;

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export class GmailProvider implements MailProvider {
  constructor(private accessToken: string) {}

  private async api<T>(path: string): Promise<T> {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (res.status === 401) throw new GmailAuthError("Gmail access token rejected");
    if (!res.ok) throw new Error(`Gmail API ${res.status}`);
    return res.json() as Promise<T>;
  }

  async list(query: string, max: number) {
    const r = await this.api<{ messages?: { id: string }[] }>(`messages?q=${encodeURIComponent(query)}&maxResults=${max}`);
    return (r.messages ?? []).map((m) => m.id);
  }

  async headers(id: string): Promise<MailHeaders> {
    const m = await this.api<{ id: string; internalDate: string; payload: Part }>(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
    const header = (n: string) => m.payload.headers?.find((h) => h.name.toLowerCase() === n)?.value ?? "";
    return { id: m.id, from: header("from"), subject: header("subject"), date: new Date(Number(m.internalDate)).toISOString() };
  }

  async get(id: string): Promise<MailMessage> {
    const m = await this.api<{ id: string; internalDate: string; payload: Part }>(`messages/${id}?format=full`);
    const header = (n: string) => m.payload.headers?.find((h) => h.name.toLowerCase() === n)?.value ?? "";
    let plain = "";
    let html = "";
    const attachments: { filename: string; mime: string; attachmentId: string }[] = [];
    const inline: MailAttachment[] = [];
    const walk = (p: Part) => {
      const isFile = ATTACH_TYPES.includes(p.mimeType ?? "");
      // Attached or inline (cid:) images often have no filename — read them too.
      if (isFile && p.body?.attachmentId && (p.body.size ?? 0) <= MAX_ATTACH && (p.body.size ?? 0) >= 6 * 1024) {
        attachments.push({ filename: p.filename || "inline-image", mime: p.mimeType!, attachmentId: p.body.attachmentId });
      } else if (isFile && p.body?.data && (p.body.size ?? 0) >= 6 * 1024) {
        inline.push({ filename: p.filename || "inline-image", mime: p.mimeType!, data: Buffer.from(p.body.data, "base64url") });
      } else if (p.mimeType === "text/plain" && p.body?.data && !plain) plain = Buffer.from(p.body.data, "base64url").toString("utf8");
      else if (p.mimeType === "text/html" && p.body?.data && !html) html = Buffer.from(p.body.data, "base64url").toString("utf8");
      p.parts?.forEach(walk);
    };
    walk(m.payload);
    const files: MailAttachment[] = [...inline];
    for (const a of attachments.slice(0, 6)) {
      const body = await this.api<{ data: string }>(`messages/${id}/attachments/${a.attachmentId}`);
      files.push({ filename: a.filename, mime: a.mime, data: Buffer.from(body.data, "base64url") });
    }
    // Images the email loads from the web (Smore/ParentSquare/Canva newsletters, flyers).
    if (html && files.length < 6) {
      const remote = await Promise.all(contentImageUrls(html, 6 - files.length).map((u) => fetchPublicImage(u)));
      for (const r of remote) if (r) files.push({ filename: "email-image", mime: r.mime, data: r.data });
    }
    return {
      id: m.id,
      from: header("from"),
      subject: header("subject"),
      date: new Date(Number(m.internalDate)).toISOString(),
      text: (plain || htmlToText(html)).slice(0, 60_000),
      attachments: files,
    };
  }
}
