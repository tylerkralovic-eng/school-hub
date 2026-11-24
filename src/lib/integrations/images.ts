import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { sniffMime } from "@/lib/pipeline/process";

/**
 * Safely downloads images that school emails load from the web (newsletters are
 * often one big image). Guards against SSRF: https only, public addresses only
 * (re-checked on every redirect), size and time limits, and real-image check.
 */
const MAX_BYTES = 5 * 1024 * 1024; // Claude's per-image limit
const MIN_BYTES = 6 * 1024; // skip tracking pixels, spacers, tiny icons

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:") throw new Error("not https");
  if (url.username || url.password) throw new Error("credentials in url");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("internal host");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("private address");
}

export async function fetchPublicImage(src: string): Promise<{ mime: string; data: Buffer } | null> {
  try {
    let url = new URL(src);
    for (let hop = 0; hop < 4; hop++) {
      await assertPublic(url);
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { Accept: "image/*" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url);
        continue;
      }
      if (!res.ok || !res.body) return null;
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_BYTES) return null;
      const chunks: Uint8Array[] = [];
      let total = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) { await reader.cancel(); return null; }
        chunks.push(value);
      }
      const data = Buffer.concat(chunks);
      if (data.byteLength < MIN_BYTES) return null;
      const mime = sniffMime(data);
      return mime && mime.startsWith("image/") ? { mime, data } : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Image URLs worth reading from an email's HTML (skips pixels, logos, social icons). */
export function contentImageUrls(html: string, max = 6): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&");
    if (!src || !/^https:\/\//i.test(src)) continue;
    const w = Number(tag.match(/\swidth\s*=\s*["']?(\d+)/i)?.[1] ?? 0);
    const h = Number(tag.match(/\sheight\s*=\s*["']?(\d+)/i)?.[1] ?? 0);
    if ((w && w < 80) || (h && h < 80)) continue; // pixels, icons, buttons
    if (/pixel|track|beacon|open\.|\/o\.gif|spacer|facebook|twitter|instagram|linkedin|youtube|logo|icon|badge|footer|unsubscribe/i.test(src + " " + (tag.match(/alt\s*=\s*["']([^"']*)/i)?.[1] ?? ""))) continue;
    if (!out.includes(src)) out.push(src);
    if (out.length >= max) break;
  }
  return out;
}
