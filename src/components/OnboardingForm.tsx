"use client";

import { useActionState, useState } from "react";
import { completeOnboarding } from "@/app/actions/family";
import { Icon } from "@/components/Icon";
import { FormError, SubmitButton } from "@/components/forms";
import { Card, Field, inputClass } from "@/components/ui";

export function OnboardingForm({ timezones, defaultTz }: { timezones: string[]; defaultTz: string }) {
  const [state, action] = useActionState(completeOnboarding, undefined);
  const [kids, setKids] = useState([0]);
  const [tzValue, setTz] = useState(defaultTz);

  return (
    <form action={action} className="space-y-6">
      <Card className="space-y-4 p-4">
        <Field label="Family name" htmlFor="family_name" hint="Only your family sees this.">
          <input id="family_name" name="family_name" required placeholder="The Parker family" className={inputClass} />
        </Field>
        <Field label="Your first name" htmlFor="display_name">
          <input id="display_name" name="display_name" required autoComplete="given-name" className={inputClass} />
        </Field>
        <Field label="Time zone" htmlFor="timezone" hint="Used to read dates and times on school documents.">
          <select id="timezone" name="timezone" value={tzValue} onChange={(e) => setTz(e.target.value)} className={inputClass}>
            {[...new Set([defaultTz, ...timezones])].map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </Field>
      </Card>

      <div>
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">Children</h2>
        <div className="space-y-3">
          {kids.map((k, i) => (
            <Card key={k} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Child {i + 1}</span>
                {kids.length > 1 && (
                  <button type="button" onClick={() => setKids(kids.filter((x) => x !== k))} className="text-sm text-slate-500" aria-label={`Remove child ${i + 1}`}>
                    Remove
                  </button>
                )}
              </div>
              <Field label="First name" htmlFor={`child_name_${k}`}>
                <input id={`child_name_${k}`} name="child_name" required={i === 0} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Grade" htmlFor={`child_grade_${k}`}>
                  <input id={`child_grade_${k}`} name="child_grade" placeholder="e.g. 2nd, Pre-K" className={inputClass} />
                </Field>
                <Field label="School" htmlFor={`child_school_${k}`}>
                  <input id={`child_school_${k}`} name="child_school" placeholder="School name" className={inputClass} />
                </Field>
              </div>
            </Card>
          ))}
        </div>
        <button type="button" onClick={() => setKids([...kids, Math.max(...kids) + 1])} className="mt-3 inline-flex items-center gap-1.5 px-1 text-sm font-semibold text-indigo-600">
          <Icon name="plus" className="h-4 w-4" /> Add another child
        </button>
      </div>

      <FormError message={state?.error} />
      <SubmitButton className="w-full" pendingText="Setting up…">Create our School Hub</SubmitButton>
    </form>
  );
}
