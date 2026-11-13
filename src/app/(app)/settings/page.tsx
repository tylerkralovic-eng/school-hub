import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { createInvite, deleteChild, deleteSchool, removeMember, revokeInvite, saveChild, saveSchool, updateFamily, updateProfile } from "@/app/actions/family";
import { ActionForm, ConfirmButton } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { Card, ChildAvatar, Field, PageTitle, SectionHeader, buttonClass, inputClass } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { COMMON_TIMEZONES, fmt } from "@/lib/time";
import { CHILD_COLORS } from "@/lib/types";

export const metadata = { title: "Settings · School Hub" };

export default async function SettingsPage() {
  const ctx = await requireFamily();
  const isOwner = ctx.me.role === "owner";
  const { data: invites } = await ctx.supabase
    .from("family_invites")
    .select("*")
    .eq("family_id", ctx.family.id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-7 pb-6">
      <PageTitle title="Settings" subtitle={ctx.email} />

      {/* Children */}
      <section>
        <SectionHeader title="Children" />
        <div className="space-y-3">
          {ctx.children.map((c) => (
            <Card key={c.id} className="p-4">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                  <ChildAvatar child={c} size="h-9 w-9 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.first_name}</p>
                    <p className="text-sm text-slate-500">
                      {[c.grade, ctx.schools.find((s) => s.id === c.school_id)?.name].filter(Boolean).join(" · ") || "No school set"}
                    </p>
                  </div>
                  <Icon name="edit" className="h-4 w-4 text-slate-400" />
                </summary>
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <ActionForm action={saveChild}>
                    <input type="hidden" name="id" value={c.id} />
                    <ChildFields child={c} schools={ctx.schools} />
                  </ActionForm>
                  <form action={deleteChild}>
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmButton message={`Remove ${c.first_name}? Their items stay but won't be linked to them.`} className="text-sm font-medium text-rose-600">
                      Remove {c.first_name}
                    </ConfirmButton>
                  </form>
                </div>
              </details>
            </Card>
          ))}
          <Card className="p-4">
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-indigo-600 [&::-webkit-details-marker]:hidden">
                <Icon name="plus" className="h-4 w-4" /> Add a child
              </summary>
              <div className="mt-4">
                <ActionForm action={saveChild} resetOnSuccess submitLabel="Add child">
                  <ChildFields schools={ctx.schools} />
                </ActionForm>
              </div>
            </details>
          </Card>
        </div>
      </section>

      {/* Schools */}
      <section>
        <SectionHeader title="Schools" />
        <Card className="divide-y divide-slate-100">
          {ctx.schools.map((s) => (
            <details key={s.id} className="px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] [&::-webkit-details-marker]:hidden">
                <span>{s.name}</span>
                <Icon name="edit" className="h-4 w-4 text-slate-400" />
              </summary>
              <div className="mt-3 space-y-3">
                <ActionForm action={saveSchool}>
                  <input type="hidden" name="id" value={s.id} />
                  <SchoolFields name={s.name} shortName={s.short_name ?? ""} />
                </ActionForm>
                <form action={deleteSchool}>
                  <input type="hidden" name="id" value={s.id} />
                  <ConfirmButton message={`Remove ${s.name}?`} className="text-sm font-medium text-rose-600">Remove school</ConfirmButton>
                </form>
              </div>
            </details>
          ))}
          <details className="px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-indigo-600 [&::-webkit-details-marker]:hidden">
              <Icon name="plus" className="h-4 w-4" /> Add a school
            </summary>
            <div className="mt-3">
              <ActionForm action={saveSchool} resetOnSuccess submitLabel="Add school">
                <SchoolFields />
              </ActionForm>
            </div>
          </details>
        </Card>
      </section>

      {/* Parents */}
      <section>
        <SectionHeader title="Parents & caregivers" />
        <Card className="divide-y divide-slate-100">
          {ctx.members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">{m.display_name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.display_name} {m.user_id === ctx.userId && <span className="text-sm font-normal text-slate-500">(you)</span>}
                </p>
                <p className="truncate text-sm text-slate-500">{m.email} · {m.role === "owner" ? "Owner" : "Parent"}</p>
              </div>
              {isOwner && m.user_id !== ctx.userId && (
                <form action={removeMember}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <ConfirmButton message={`Remove ${m.display_name} from your family? They will lose access immediately.`} className="text-sm font-medium text-rose-600">Remove</ConfirmButton>
                </form>
              )}
            </div>
          ))}
          {(invites ?? []).map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400">
                <Icon name="mail" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{inv.email}</p>
                <p className="text-sm text-slate-500">
                  {new Date(inv.expires_at) < new Date() ? "Invitation expired" : `Invited · expires ${fmt(inv.expires_at, ctx.family.timezone, { month: "short", day: "numeric" })}`}
                </p>
              </div>
              <form action={revokeInvite}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="text-sm font-medium text-slate-500">Cancel</button>
              </form>
            </div>
          ))}
          <div className="px-4 py-4">
            <p className="mb-3 text-sm text-slate-600">Invite another parent or caregiver. They get their own login and see everything your family sees.</p>
            <ActionForm action={createInvite} submitLabel="Send invitation" pendingText="Creating…" resetOnSuccess>
              <Field label="Their email" htmlFor="invite_email">
                <input id="invite_email" name="email" type="email" required className={inputClass} />
              </Field>
            </ActionForm>
          </div>
        </Card>
      </section>

      {/* Profile */}
      <section>
        <SectionHeader title="You" />
        <Card className="p-4">
          <ActionForm action={updateProfile}>
            <Field label="Your name" htmlFor="display_name">
              <input id="display_name" name="display_name" defaultValue={ctx.me.display_name} required className={inputClass} />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="digest" defaultChecked={ctx.me.digest_enabled} className="mt-0.5 h-5 w-5 rounded border-slate-300 accent-indigo-600" />
              <span>
                <span className="font-medium">Morning email digest</span>
                <span className="block text-slate-500">Today&apos;s events, tasks due soon and items to review.</span>
              </span>
            </label>
          </ActionForm>
        </Card>
      </section>

      {/* Family */}
      <section>
        <SectionHeader title="Family" />
        <Card className="p-4">
          {isOwner ? (
            <ActionForm action={updateFamily}>
              <Field label="Family name" htmlFor="fam_name">
                <input id="fam_name" name="name" defaultValue={ctx.family.name} required className={inputClass} />
              </Field>
              <Field label="Time zone" htmlFor="fam_tz">
                <select id="fam_tz" name="timezone" defaultValue={ctx.family.timezone} className={inputClass}>
                  {[...new Set([ctx.family.timezone, ...COMMON_TIMEZONES])].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Keep original documents" htmlFor="retention" hint="Uploaded photos, PDFs and messages are deleted after this period. Extracted events and tasks are kept.">
                <select id="retention" name="retention" defaultValue={ctx.family.document_retention_days?.toString() ?? ""} className={inputClass}>
                  <option value="">Until I delete them</option>
                  <option value="90">90 days</option>
                  <option value="180">6 months</option>
                  <option value="365">1 year</option>
                </select>
              </Field>
            </ActionForm>
          ) : (
            <p className="text-sm text-slate-600">{ctx.family.name} · {ctx.family.timezone}. Only the family owner can change these settings.</p>
          )}
        </Card>
      </section>

      <section>
        <SectionHeader title="Privacy & data" />
        <Card className="divide-y divide-slate-100">
          <Link href="/settings/data" className="flex items-center justify-between px-4 py-3 text-[15px]">
            Export or delete your data <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
          </Link>
          <Link href="/settings/activity" className="flex items-center justify-between px-4 py-3 text-[15px]">
            Activity log <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
          </Link>
          <Link href="/privacy" className="flex items-center justify-between px-4 py-3 text-[15px]">
            How School Hub handles your data <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
          </Link>
        </Card>
      </section>

      <form action={signOut}>
        <button className={`${buttonClass.secondary} w-full`}>Sign out</button>
      </form>
    </div>
  );
}

