import Link from "next/link";

export const metadata = { title: "Privacy · School Hub" };

/** Plain-language data handling summary for pilot families. Not legal advice; to be reviewed before an external pilot. */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-5 py-8 text-[15px] leading-relaxed text-slate-700">
      <Link href="/" className="text-sm font-medium text-indigo-600">← School Hub</Link>
      <h1 className="text-2xl font-semibold text-slate-900">How School Hub handles your family&apos;s data</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Pilot draft — reviewed by the founders, not yet by a lawyer.</p>
      <h2 className="pt-2 text-lg font-semibold text-slate-900">What we store</h2>
      <p>Your family&apos;s names, children&apos;s first names, grades and schools, and the school information you add or connect: photos, PDFs, messages, the events and tasks extracted from them, and who did what (activity log).</p>
      <h2 className="pt-2 text-lg font-semibold text-slate-900">Who can see it</h2>
      <p>Only the parents and caregivers in your family workspace. Every database row is protected by family-level access rules, and uploaded files are stored privately. School Hub staff access data only to fix problems you report.</p>
      <h2 className="pt-2 text-lg font-semibold text-slate-900">Service providers</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Supabase</b> — database, login and file storage.</li>
        <li><b>Vercel</b> — hosting.</li>
        <li><b>Anthropic (Claude)</b> — reads documents and messages you submit to extract dates and tasks. Under Anthropic&apos;s commercial API terms, inputs aren&apos;t used to train models.</li>
        <li><b>Google</b> (only if you connect Gmail) — read-only access to emails from school senders you list.</li>
        <li><b>Twilio</b> (only if you forward texts) — receives the texts you forward.</li>
      </ul>
      <h2 className="pt-2 text-lg font-semibold text-slate-900">What we never do</h2>
      <p>We never ask for school-app passwords, sell data, show ads, send or delete your email, or contact schools on your behalf.</p>
      <h2 className="pt-2 text-lg font-semibold text-slate-900">Your control</h2>
      <p>Delete any item or original document, disconnect Gmail, set originals to auto-delete (90 days to 1 year), export everything, or delete your whole family workspace from Settings → Your data.</p>
    </div>
  );
}
