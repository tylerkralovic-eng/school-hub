"use client";

import { useActionState, useState } from "react";
import { saveItem } from "@/app/actions/items";
import { FormError, SubmitButton } from "@/components/forms";
import { Field, inputClass } from "@/components/ui";

export interface ItemFormValues {
  id?: string;
  kind: "event" | "task" | "announcement";
  category: string;
  title: string;
  details: string;
  who: string;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  location: string;
  assigneeId: string;
}

const CATS: [string, string][] = [
  ["general", "General"], ["closure", "School closed"], ["early_dismissal", "Early dismissal"], ["activity", "Activity"], ["permission_form", "Permission form"],
  ["payment", "Payment"], ["supplies", "Supplies"], ["teacher_request", "Teacher request"], ["lunch", "Lunch"], ["reminder", "Reminder"],
];

export function ItemForm({ values, whoOptions, members, back }: { values: ItemFormValues; whoOptions: { value: string; label: string }[]; members: { id: string; name: string }[]; back: string }) {
  const [state, action] = useActionState(saveItem, undefined);
  const [kind, setKind] = useState(values.kind);
  return (
    <form action={action} className="space-y-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="back" value={back} />
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1" role="radiogroup" aria-label="Type">
        {([["event", "Event"], ["task", "To do"], ["announcement", "Notice"]] as const).map(([v, l]) => (
          <label key={v} className={`cursor-pointer rounded-lg py-2 text-center text-sm font-semibold ${kind === v ? "bg-white shadow-sm" : "text-slate-600"}`}>
            <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="sr-only" />{l}
          </label>
        ))}
      </div>
      <Field label="Title" htmlFor="title"><input id="title" name="title" defaultValue={values.title} required className={inputClass} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={kind === "task" ? "Due date" : "Date"} htmlFor="date"><input id="date" type="date" name="date" defaultValue={values.date} required={kind === "event"} className={inputClass} /></Field>
        <Field label="Time" htmlFor="time" hint={kind === "event" ? "Empty = all day" : undefined}><input id="time" type="time" name="time" defaultValue={values.time} className={inputClass} /></Field>
      </div>
      {kind === "event" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="End date" htmlFor="endDate"><input id="endDate" type="date" name="endDate" defaultValue={values.endDate} className={inputClass} /></Field>
          <Field label="End time" htmlFor="endTime"><input id="endTime" type="time" name="endTime" defaultValue={values.endTime} className={inputClass} /></Field>
        </div>
      )}
      <Field label="For" htmlFor="childId">
        <select id="childId" name="childId" defaultValue={values.who} className={inputClass}>
          <option value="">Whole family</option>
          {whoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      {kind === "task" && (
        <Field label="Who's handling it?" htmlFor="assigneeId">
          <select id="assigneeId" name="assigneeId" defaultValue={values.assigneeId} className={inputClass}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Category" htmlFor="category">
        <select id="category" name="category" defaultValue={values.category} className={inputClass}>
          {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Location" htmlFor="location"><input id="location" name="location" defaultValue={values.location} className={inputClass} /></Field>
      <Field label="Details" htmlFor="details"><textarea id="details" name="details" rows={4} defaultValue={values.details} className={inputClass} /></Field>
      <FormError message={state?.error} />
      <SubmitButton className="w-full" pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
