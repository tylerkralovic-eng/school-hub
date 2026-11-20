import { NextResponse } from "next/server";
import { env, features } from "@/lib/env";

/** "Save School Hub to contacts" — a vCard with the School Hub texting number. */
export async function GET() {
  if (!features.sms()) return new NextResponse("Not available", { status: 404 });
  const n = env.twilioPhoneNumber()!;
  const card = ["BEGIN:VCARD", "VERSION:3.0", "FN:School Hub", "ORG:School Hub", `TEL;TYPE=CELL:${n}`, `URL:${env.appUrl()}`, "NOTE:Text or forward school messages here. Voice-to-text works too.", "END:VCARD", ""].join("\r\n");
  return new NextResponse(card, { headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": 'attachment; filename="School Hub.vcf"' } });
}
