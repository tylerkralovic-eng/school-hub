"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormError, SubmitButton, type ActionState } from "@/components/forms";
import { buttonClass } from "@/components/ui";

type LinkState = ActionState;

/** Wraps a server action form with pending, error and success feedback. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  pendingText = "Saving…",
  className = "space-y-3",
  resetOnSuccess = false,
  submitClassName = "",
}: {
  action: (state: LinkState, form: FormData) => Promise<LinkState>;
  children: React.ReactNode;
  submitLabel?: string;
  pendingText?: string;
  className?: string;
  resetOnSuccess?: boolean;
  submitClassName?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <FormError message={state?.error} />
      {state?.ok && (
        <div role="status" className="space-y-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>{state.ok}</p>
          {state.link && (
            <div className="flex gap-2">
              <input readOnly value={state.link} aria-label="Invitation link" className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className={buttonClass.ghost} onClick={() => { navigator.clipboard?.writeText(state.link!); setCopied(true); }}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}
      <SubmitButton pendingText={pendingText} className={submitClassName}>{submitLabel}</SubmitButton>
    </form>
  );
}

export function ConfirmButton({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
