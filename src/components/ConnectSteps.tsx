"use client";

import { useEffect, useState, useTransition } from "react";
import { getConnectStatus, startPhoneLink, type ConnectStatus } from "@/app/actions/connections";
import { Icon, type IconName } from "@/components/Icon";
import { buttonClass } from "@/components/ui";

const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
/** sms: link with a prefilled message; "?&body=" works on both iPhone and Android. */
const smsHref = (to: string, body?: string) => `sms:${to}${body ? `?&body=${encodeURIComponent(body)}` : ""}`;

function Step({ icon, title, done, children }: { icon: IconName; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 ${done ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-500 text-white" : "bg-indigo-50 text-indigo-600"}`}>
          <Icon name={done ? "check" : icon} className="h-5 w-5" strokeWidth={done ? 3 : 1.8} />
        </span>
        <h3 className="flex-1 text-[16px] font-semibold">{title}</h3>
      </div>
      <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </div>
  );
}

/** One-tap ways to make School Hub automatic. Only shows what this server supports. */
export function ConnectSteps({ initial }: { initial: ConnectStatus }) {
  const [s, setS] = useState(initial);
  const [code, setCode] = useState<string | null>(initial.sms?.pendingCode ?? null);
  const [pending, start] = useTransition();

  // While a phone link is pending, check every few seconds so it flips to "done" by itself.
  useEffect(() => {
    if (!code || s.sms?.linkedPhone) return;
    const t = setInterval(async () => {
      const next = await getConnectStatus();
      setS(next);
      if (next.sms?.linkedPhone) setCode(null);
    }, 4000);
    return () => clearInterval(t);
  }, [code, s.sms?.linkedPhone]);

  return (
    <div className="space-y-3">
      {s.sms && (
        <Step icon="phone" title={s.sms.linkedPhone ? "Text School Hub anything" : "Text School Hub"} done={Boolean(s.sms.linkedPhone)}>
          {s.sms.linkedPhone ? (
            <>
              <p>Forward school texts or just say it — “Everley needs a costume Friday.” Voice-to-text works great on the way home.</p>
              <div className="flex flex-wrap gap-2">
                <a href={smsHref(s.sms.number)} className={buttonClass.primary}>Text {pretty(s.sms.number)}</a>
                <a href="/api/contact" className={buttonClass.secondary}>Save to contacts</a>
              </div>
            </>
          ) : code ? (
            <>
              <p><b>One tap:</b> your Messages app opens with a code ready. Just hit send.</p>
              <a href={smsHref(s.sms.number, code)} className={`${buttonClass.primary} w-full !py-3.5 text-base`}>Open Messages and send</a>
              <p className="flex items-center gap-2 text-sm text-slate-500"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />Waiting for your text… (or text <b className="font-mono">{code}</b> to {pretty(s.sms.number)})</p>
            </>
          ) : (
            <>
              <p>Text or forward anything — school texts, screenshots, or a quick voice note typed by your phone.</p>
              <button type="button" disabled={pending} onClick={() => start(async () => setCode((await startPhoneLink()).code))} className={`${buttonClass.primary} w-full !py-3.5 text-base`}>
                {pending ? "One moment…" : "Link my phone"}
              </button>
            </>
          )}
        </Step>
      )}

      {s.gmail && (
        <Step icon="mail" title="Read school emails automatically" done={Boolean(s.gmail.connectedEmail)}>
          {s.gmail.connectedEmail ? (
            <p>Connected to {s.gmail.connectedEmail}. New school emails show up for review on their own.</p>
          ) : (
            <>
              <p>{s.gmail.needsReconnect ? "Google access expired — reconnect to keep emails flowing." : "Read-only, and only messages from your schools and school apps."}</p>
              <a href="/api/gmail/connect" className={`${buttonClass.primary} w-full !py-3.5 text-base`}>{s.gmail.needsReconnect ? "Reconnect Gmail" : "Connect Gmail"}</a>
            </>
          )}
        </Step>
      )}

      <Step icon="calendar" title="See it in your phone's calendar">
        <p>Events and due dates appear next to everything else, and stay up to date.</p>
        <a href={s.icsUrl.replace(/^https?:/, "webcal:")} className={`${buttonClass.secondary} w-full`}>Add to my calendar</a>
      </Step>
    </div>
  );
}