function ChildFields({ child, schools }: { child?: { first_name: string; grade: string | null; school_id: string | null; aliases: string[]; color: string }; schools: { id: string; name: string }[] }) {
  const p = child ? child.first_name : "new";
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor={`fn_${p}`}>
          <input id={`fn_${p}`} name="first_name" defaultValue={child?.first_name} required className={inputClass} />
        </Field>
        <Field label="Grade" htmlFor={`gr_${p}`}>
          <input id={`gr_${p}`} name="grade" defaultValue={child?.grade ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="School" htmlFor={`sc_${p}`}>
        <select id={`sc_${p}`} name="school_id" defaultValue={child?.school_id ?? ""} className={inputClass}>
          <option value="">—</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Other names to recognize" htmlFor={`al_${p}`} hint="Comma-separated: nicknames, teacher names, classroom names. Helps match messages to this child.">
        <input id={`al_${p}`} name="aliases" defaultValue={child?.aliases.join(", ")} placeholder="e.g. Ms. Lopez, Room 12, Bumblebees" className={inputClass} />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Color</legend>
        <div className="flex gap-2">
          {CHILD_COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} defaultChecked={child ? child.color === c : undefined} className="peer sr-only" />
              <span className={`block h-7 w-7 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-slate-900 peer-focus-visible:ring-2 ${{ violet: "bg-violet-500", teal: "bg-teal-500", amber: "bg-amber-500", rose: "bg-rose-500", sky: "bg-sky-500", emerald: "bg-emerald-500" }[c]}`} />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function SchoolFields({ name = "", shortName = "" }: { name?: string; shortName?: string }) {
  const p = name || "new";
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2">
        <Field label="School name" htmlFor={`sn_${p}`}>
          <input id={`sn_${p}`} name="name" defaultValue={name} required className={inputClass} />
        </Field>
      </div>
      <Field label="Short name" htmlFor={`ss_${p}`}>
        <input id={`ss_${p}`} name="short_name" defaultValue={shortName} className={inputClass} />
      </Field>
    </div>
  );
}
