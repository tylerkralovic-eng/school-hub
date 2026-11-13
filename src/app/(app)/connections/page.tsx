import { addSenderRule, createIngestToken, deleteSenderRule, disconnectGmail, removePlatform, revokeIngestToken, savePlatform, startPhoneLink, syncGmailNow, unlinkPhone } from "@/app/actions/connections";
import { rotateCalendarToken } from "@/app/actions/family";
import { ActionForm, ConfirmButton } from "@/components/ActionForm";
import { CopyField } from "@/components/CopyField";
import { Icon, type IconName } from "@/components/Icon";
import { SubmitButton } from "@/components/forms";
import { Card, ChildChip, Notice, PageTitle, SectionHeader, buttonClass, inputClass } from "@/components/ui";
import { env, features } from "@/lib/env";
import { PLATFORMS } from "@/lib/platforms";
import { requireFamily } from "@/lib/server/context";
import { platformCoverage } from "@/lib/server/coverage";
import { receivedLabel } from "@/lib/time";

export const metadata = { title: "Connections · School Hub" };
export const maxDuration = 300;

const GMAIL_MSG: Record<string, { tone: "ok" | "warn" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Gmail connected. Add your school senders below, then tap Sync now." },
  denied: { tone: "warn", text: "Gmail access wasn't granted." },
  state_mismatch: { tone: "error", text: "The Google sign-in couldn't be verified. Please try again." },
  scope_missing: { tone: "warn", text: "Please allow School Hub to read email when Google asks — otherwise school emails can't be found." },
  not_configured: { tone: "warn", text: "Gmail isn't set up on this server yet (Google OAuth credentials missing)." },
  error: { tone: "error", text: "Couldn't connect Gmail. Please try again." },
};

