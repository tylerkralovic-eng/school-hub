import { notFound } from "next/navigation";
import { deleteItem } from "@/app/actions/items";
import { ConfirmButton } from "@/components/ActionForm";
import { ItemCard } from "@/components/ItemCard";
import { ItemForm } from "@/components/ItemForm";
import { PageTitle, SectionHeader, buttonClass } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { ITEM_SELECT, type ItemView } from "@/lib/server/items";
import { toFormValues, whoOptions } from "@/lib/server/itemform";

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }> }) {
  const { id } = await params;
  const { back: backParam } = await searchParams;
  const ctx = await requireFamily();
  const { data } = await ctx.supabase.from("items").select(ITEM_SELECT).eq("id", id).eq("family_id", ctx.family.id).maybeSingle();
  if (!data) notFound();
  const item = data as ItemView;
  const back = backParam && backParam.startsWith("/") && !backParam.startsWith("//") ? backParam : item.kind === "event" ? "/calendar" : item.kind === "task" ? "/tasks" : "/inbox";

  return (
    <div className="space-y-6 pb-6">
      <PageTitle title={item.title} />
      <ItemCard item={item} ctx={ctx} />
      <section>
        <SectionHeader title="Edit" />
        <ItemForm back={back} values={toFormValues(item, ctx.family.timezone)} whoOptions={whoOptions(ctx)} members={ctx.members.map((m) => ({ id: m.user_id, name: m.display_name }))} />
      </section>
      <form action={deleteItem}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="back" value={back} />
        <ConfirmButton message="Delete this item for everyone in your family?" className={`${buttonClass.danger} w-full`}>Delete</ConfirmButton>
      </form>
    </div>
  );
}
