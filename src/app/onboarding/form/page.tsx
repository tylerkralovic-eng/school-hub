import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getUser } from "@/lib/server/context";
import { COMMON_TIMEZONES } from "@/lib/time";
import { signOut } from "@/app/actions/auth";

export const metadata = { title: "Set up your family · School Hub" };

export default async function OnboardingPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("family_members").select("family_id").eq("user_id", user.id).maybeSingle();
  if (membership) redirect("/");

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Set up your family</h1>
      <p className="mb-6 mt-1 text-sm leading-relaxed text-slate-600">
        Add your children and their schools. You can invite another parent and change anything later.
        Joining someone else&apos;s family? Open the invitation link they sent you instead.
      </p>
      <OnboardingForm timezones={COMMON_TIMEZONES} defaultTz="America/New_York" />
      <form action={signOut} className="mt-6 text-center">
        <button className="text-sm text-slate-500">Sign out ({user.email})</button>
      </form>
    </div>
  );
}