function Status({ tone, children }: { tone: "ok" | "warn" | "off" | "error"; children: React.ReactNode }) {
  const s = { ok: "bg-emerald-50 text-emerald-700", warn: "bg-amber-50 text-amber-800", off: "bg-slate-100 text-slate-500", error: "bg-rose-50 text-rose-700" }[tone];
  const dot = { ok: "bg-emerald-500", warn: "bg-amber-500", off: "bg-slate-300", error: "bg-rose-500" }[tone];
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${s}`}><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{children}</span>;
}

function Channel({ icon, title, status, children, id }: { icon: IconName; title: string; status: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <Card className="p-4" >
      <div id={id} className="flex scroll-mt-24 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name={icon} className="h-5 w-5" /></span>
        <h3 className="flex-1 text-[15px] font-semibold">{title}</h3>
        {status}
      </div>
      <div className="mt-3 space-y-3 text-sm text-slate-600">{children}</div>
    </Card>
  );
}

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFamily();
  const tz = ctx.family.timezone;
  const [gmail, rules, phones, tokens, platforms, lastByChannel, lastByPlatform] = await Promise.all([
    ctx.supabase.from("gmail_connections").select("*").eq("family_id", ctx.family.id),
    ctx.supabase.from("sender_rules").select("*").eq("family_id", ctx.family.id).order("created_at"),
    ctx.supabase.from("member_phones").select("*").eq("family_id", ctx.family.id),
    ctx.supabase.from("ingest_tokens").select("*").eq("user_id", ctx.userId),
    ctx.supabase.from("family_platforms").select("*").eq("family_id", ctx.family.id),
    ctx.supabase.from("source_documents").select("channel, received_at").eq("family_id", ctx.family.id).order("received_at", { ascending: false }).limit(200),
    ctx.supabase.from("source_documents").select("platform_key, received_at").eq("family_id", ctx.family.id).not("platform_key", "is", null).order("received_at", { ascending: false }).limit(200),
  ]);
  const conns = gmail.data ?? [];
  const myConn = conns.find((c) => c.user_id === ctx.userId);
  const anyGmail = conns.some((c) => c.status === "connected");
  const myPhone = (phones.data ?? []).find((p) => p.user_id === ctx.userId && p.verified_at);
  const myPending = (phones.data ?? []).find((p) => p.user_id === ctx.userId && !p.verified_at && p.code_expires_at && new Date(p.code_expires_at) > new Date());
  const anyPhone = (phones.data ?? []).some((p) => p.verified_at);
  const last = (ch: string) => lastByChannel.data?.find((d) => d.channel === ch)?.received_at;
  const memberName = (id: string) => ctx.members.find((m) => m.user_id === id)?.display_name ?? "Parent";
  const icsUrl = `${env.appUrl()}/api/calendar/${ctx.family.calendar_token}.ics`;
  const whoOpts = [...ctx.children.map((c) => ({ value: c.id, label: c.first_name })), ...ctx.schools.map((s) => ({ value: `school:${s.id}`, label: s.short_name || s.name }))];

  return (
    <div className="space-y-7 pb-6">
      <PageTitle title="Connections" subtitle="How school information reaches School Hub — and what it can't see." />
      {sp.gmail && GMAIL_MSG[sp.gmail] && <Notice tone={GMAIL_MSG[sp.gmail].tone}>{GMAIL_MSG[sp.gmail].text}</Notice>}

      <section className="space-y-3">
        <SectionHeader title="Communication channels" />

        {/* Gmail */}
        <Channel id="gmail" icon="mail" title="Gmail" status={!features.gmail() ? <Status tone="off">Not set up</Status> : anyGmail ? <Status tone="ok">Connected</Status> : conns.some((c) => c.status === "error") ? <Status tone="error">Needs attention</Status> : <Status tone="off">Not connected</Status>}>
          {!features.gmail() ? (
            <p>Reading school emails needs Google OAuth credentials on the server. Until then, forward or paste emails in <b>Add</b>.</p>
          ) : (
            <>
              <p>Read-only access. School Hub only reads messages from the school senders you list, and never sends, deletes or changes email.</p>
              {conns.map((c) => (
                <div key={c.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-800">{c.google_email}</span>
                    <span className="shrink-0 text-xs text-slate-500">{memberName(c.user_id)}</span>
                  </div>
                  <p className="mt-1 text-xs">
                    {c.last_success_at ? `Last synced ${receivedLabel(c.last_success_at, tz)}` : "Not synced yet"} · {c.messages_seen} school emails read
                  </p>
                  {c.last_error && <p className="mt-1 text-xs font-medium text-rose-700">{c.last_error}</p>}
                  {c.user_id === ctx.userId && (
                    <form action={disconnectGmail} className="mt-2"><input type="hidden" name="id" value={c.id} /><ConfirmButton message="Disconnect Gmail? School Hub will stop reading new emails and revoke its access." className="text-xs font-semibold text-rose-600">Disconnect</ConfirmButton></form>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {!myConn || myConn.status === "error" ? <a href="/api/gmail/connect" className={buttonClass.primary}>{myConn ? "Reconnect my Gmail" : "Connect my Gmail"}</a> : null}
                {conns.length > 0 && <form action={syncGmailNow}><SubmitButton variant="secondary" pendingText="Syncing…"><Icon name="refresh" className="h-4 w-4" />Sync now</SubmitButton></form>}
              </div>
            </>
          )}
          <details className="rounded-xl border border-slate-200 p-3" open={features.gmail() && conns.length > 0 && !(rules.data ?? []).length}>
            <summary className="cursor-pointer font-semibold text-slate-800">School senders ({rules.data?.length ?? 0})</summary>
            <p className="mt-2 text-xs">Only email from these addresses or domains is read. Add the addresses you see on real school emails (teachers, the district, Remind, CTLS…).</p>
            <ul className="mt-2 divide-y divide-slate-100">
              {(rules.data ?? []).map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{r.pattern}</span>
                  {r.platform_key && <span className="text-xs text-slate-500">{PLATFORMS.find((p) => p.key === r.platform_key)?.name}</span>}
                  {r.child_id && <ChildChip child={ctx.children.find((c) => c.id === r.child_id)!} />}
                  <form action={deleteSenderRule}><input type="hidden" name="id" value={r.id} /><button aria-label={`Remove ${r.pattern}`} className="p-1 text-slate-400"><Icon name="x" className="h-4 w-4" /></button></form>
                </li>
              ))}
            </ul>
            <ActionForm action={addSenderRule} submitLabel="Add sender" resetOnSuccess className="mt-2 space-y-2">
              <input name="pattern" required placeholder="teacher@school.org or @district.org" aria-label="Sender email or domain" className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <select name="platform" aria-label="Platform" className={`${inputClass} text-sm`}>
                  <option value="">Platform (optional)</option>
                  {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
                <select name="who" aria-label="For" className={`${inputClass} text-sm`}>
                  <option value="">For: let AI decide</option>
                  {whoOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </ActionForm>
            <p className="mt-2 text-xs text-slate-500">Suggestions (verify against your inbox): {PLATFORMS.flatMap((p) => p.suggestedSenders.map((s) => `${s} (${p.name})`)).join(", ")}.</p>
          </details>
        </Channel>

        {/* SMS */}
        <Channel id="sms" icon="phone" title="Text messages" status={!features.sms() ? <Status tone="off">Not set up</Status> : anyPhone ? <Status tone="ok">Ready</Status> : <Status tone="warn">Link a phone</Status>}>
          <p>Phones and web apps can&apos;t read your texts automatically. Instead, <b>forward</b> school texts to School Hub&apos;s number and they&apos;ll arrive for review.</p>
          {!features.sms() ? (
            <p className="rounded-xl bg-slate-50 p-3 text-xs">Needs a School Hub phone number (Twilio) on the server. Until then, copy a text and paste it in <b>Add → Paste text</b>, or screenshot it.</p>
          ) : (
            <>
              <CopyField label="School Hub number" value={env.twilioPhoneNumber()!} />
              {myPhone ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-emerald-900">
                  <span>Your phone {myPhone.phone_e164} is linked.</span>
                  <form action={unlinkPhone}><input type="hidden" name="id" value={myPhone.id} /><button className="text-xs font-semibold">Unlink</button></form>
                </div>
              ) : myPending ? (
                <div className="rounded-xl bg-indigo-50 p-3 text-indigo-950">
                  From <b>your</b> phone, text <b className="font-mono">{myPending.verification_code}</b> to {env.twilioPhoneNumber()}. The code expires in 30 minutes. Refresh this page after sending.
                </div>
              ) : (
                <form action={startPhoneLink}><SubmitButton variant="secondary">Link my phone</SubmitButton></form>
              )}
              <p className="text-xs">To forward on iPhone: press and hold the message → <b>More…</b> → tap the arrow → enter the School Hub number. Photos/screenshots in texts are read too. Forwarded texts don&apos;t include the original sender, so the AI relies on the message content.</p>
            </>
          )}
        </Channel>

        {/* Uploads */}
        <Channel icon="camera" title="Photos, PDFs & pasted text" status={<Status tone="ok">Always on</Status>}>
          <p>Use <b>Add</b> for printed calendars, flyers, newsletters, forms and screenshots from any app (including Kambu and MyParentView). {last("upload") ? `Last upload ${receivedLabel(last("upload")!, tz)}.` : ""}</p>
        </Channel>

        {/* Sharing */}
        <Channel id="share" icon="share" title="Share from other apps" status={<Status tone="warn">Setup per phone</Status>}>
          <p><b>Android:</b> open School Hub in Chrome → menu → <b>Install app</b>. School Hub then appears in the share sheet for screenshots, PDFs and text.</p>
          <p><b>iPhone:</b> Safari can&apos;t receive shares from other apps. Use an Apple Shortcut instead: create a key below, then build a Shortcut that sends shared items to School Hub (steps in the setup guide). This hasn&apos;t been tested on a real iPhone yet. A native iOS share extension is on the roadmap.</p>
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer font-semibold text-slate-800">iPhone Shortcut keys ({tokens.data?.length ?? 0})</summary>
            <ul className="mt-2 divide-y divide-slate-100">
              {(tokens.data ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <span>{t.label} <span className="text-xs text-slate-500">· {t.last_used_at ? `used ${receivedLabel(t.last_used_at, tz)}` : "never used"}</span></span>
                  <form action={revokeIngestToken}><input type="hidden" name="id" value={t.id} /><button className="text-xs font-semibold text-rose-600">Revoke</button></form>
                </li>
              ))}
            </ul>
            <ActionForm action={createIngestToken} submitLabel="Create key" className="mt-2 space-y-2">
              <input name="label" placeholder="Name, e.g. Tyler's iPhone" aria-label="Key name" className={inputClass} />
            </ActionForm>
            <p className="mt-2 text-xs">Shortcut action: <b>Get Contents of URL</b> → POST {env.appUrl()}/api/ingest, header <code>Authorization: Bearer &lt;key&gt;</code>, form field <code>files</code> = Shortcut Input.</p>
          </details>
        </Channel>

        {/* Calendar export */}
        <Channel id="calendar" icon="calendar" title="Phone calendar (subscribe)" status={<Status tone="ok">Available</Status>}>
          <p>Subscribe once and School Hub events and due dates appear in Apple or Google Calendar, updating automatically (usually within a few hours). Anyone with this link can see your family&apos;s school calendar — keep it private.</p>
          <CopyField label="Calendar link" value={icsUrl} />
          <div className="flex flex-wrap gap-2">
            <a href={icsUrl.replace(/^https?:/, "webcal:")} className={buttonClass.secondary}>Add to iPhone calendar</a>
            {ctx.me.role === "owner" && <form action={rotateCalendarToken}><ConfirmButton message="Create a new link? The old link stops working and you'll need to subscribe again." className={buttonClass.ghost}>Reset link</ConfirmButton></form>}
          </div>
        </Channel>

        <Channel icon="mail" title="Outlook / Microsoft 365" status={<Status tone="off">Planned</Status>}>
          <p>Not available yet. Outlook users can forward school emails to a Gmail account that&apos;s connected, or paste them in <b>Add</b>.</p>
        </Channel>
      </section>

      <section className="space-y-3">
        <SectionHeader title="School platforms" />
        <p className="px-1 text-sm text-slate-600">School Hub has <b>no direct connection</b> to these apps and never asks for their passwords. It sees their information only when it reaches you by email, text or screenshot.</p>
        {PLATFORMS.map((p) => {
          const fp = platforms.data?.find((x) => x.platform_key === p.key);
          const channels = fp?.notification_channels ?? [];
          const cov = platformCoverage({ channels, gmailConnected: anyGmail, hasSenderRule: (rules.data ?? []).some((r) => r.platform_key === p.key), smsReady: features.sms(), phoneLinked: anyPhone });
          const lastSeen = lastByPlatform.data?.find((d) => d.platform_key === p.key)?.received_at;
          return (
            <Card key={p.key} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold">{p.name}</h3>
                  <p className="text-xs text-slate-500">{p.purpose}</p>
                </div>
                {fp ? <Status tone={cov.level === "auto" ? "ok" : cov.level === "manual" ? "warn" : "off"}>{cov.label}</Status> : <Status tone="off">Not used</Status>}
              </div>
              {fp && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-slate-500">Children</dt><dd className="flex flex-wrap gap-1">{fp.child_ids.length ? fp.child_ids.map((id) => { const c = ctx.children.find((k) => k.id === id); return c ? <ChildChip key={id} child={c} /> : null; }) : "—"}</dd>
                  <dt className="text-slate-500">Notifies by</dt><dd>{channels.join(", ") || "—"} <span className="text-slate-400">(family-reported)</span></dd>
                  <dt className="text-slate-500">Method</dt><dd>{cov.level === "auto" ? "Gmail sender rule" : cov.level === "manual" ? "Forwarding / screenshots" : "None"}</dd>
                  <dt className="text-slate-500">Last received</dt><dd>{lastSeen ? receivedLabel(lastSeen, tz) : "Nothing yet"}</dd>
                  <dt className="text-slate-500">Limits</dt><dd>{cov.detail} {p.directIntegrationNote}</dd>
                </dl>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-indigo-600">{fp ? "Edit" : "We use this"}</summary>
                <ActionForm action={savePlatform} className="mt-2 space-y-2">
                  <input type="hidden" name="platform" value={p.key} />
                  <fieldset><legend className="text-xs font-medium text-slate-600">For</legend>
                    <div className="mt-1 flex flex-wrap gap-3">{ctx.children.map((c) => <label key={c.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="child" value={c.id} defaultChecked={fp?.child_ids.includes(c.id)} className="h-4 w-4 accent-indigo-600" />{c.first_name}</label>)}</div>
                  </fieldset>
                  <fieldset><legend className="text-xs font-medium text-slate-600">It notifies us by</legend>
                    <div className="mt-1 flex flex-wrap gap-3">{["email", "sms", "push", "app"].map((ch) => <label key={ch} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="channel" value={ch} defaultChecked={fp ? channels.includes(ch) : p.typicalChannels.includes(ch as "email")} className="h-4 w-4 accent-indigo-600" />{ch === "sms" ? "Text" : ch === "push" ? "Push" : ch === "app" ? "In app only" : "Email"}</label>)}</div>
                  </fieldset>
                </ActionForm>
                {fp && <form action={removePlatform} className="mt-2"><input type="hidden" name="platform" value={p.key} /><button className="text-xs font-semibold text-slate-500">We don&apos;t use this</button></form>}
              </details>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
