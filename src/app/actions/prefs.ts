"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/** Remembers the selected child filter (per device). Validated on read. */
export async function setChildFilter(childId: string) {
  const store = await cookies();
  store.set("sh_child", childId === "all" ? "all" : childId.slice(0, 64), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  revalidatePath("/", "layout");
}
