import { ItemForm } from "@/components/ItemForm";
import { PageTitle } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";
import { whoOptions } from "@/lib/server/itemform";

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ kind?: string; date?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFamily();
  const kind = sp.kind === "task" || sp.kind === "announcement" ? sp.kind : "event";
  return (
    <div className="space-y-5 pb-6">
      <PageTitle title={kind === "task" ? "New to-do" : kind === "event" ? "New event" : "New notice"} />
      <ItemForm
        back={kind === "event" ? "/calendar" : kind === "task" ? "/tasks" : "/inbox"}
        values={{ kind, category: "general", title: "", details: "", who: "", date: sp.date ?? "", time: "", endDate: "", endTime: "", location: "", assigneeId: "" }}
        whoOptions={whoOptions(ctx)}
        members={ctx.members.map((m) => ({ id: m.user_id, name: m.display_name }))}
      />
    </div>
  );
}
