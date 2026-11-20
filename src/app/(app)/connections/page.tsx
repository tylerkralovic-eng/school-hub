import Link from "next/link";
import { addSenderRule, createIngestToken, deleteSenderRule, disconnectGmail, getConnectStatus, removePlatform, revokeIngestToken, savePlatform, syncGmailNow, unlinkPhone } from "@/app/actions/connections";
import { rotateCalendarToken } from "@/app/actions/family";
import { ActionForm, ConfirmButton } from "@/components/ActionForm";
import { ConnectSteps } from "@/components/ConnectSteps";
import { CopyField } from "@/components/CopyField";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/forms";
import { Card, ChildChip, Notice, PageTitle, SectionHeader, buttonClass, inputClass } from "@/components/ui";
import { env, features } from "@/lib/env";
import { PLATFORMS } from "@/lib/platforms";
import { requireFamily } from "@/lib/server/context";
import { platformCoverage } from "@/lib/server/coverage";
import { receivedLabel } from "@/lib/time";

export const metadata = { title: "Connect · School Hub" };
export const maxDuration = 300;

const GMAIL_MSG: Record<string, { tone: "ok" | "warn" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Gmail is connected. New school emails will show up for review on their own." },
  denied: { tone: "warn", text: "Gmail access wasn't granted. You can try again any time." },
  state_mismatch: { tone: "error", text: "The Google sign-in couldn't be verified. Please try again." },
  scope_missing: { tone: "warn", text: "Please allow School Hub to read email when Google asks — otherwise school emails can't be found." },
  not_configured: { tone: "warn", text: "Gmail isn't switched on for this School Hub yet." },
  error: { tone: "error", text: "Couldn't connect Gmail. Please try again." },
};

