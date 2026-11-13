"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/app/actions/auth";
import { FormError, SubmitButton } from "@/components/forms";
import { Field, Notice, inputClass } from "@/components/ui";

export function SignInForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      {linkError && <Notice tone="warn">That link is invalid or has expired. Please try again.</Notice>}
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <FormError message={state?.error} />
      <SubmitButton className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-slate-500 hover:text-slate-800">Forgot password?</Link>
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-indigo-600">Create account</Link>
      </div>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, undefined);
  if (state?.ok) return <Notice tone="ok" title="Almost there">{state.ok}</Notice>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters with upper- and lowercase letters and a number.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className={inputClass} />
      </Field>
      <FormError message={state?.error} />
      <SubmitButton className="w-full" pendingText="Creating account…">Create account</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-indigo-600">Sign in</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  if (state?.ok) return <Notice tone="ok">{state.ok}</Notice>;
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <FormError message={state?.error} />
      <SubmitButton className="w-full" pendingText="Sending…">Send reset link</SubmitButton>
      <Link href="/login" className="block text-center text-sm text-slate-500">Back to sign in</Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="New password" htmlFor="password" hint="At least 10 characters with upper- and lowercase letters and a number.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className={inputClass} />
      </Field>
      <FormError message={state?.error} />
      <SubmitButton className="w-full" pendingText="Saving…">Save password</SubmitButton>
    </form>
  );
}
