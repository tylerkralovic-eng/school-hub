import { redirect } from "next/navigation";
import { Conversation } from "@/components/onboarding/Conversation";
import { features } from "@/lib/env";
import { getUser } from "@/lib/server/context";

export const metadata = { title: "Let's set up School Hub" };
export const maxDuration = 300;

export default async function OnboardingPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("family_members").select("family_id").eq("user_id", user.id).maybeSingle();
  if (membership) redirect("/");
  return <Conversation aiReady={features.ai()} />;
}
