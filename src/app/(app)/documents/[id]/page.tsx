import { notFound } from "next/navigation";
import { deleteDocument } from "@/app/actions/ingest";
import { ConfirmButton } from "@/components/ActionForm";
import { Card, PageTitle, buttonClass } from "@/components/ui";
import { platformName } from "@/lib/platforms";
import { requireFamily } from "@/lib/server/context";
import { inboxLink } from "@/lib/server/items";
import { fmt } from "@/lib/time";
import { CHANNEL_LABELS } from "@/lib/types";

export const metadata = { title: "Original · School Hub" };

/** Shows the preserved original: image/PDF via a short-lived signed URL, or the message text. */
export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireFamily();
  const { data: doc } = await ctx.supabase.from("source_documents").select("*").eq("id", id).eq("family_id", ctx.family.id).maybeSingle();
  if (!doc) notFound();
  const signed = doc.storage_path ? (await ctx.supabase.storage.from("documents").createSignedUrl(doc.storage_path, 300)).data?.signedUrl : null;
  const tz = ctx.family.timezone;

  return (
    <div className="space-y-5 pb-6">
      <PageTitle title={doc.title || "Original"} subtitle={`${CHANNEL_LABELS[doc.channel]}${doc.platform_key ? ` · ${platformName(doc.platform_key)}` : ""}${doc.sender ? ` · ${doc.sender}` : ""} · received ${fmt(doc.received_at, tz, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`} />
      {doc.ai_summary && <p className="px-1 text-sm text-slate-600">{doc.ai_summary}</p>}
      {inboxLink(doc) && <a href={inboxLink(doc)!} target="_blank" rel="noopener noreferrer" className={`${buttonClass.primary} w-full`}>Open in Gmail ({doc.origin_account})</a>}
      {signed && doc.mime_type?.startsWith("image/") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signed} alt={doc.title ?? "Original document"} className="w-full rounded-2xl border border-slate-200 bg-white" />
      )}
      {signed && doc.mime_type === "application/pdf" && (
        <a href={signed} target="_blank" rel="noopener noreferrer" className={`${buttonClass.secondary} w-full`}>Open PDF</a>
      )}
      {doc.storage_path && !signed && <p className="text-sm text-rose-700">The original file is no longer available.</p>}
      {doc.text_content && (
        <Card className="p-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">{doc.text_content}</pre>
        </Card>
      )}
      {!doc.storage_path && !doc.text_content && <p className="text-sm text-slate-500">The original content was removed by your retention setting.</p>}
      <form action={deleteDocument}>
        <input type="hidden" name="id" value={doc.id} />
        <input type="hidden" name="back" value="/add" />
        <ConfirmButton message="Delete this original? Items already added stay, but lose this source link." className={`${buttonClass.danger} w-full`}>Delete original</ConfirmButton>
      </form>
    </div>
  );
}
