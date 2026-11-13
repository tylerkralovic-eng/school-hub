import { after } from "next/server";
import { env, features } from "@/lib/env";
import { twiml, validTwilioSignature } from "@/lib/integrations/twilio";
import { processDocument } from "@/lib/pipeline/process";
import { ingestSubmission } from "@/lib/server/ingest-files";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

/**
 * Twilio inbound SMS/MMS webhook. Parents forward school texts to the School
 * Hub number. Only phones verified by texting a one-time LINK code are
 * accepted; everything else is ignored silently.
 */
export async function POST(req: Request) {
  if (!features.sms()) return new Response("SMS not configured", { status: 503 });
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  const url = `${env.appUrl()}/api/inbound/sms`;
  if (!validTwilioSignature(env.twilioAuthToken()!, url, params, req.headers.get("x-twilio-signature") ?? "")) {
    return new Response("invalid signature", { status: 403 });
  }

  const from = params.From ?? "";
  const body = (params.Body ?? "").trim();
  const db = createAdminClient();

  // Phone linking: "LINK 123456" sent from the parent's own phone proves they own it.
  const link = body.match(/^link\s+(\d{6})$/i);
  if (link) {
    const { data: pending } = await db.from("member_phones").select("*").eq("verification_code", `LINK ${link[1]}`).gt("code_expires_at", new Date().toISOString()).is("verified_at", null).maybeSingle();
    if (!pending) return twiml("That code is invalid or expired. Get a new one in School Hub → Connections.");
    const { data: taken } = await db.from("member_phones").select("id, user_id").eq("phone_e164", from).maybeSingle();
    if (taken && taken.user_id !== pending.user_id) return twiml("This phone is already linked to another School Hub account.");
    if (taken) await db.from("member_phones").delete().eq("id", taken.id);
    await db.from("member_phones").update({ phone_e164: from, verified_at: new Date().toISOString(), verification_code: null }).eq("id", pending.id);
    await db.from("audit_events").insert({ family_id: pending.family_id, user_id: pending.user_id, action: "sms.phone_linked" });
    return twiml("Linked! Forward school texts to this number and they'll appear in School Hub for review.");
  }

  const { data: phone } = await db.from("member_phones").select("family_id, user_id").eq("phone_e164", from).not("verified_at", "is", null).maybeSingle();
  if (!phone) return twiml(); // unknown sender: ignore without revealing anything

  const { data: member } = await db.from("family_members").select("display_name").eq("family_id", phone.family_id).eq("user_id", phone.user_id).maybeSingle();
  if (!member) return twiml(); // member removed from family

  // MMS images (screenshots). Twilio media URLs require account auth.
  const files: { name: string; data: Uint8Array }[] = [];
  const n = Math.min(Number(params.NumMedia ?? 0), 5);
  for (let i = 0; i < n; i++) {
    const mediaUrl = params[`MediaUrl${i}`];
    if (!mediaUrl?.startsWith("https://api.twilio.com/")) continue;
    const res = await fetch(mediaUrl, { headers: env.twilioAccountSid() ? { Authorization: "Basic " + Buffer.from(`${env.twilioAccountSid()}:${env.twilioAuthToken()}`).toString("base64") } : {} });
    if (res.ok) files.push({ name: `text-image-${i + 1}`, data: new Uint8Array(await res.arrayBuffer()) });
  }

  const { docIds } = await ingestSubmission(db, {
    familyId: phone.family_id,
    userId: phone.user_id,
    channel: "sms",
    files,
    text: body,
    sender: `Forwarded by ${member.display_name}`,
    originRef: params.MessageSid ? `sms:${params.MessageSid}` : null,
    title: body ? body.slice(0, 80) : "Text message",
  });
  // Respond to Twilio immediately; extract in the background.
  after(async () => {
    for (const id of docIds) await processDocument(db, id);
  });
  return twiml();
}
