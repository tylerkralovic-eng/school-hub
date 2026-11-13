import { deleteAccount, deleteFamily } from "@/app/actions/data";
import { ConfirmButton } from "@/components/ActionForm";
import { Card, Notice, PageTitle, SectionHeader, buttonClass, inputClass } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";

export const metadata = { title: "Your data · School Hub" };

export default async function DataPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await requireFamily();
  const owner = ctx.me.role === "owner";
  return (
    <div className="space-y-6 pb-6">
      <PageTitle title="Your data" subtitle="Your family owns its data. Export or delete it any time." />
      {error === "confirm" && <Notice tone="error">Type your family name exactly to confirm.</Notice>}
      {error === "owner" && <Notice tone="error">You own this family and others are members. Remove them or delete the family first.</Notice>}
      <section>
        <SectionHeader title="Export" />
        <Card className="p-4 text-sm text-slate-600">
          <p>Download everything School Hub has stored for {ctx.family.name}: children, schools, events, tasks, sources and review history (JSON).</p>
          <a href="/api/export" className={`${buttonClass.secondary} mt-3`}>Download my data</a>
        </Card>
      </section>
      <section>
        <SectionHeader title="Delete" />
        <Card className="space-y-4 p-4 text-sm text-slate-600">
          <p>Delete individual items, documents or connections from their own screens. Deleting an original document keeps the events and tasks you approved from it.</p>
          {owner ? (
            <form action={deleteFamily} className="space-y-2 border-t border-slate-100 pt-4">
              <p className="font-semibold text-rose-700">Delete the entire family workspace</p>
              <p>Permanently removes all children, events, tasks, documents, uploaded files, Gmail connections and members&apos; access. This can&apos;t be undone.</p>
              <label className="block text-xs font-medium">Type <b>{ctx.family.name}</b> to confirm
                <input name="confirm" required className={`${inputClass} mt-1`} autoComplete="off" />
              </label>
              <ConfirmButton message="Permanently delete your family's School Hub? This cannot be undone." className={buttonClass.danger}>Delete family workspace</ConfirmButton>
            </form>
          ) : null}
          <form action={deleteAccount} className="space-y-2 border-t border-slate-100 pt-4">
            <p className="font-semibold text-rose-700">Delete my account</p>
            <p>{owner ? "As the owner, deleting your account also deletes the family workspace (only possible when you're the only member)." : "Removes your login. Your family's shared data stays with the other parents."}</p>
            <ConfirmButton message="Delete your School Hub account?" className={buttonClass.danger}>Delete my account</ConfirmButton>
          </form>
        </Card>
      </section>
    </div>
  );
}
