"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveItem } from "@/app/actions/items";
import { FormError, SubmitButton } from "@/components/forms";
import { inputClass } from "@/components/ui";

export function QuickAddTask({ whoOptions }: { whoOptions: { value: string; label: string }[] }) {
  const [state, action] = useActionState(saveItem, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (!state?.error) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
      <input type="hidden" name="kind" value="task" />
      <input type="hidden" name="category" value="general" />
      <input type="hidden" name="back" value="/tasks" />
      <label htmlFor="qa-title" className="sr-only">New to-do</label>
      <input id="qa-title" name="title" required placeholder="Add a to-do… e.g. Buy poster board" className={inputClass} />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="qa-date">Due date</label>
        <input id="qa-date" type="date" name="date" className={`${inputClass} !py-2 text-sm`} />
        <label className="sr-only" htmlFor="qa-who">For</label>
        <select id="qa-who" name="childId" className={`${inputClass} !py-2 text-sm`}>
          <option value="">Whole family</option>
          {whoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <SubmitButton className="!px-4 !py-2 text-sm" pendingText="…">Add</SubmitButton>
      </div>
      <FormError message={state?.error} />
    </form>
  );
}
