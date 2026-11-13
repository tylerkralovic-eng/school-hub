import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { features } from "@/lib/env";
import { authUrl } from "@/lib/integrations/gmail";
import { getUser } from "@/lib/server/context";

/** Starts Google OAuth. A random state in an httpOnly cookie protects against CSRF. */
export async function GET(req: Request) {
  const { user } = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!features.gmail()) return NextResponse.redirect(new URL("/connections?gmail=not_configured", req.url));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authUrl(state, user.email ?? undefined));
  res.cookies.set("sh_gmail_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/gmail" });
  return res;
}
