import Link from "next/link";
import { AcceptInviteForm } from "@/components/AcceptInviteForm";
import { Notice, buttonClass } from "@/components/ui";
import { getUser } from "@/lib/server/context";
import { signOut } from "@/app/actions/auth";

export const metadata = { title: "Join a family · School Hub" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase, user } = await getUser();
  const next = `/invite/${token}`;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">SH</span>
        <span className="text-xl font-semibold tracking-tight">School Hub</span>
      </div>
      {!user ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re invited</h1>
          <p className="mb-6 mt-1 text-sm text-slate-600">
            Sign in or create an account with the email address the invitation was sent to.
          </p>
          <div className="grid gap-3">
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className={buttonClass.primary}>Create account</Link>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonClass.secondary}>I already have an account</Link>
          </div>
        </>
      ) : (
        <InviteForUser token={token} email={user.email ?? ""} supabase={supabase} />
      )}
    </div>
  );
}

async function InviteForUser({ token, email, supabase }: { token: string; email: string; supabase: Awaited<ReturnType<typeof getUser>>["supabase"] }) {
  const { data } = await supabase.rpc("invite_preview", { p_token: token });
  const invite = data?.[0];
  if (!invite) return <Notice tone="error" title="Invitation not found">Ask for a new invitation link.</Notice>;
  if (invite.used) return <Notice tone="warn" title="Already used">This invitation has already been accepted. <Link className="underline" href="/">Go to School Hub</Link></Notice>;
  if (invite.expired) return <Notice tone="warn" title="Invitation expired">Ask for a new invitation link.</Notice>;
  if (invite.email.toLowerCase() !== email.toLowerCase())
    return (
      <div className="space-y-4">
        <Notice tone="warn" title="Different email address">
          This invitation was sent to {invite.email}, but you&apos;re signed in as {email}.
        </Notice>
        <form action={signOut}><button className={buttonClass.secondary + " w-full"}>Sign out and switch account</button></form>
      </div>
    );
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Join {invite.family_name}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">You&apos;ll see the same children, calendar, tasks and updates as the rest of your family.</p>
      <AcceptInviteForm token={token} />
    </>
  );
}
