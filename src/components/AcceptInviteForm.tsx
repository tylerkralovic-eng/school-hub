"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/family";
import { FormError, SubmitButton } from "@/components/forms";
import { Field, inputClass } from "@/components/ui";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Your first name" htmlFor="display_name">
        <input id="display_name" name="display_name" required autoComplete="given-name" className={inputClass} />
      </Field>
      <FormError message={state?.error} />
      <SubmitButton className="w-full" pendingText="Joining…">Join family</SubmitButton>
    </form>
  );
}