const CH_LABEL: Record<string, string> = { email: "Email", sms: "Text", push: "Push", app: "In app only" };

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFamily();
  const tz = ctx.family.timezone;
  const [status, gmail, rules, phones, tokens, platforms, lastByPlatform] = await Promise.all([
    getConnectStatus(),
    ctx.supabase.from("gmail_connections").select("*").eq("family_id", ctx.family.id),
    ctx.supabase.from("sender_rules").select("*").eq("family_id", ctx.family.id).order("created_at"),
    ctx.supabase.from("member_phones").select("*").eq("family_id", ctx.family.id).not("verified_at", "is", null),
    ctx.supabase.from("ingest_tokens").select("*").eq("user_id", ctx.userId),
    ctx.supabase.from("family_platforms").select("*").eq("family_id", ctx.family.id),
    ctx.supabase.from("source_documents").select("platform_key, received_at").eq("family_id", ctx.family.id).not("platform_key", "is", null).order("received_at", { ascending: false }).limit(200),
  ]);
  const conns = gmail.data ?? [];
  const anyGmail = conns.some((c) => c.status === "connected");
  const anyPhone = (phones.data ?? []).length > 0;
  const used = PLATFORMS.filter((p) => platforms.data?.some((x) => x.platform_key === p.key));
  const unused = PLATFORMS.filter((p) => !used.includes(p));
  const whoOpts = [...ctx.children.map((c) => ({ value: c.id, label: c.first_name })), ...ctx.schools.map((s) => ({ value: `school:${s.id}`, label: s.short_name || s.name }))];
  const memberName = (id: string) => ctx.members.find((m) => m.user_id === id)?.display_name ?? "Parent";
  const unavailable = [!features.sms() && "texting School Hub", !features.gmail() && "reading Gmail", !features.ai() && "reading documents with AI"].filter(Boolean) as string[];

  return (
    <div className="space-y-7 pb-6">
      <PageTitle title="Connect" subtitle="A few taps and school info starts flowing in on its own." />
      {sp.gmail && GMAIL_MSG[sp.gmail] && <Notice tone={GMAIL_MSG[sp.gmail].tone}>{GMAIL_MSG[sp.gmail].text}</Notice>}

      <ConnectSteps initial={status} />

      <Link href="/add" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><Icon name="camera" className="h-5 w-5" /></span>
        <span className="flex-1">
          <span className="block text-[16px] font-semibold">Snap, upload or say it</span>
          <span className="text-sm text-slate-500">Paper calendars, flyers, screenshots from any app.</span>
        </span>
        <Icon name="chevronRight" className="h-5 w-5 text-slate-400" />
      </Link>

      {used.length > 0 && (
        <section>
          <SectionHeader title="Your school apps" />
          <Card className="divide-y divide-slate-100">
            {used.map((p) => {
              const fp = platforms.data!.find((x) => x.platform_key === p.key)!;
              const cov = platformCoverage({ channels: fp.notification_channels, gmailConnected: anyGmail, hasSenderRule: (rules.data ?? []).some((r) => r.platform_key === p.key), smsReady: features.sms(), phoneLinked: anyPhone });
              const tip = cov.level === "auto" ? "Arrives automatically by email" : fp.notification_channels.includes("email") && features.gmail() ? "Connect Gmail above to get these automatically" : fp.notification_channels.includes("sms") && features.sms() ? "Forward its texts to School Hub" : "Screenshot important posts and share them";
              return (
                <div key={p.key} className="flex items-center gap-3 px-4 py-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cov.level === "auto" ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name} <span className="font-normal text-slate-500">{fp.child_ids.map((id) => ctx.children.find((c) => c.id === id)?.first_name).filter(Boolean).join(", ")}</span></p>
                    <p className="text-sm text-slate-500">{tip}</p>
                  </div>
                </div>
              );
            })}
          </Card>
          <p className="mt-2 px-1 text-xs text-slate-500">School Hub never asks for these apps&apos; passwords and has no direct connection to them — it sees what reaches you by email, text or screenshot.</p>
        </section>
      )}

      {unavailable.length > 0 && <p className="px-1 text-xs text-slate-400">Coming soon to your School Hub: {unavailable.join(", ")}.</p>}

      <details className="group rounded-2xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
          Advanced settings <Icon name="chevronDown" className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-6 border-t border-slate-100 px-4 py-4 text-sm text-slate-600">
          {/* Gmail details */}
          {features.gmail() && (
            <section className="space-y-2">
              <h3 className="font-semibold text-slate-900">Gmail accounts</h3>
              {conns.length === 0 && <p>None connected.</p>}
              {conns.map((c) => (
                <div key={c.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="font-medium text-slate-800">{c.google_email} <span className="font-normal text-slate-500">· {memberName(c.user_id)}</span></p>
                  <p className="text-xs">{c.last_success_at ? `Last checked ${receivedLabel(c.last_success_at, tz)}` : "Not checked yet"} · {c.messages_seen} school emails read</p>
                  {c.last_error && <p className="text-xs font-medium text-rose-700">{c.last_error}</p>}
                  {c.user_id === ctx.userId && <form action={disconnectGmail} className="mt-1"><input type="hidden" name="id" value={c.id} /><ConfirmButton message="Disconnect Gmail? School Hub will stop reading new emails." className="text-xs font-semibold text-rose-600">Disconnect</ConfirmButton></form>}
                </div>
              ))}
              {conns.length > 0 && <form action={syncGmailNow}><SubmitButton variant="secondary" pendingText="Checking…" className="!py-1.5 text-sm"><Icon name="refresh" className="h-4 w-4" />Check email now</SubmitButton></form>}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="font-semibold text-slate-900">School email senders ({rules.data?.length ?? 0})</h3>
            <p className="text-xs">Only email from these addresses or domains is read. Setup adds your schools&apos; domains automatically.</p>
            <ul className="divide-y divide-slate-100">
              {(rules.data ?? []).map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{r.pattern}</span>
                  {r.platform_key && <span className="text-xs text-slate-500">{PLATFORMS.find((p) => p.key === r.platform_key)?.name}</span>}
                  {r.child_id && ctx.children.find((c) => c.id === r.child_id) && <ChildChip child={ctx.children.find((c) => c.id === r.child_id)!} />}
                  <form action={deleteSenderRule}><input type="hidden" name="id" value={r.id} /><button aria-label={`Remove ${r.pattern}`} className="p-1 text-slate-400"><Icon name="x" className="h-4 w-4" /></button></form>
                </li>
              ))}
            </ul>
            <ActionForm action={addSenderRule} submitLabel="Add sender" resetOnSuccess className="space-y-2">
              <input name="pattern" required placeholder="teacher@school.org or @district.org" aria-label="Sender email or domain" className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <select name="platform" aria-label="Platform" className={`${inputClass} text-sm`}><option value="">App (optional)</option>{PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
                <select name="who" aria-label="For" className={`${inputClass} text-sm`}><option value="">For: let AI decide</option>{whoOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              </div>
            </ActionForm>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-slate-900">School apps</h3>
            {[...used, ...unused].map((p) => {
              const fp = platforms.data?.find((x) => x.platform_key === p.key);
              const lastSeen = lastByPlatform.data?.find((d) => d.platform_key === p.key)?.received_at;
              return (
                <details key={p.key} className="rounded-xl border border-slate-100 px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                    <span><b className="text-slate-800">{p.name}</b> <span className="text-xs text-slate-500">{fp ? `· ${fp.notification_channels.map((c) => CH_LABEL[c]).join(", ")}` : "· not used"}</span></span>
                    <Icon name="edit" className="h-3.5 w-3.5 text-slate-400" />
                  </summary>
                  <p className="mt-1 text-xs">{p.purpose}. {p.directIntegrationNote}{lastSeen ? ` Last update ${receivedLabel(lastSeen, tz)}.` : ""}</p>
                  <ActionForm action={savePlatform} className="mt-2 space-y-2">
                    <input type="hidden" name="platform" value={p.key} />
                    <fieldset><legend className="text-xs font-medium">For</legend><div className="mt-1 flex flex-wrap gap-3">{ctx.children.map((c) => <label key={c.id} className="flex items-center gap-1.5"><input type="checkbox" name="child" value={c.id} defaultChecked={fp?.child_ids.includes(c.id)} className="h-4 w-4 accent-indigo-600" />{c.first_name}</label>)}</div></fieldset>
                    <fieldset><legend className="text-xs font-medium">It notifies us by</legend><div className="mt-1 flex flex-wrap gap-3">{["email", "sms", "push", "app"].map((ch) => <label key={ch} className="flex items-center gap-1.5"><input type="checkbox" name="channel" value={ch} defaultChecked={fp ? fp.notification_channels.includes(ch) : p.typicalChannels.includes(ch as "email")} className="h-4 w-4 accent-indigo-600" />{CH_LABEL[ch]}</label>)}</div></fieldset>
                  </ActionForm>
                  {fp && <form action={removePlatform} className="mt-1"><input type="hidden" name="platform" value={p.key} /><button className="text-xs font-semibold text-slate-500">We don&apos;t use this</button></form>}
                </details>
              );
            })}
          </section>

          {features.sms() && (phones.data ?? []).some((p) => p.user_id === ctx.userId) && (
            <section className="space-y-2">
              <h3 className="font-semibold text-slate-900">Linked phone</h3>
              {(phones.data ?? []).filter((p) => p.user_id === ctx.userId).map((p) => (
                <div key={p.id} className="flex items-center justify-between"><span>{p.phone_e164}</span><form action={unlinkPhone}><input type="hidden" name="id" value={p.id} /><button className="text-xs font-semibold text-rose-600">Unlink</button></form></div>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="font-semibold text-slate-900">Calendar link</h3>
            <p className="text-xs">Anyone with this link can see your family&apos;s school calendar — keep it private.</p>
            <CopyField label="Calendar link" value={status.icsUrl} />
            {ctx.me.role === "owner" && <form action={rotateCalendarToken}><ConfirmButton message="Create a new link? The old one stops working and you'll need to add it again." className={buttonClass.ghost}>Reset link</ConfirmButton></form>}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-slate-900">Share from other apps</h3>
            <p><b>Android:</b> in Chrome, menu → Install app. School Hub then appears when you tap Share.</p>
            <p><b>iPhone:</b> use an Apple Shortcut with a personal key (setup guide in the docs). Not yet tested on a real iPhone.</p>
            <ul className="divide-y divide-slate-100">
              {(tokens.data ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <span>{t.label} <span className="text-xs text-slate-500">· {t.last_used_at ? `used ${receivedLabel(t.last_used_at, tz)}` : "never used"}</span></span>
                  <form action={revokeIngestToken}><input type="hidden" name="id" value={t.id} /><button className="text-xs font-semibold text-rose-600">Revoke</button></form>
                </li>
              ))}
            </ul>
            <ActionForm action={createIngestToken} submitLabel="Create Shortcut key" className="space-y-2">
              <input name="label" placeholder="Name, e.g. Tyler's iPhone" aria-label="Key name" className={inputClass} />
            </ActionForm>
            <p className="text-xs">Shortcut action: POST {env.appUrl()}/api/ingest with header Authorization: Bearer &lt;key&gt; and form field files.</p>
          </section>

          <p className="text-xs text-slate-400">Outlook / Microsoft 365: planned.</p>
        </div>
      </details>
    </div>
  );
}
