import { TrackingSetup } from "@/components/behavior/TrackingSetup";
import { PageTitle } from "@/components/ui";
import { requireFamily } from "@/lib/server/context";

export const metadata = { title: "Set up points · School Hub" };

export default async function PointsSetupPage() {
  const ctx = await requireFamily();
  return (
    <div className="space-y-5 pb-6">
      <PageTitle title="Track school days" subtitle="Works with whatever each school uses." />
      <TrackingSetup kidNames={ctx.children.map((c) => c.first_name)} />
    </div>
  );
}
