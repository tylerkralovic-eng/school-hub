"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { applyOnboarding, researchOne, understandAnswer, type OnboardingPlan } from "@/app/actions/onboarding";
import { Icon } from "@/components/Icon";
import { Typewriter } from "@/components/onboarding/Typewriter";
import { useVoice } from "@/components/onboarding/useVoice";
import { buttonClass, inputClass } from "@/components/ui";
import { nextQuestion, progress } from "@/lib/onboarding/script";
import { emptyState, type OnboardingState, type Question, type SchoolResearch } from "@/lib/onboarding/types";
import { PLATFORMS } from "@/lib/platforms";

type Msg = { role: "bot" | "me"; text: string };
type Phase = "chat" | "research" | "summary" | "applying" | "live";
const STORE = "sh_onboarding_v1";

export function Conversation({ aiReady }: { aiReady: boolean }) {
  const router = useRouter();
  const voice = useVoice();
  const [state, setState] = useState<OnboardingState>(emptyState);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>("chat");
  const [typing, setTyping] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [research, setResearch] = useState<Record<string, SchoolResearch | "pending">>({});
  const [result, setResult] = useState<{ inviteLink?: string; added?: number; toReview?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const q: Question = useMemo(() => nextQuestion(state), [state]);

  // Restore an in-progress conversation (same tab).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE);
      if (saved) {
        const v = JSON.parse(saved);
        setState(v.state);
        setMsgs(v.msgs);
        if (v.research) setResearch(v.research);
        if (v.phase === "summary" || v.phase === "research") setPhase("summary");
        setTyping(false);
        return;
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify({ state, msgs, research, phase })); } catch {}
  }, [state, msgs, research, phase]);

  // Ask the next question.
  useEffect(() => {
    if (phase !== "chat") return;
    if (q.id === "done") { startResearch(); return; }
    setMsgs((m) => (m.at(-1)?.role === "bot" && m.at(-1)?.text === q.text ? m : [...m, { role: "bot", text: q.text }]));
    setTyping(true);
    setPicked([]);
    voice.speak(q.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id, q.text, phase]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, thinking, phase, research]);

  async function answer(value: string, shown: string) {
    if (!value.trim() || thinking) return;
    setMsgs((m) => [...m, { role: "me", text: shown }]);
    setInput("");
    setThinking(true);
    setError(null);
    try {
      setState(await understandAnswer(q.id, q.text, value, state));
    } catch {
      setError("Sorry — I didn't catch that. Could you try again?");
      setMsgs((m) => m.slice(0, -1));
    } finally {
      setThinking(false);
    }
  }

  function submitText() {
    if (q.multi && picked.length) {
      const labels = picked.map((v) => q.chips?.find((c) => c.value === v)?.label ?? v);
      answer([...picked, input].filter(Boolean).join("|"), [labels.join(", "), input].filter(Boolean).join(" — "));
    } else answer(input, input);
  }

  async function startResearch() {
    const schools = uniqueSchools(state);
    if (!state.researchConsent || !schools.length) { setPhase("summary"); return; }
    setPhase("research");
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setResearch(Object.fromEntries(schools.map((s) => [s.key, "pending" as const])));
    await Promise.all(
      schools.map(async (s) => {
        const r = await researchOne(s.school, s.town, s.grade, tz).catch(() => ({ query: s.school, found: false, note: "The lookup didn't finish." }) as SchoolResearch);
        setResearch((prev) => ({ ...prev, [s.key]: r }));
      }),
    );
    setPhase("summary");
  }

  if (phase === "summary" || phase === "applying" || phase === "live")
    return (
      <Summary
        state={state}
        research={research}
        phase={phase}
        result={result}
        onEdit={() => { setPhase("chat"); setState({ ...state, researchConsent: null }); }}
        onApply={async (plan) => {
          setPhase("applying");
          const r = await applyOnboarding(plan);
          if (r.error) { setError(r.error); setPhase("summary"); return; }
          try { sessionStorage.removeItem(STORE); } catch {}
          setResult(r);
          setPhase("live");
        }}
        onFinish={() => router.push("/?welcome=1")}
        error={error}
      />
    );

  const { step, total } = progress(state);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-[#f4f3ef]/90 px-4 py-3 backdrop-blur">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">SH</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step} aria-label="Setup progress">
          <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${Math.max(6, (step / total) * 100)}%` }} />
        </div>
        <button type="button" onClick={voice.toggleSpeak} aria-pressed={voice.speakOn} aria-label={voice.speakOn ? "Stop reading questions aloud" : "Read questions aloud"} className={`flex h-9 w-9 items-center justify-center rounded-full ${voice.speakOn ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-200"}`}>
          <Icon name="megaphone" className="h-[18px] w-[18px]" />
        </button>
      </header>

      <div className="flex-1 space-y-3 px-4 pb-48 pt-4" aria-live="polite">
        {msgs.map((m, i) =>
          m.role === "bot" ? (
            <div key={i} className="max-w-[88%] rounded-3xl rounded-tl-lg bg-white px-4 py-3 text-[17px] leading-relaxed text-slate-900 shadow-sm">
              {i === msgs.length - 1 && phase === "chat" && typing ? <Typewriter text={m.text} onDone={() => setTyping(false)} /> : m.text}
            </div>
          ) : (
            <div key={i} className="ml-auto max-w-[80%] rounded-3xl rounded-tr-lg bg-indigo-600 px-4 py-2.5 text-[16px] text-white">{m.text === "__none__" ? "Skip" : m.text}</div>
          ),
        )}
        {thinking && (
          <div className="flex w-16 justify-center gap-1 rounded-3xl bg-white px-4 py-4 shadow-sm" aria-label="Thinking">
            {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />)}
          </div>
        )}
        {phase === "research" && <ResearchProgress state={state} research={research} />}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div ref={bottom} />
      </div>

      {phase === "chat" && q.id !== "done" && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
          <div className={`mx-auto max-w-2xl space-y-2.5 transition-opacity ${typing ? "opacity-40" : "opacity-100"}`}>
            {q.chips && (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
                {q.chips.map((c) => {
                  const on = picked.includes(c.value);
                  return (
                    <button key={c.value} type="button" disabled={thinking} aria-pressed={q.multi ? on : undefined}
                      onClick={() => (q.multi ? setPicked(on ? picked.filter((x) => x !== c.value) : [...picked, c.value]) : answer(c.value, c.label))}
                      className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                      {q.multi && on ? "✓ " : ""}{c.label}
                    </button>
                  );
                })}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); submitText(); }} className="flex items-center gap-2">
              <label htmlFor="answer" className="sr-only">Your answer</label>
              <input id="answer" value={input} onChange={(e) => setInput(e.target.value)} placeholder={q.placeholder ?? "Type your answer"} autoComplete="off" autoFocus disabled={thinking} className={`${inputClass} !rounded-full !py-3`} />
              {voice.canListen && (
                <button type="button" onClick={() => voice.listen(setInput)} aria-label={voice.listening ? "Stop listening" : "Answer by voice"} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${voice.listening ? "animate-pulse bg-rose-500 text-white" : "bg-slate-100 text-slate-700"}`}>
                  <MicIcon />
                </button>
              )}
              <button type="submit" disabled={thinking || (!input.trim() && !picked.length)} aria-label="Send" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white disabled:bg-slate-300">
                <Icon name="chevronRight" className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </form>
            <div className="flex justify-between text-xs text-slate-400">
              {q.optional ? <button type="button" onClick={() => answer("__none__", "Skip")} className="font-medium">Skip</button> : <span />}
              <span>{aiReady ? "" : "Basic mode · "}<Link href="/onboarding/form" className="underline">Prefer a form?</Link></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function uniqueSchools(s: OnboardingState) {
  const map = new Map<string, { key: string; school: string; town: string | null; grade: string | null }>();
  for (const k of s.kids) if (k.school) {
    const key = k.school.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { key, school: k.school, town: k.town, grade: k.grade });
  }
  return [...map.values()];
}

function ResearchProgress({ state, research }: { state: OnboardingState; research: Record<string, SchoolResearch | "pending"> }) {
  return (
    <div className="space-y-2 rounded-3xl bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-[15px] font-semibold"><Icon name="sparkle" className="h-5 w-5 animate-spin text-indigo-600 [animation-duration:3s]" />Looking things up for you…</p>
      {uniqueSchools(state).map((s) => {
        const r = research[s.key];
        return (
          <div key={s.key} className="flex items-start gap-2 text-sm">
            {r === "pending" || !r ? <span className="mt-0.5 h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /> : r.found ? <Icon name="check" className="h-4 w-4 text-emerald-600" strokeWidth={3} /> : <Icon name="alert" className="h-4 w-4 text-amber-600" />}
            <span>
              {r === "pending" || !r ? `Searching for ${s.school}'s official website and calendar…` : r.found ? `Found ${r.official_name ?? s.school}${r.events.length ? ` · ${r.events.length} calendar dates` : ""}` : `${s.school}: ${r.note ?? "not found"}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- summary & approval

function Summary({ state, research, phase, result, onApply, onEdit, onFinish, error }: {
  state: OnboardingState; research: Record<string, SchoolResearch | "pending">; phase: Phase; result: { inviteLink?: string; added?: number; toReview?: number } | null;
  onApply: (p: OnboardingPlan) => void; onEdit: () => void; onFinish: () => void; error: string | null;
}) {
  const schools = uniqueSchools(state);
  const [familyName, setFamilyName] = useState(`${state.me ?? "Our"}'s family`);
  const [useSchool] = useState<Record<string, boolean>>(() => Object.fromEntries(schools.map((s) => [s.key, true])));
  const [useEvents, setUseEvents] = useState<Record<string, boolean>>(() => Object.fromEntries(schools.map((s) => [s.key, true])));
  const [useDomains, setUseDomains] = useState(true);
  const [useInvite, setUseInvite] = useState(Boolean(state.invite));
  const [copied, setCopied] = useState(false);
  const r = (k: string) => (research[k] && research[k] !== "pending" ? (research[k] as SchoolResearch) : null);
  const totalEvents = schools.reduce((n, s) => n + (useEvents[s.key] && useSchool[s.key] ? r(s.key)?.events.length ?? 0 : 0), 0);
  const domains = [...new Set(schools.flatMap((s) => (useSchool[s.key] ? r(s.key)?.email_domains ?? [] : [])))];
  const schoolPlatforms = [...new Set(schools.flatMap((s) => (useSchool[s.key] ? r(s.key)?.platforms ?? [] : [])))].filter((k) => !state.platforms.some((p) => p.key === k));

  function plan(): OnboardingPlan {
    return {
      familyName: familyName.trim() || "Our family",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      me: state.me ?? "Parent",
      kids: state.kids.map((k) => ({ first_name: k.first_name, grade: k.grade, schoolKey: k.school ? k.school.trim().toLowerCase() : null })),
      schools: schools.map((s) => {
        const rr = useSchool[s.key] ? r(s.key) : null;
        const found = rr?.found ? rr : null;
        return {
          key: s.key,
          name: found?.official_name?.slice(0, 120) || s.school,
          short_name: found?.official_name && found.official_name.toLowerCase() !== s.school.toLowerCase() ? s.school.slice(0, 60) : null,
          town: found?.town ?? s.town,
          website: found?.website ?? null,
          calendar_url: found?.calendar_url ?? null,
          email_domains: useDomains ? found?.email_domains ?? [] : [],
          events: useEvents[s.key] ? found?.events ?? [] : [],
        };
      }),
      platforms: [
        ...state.platforms.map((p) => ({ ...p, channels: p.channels.filter((c): c is "email" | "sms" | "push" | "app" => ["email", "sms", "push", "app"].includes(c)) })),
        ...schoolPlatforms.map((k) => ({ key: k, child_names: state.kids.filter((kid) => schools.some((s) => s.key === kid.school?.trim().toLowerCase() && r(s.key)?.platforms.includes(k))).map((kid) => kid.first_name), channels: [...(PLATFORMS.find((p) => p.key === k)?.typicalChannels ?? [])] as ("email" | "sms" | "push" | "app")[] })),
      ],
      channels: state.channelsMentioned,
      painPoints: state.painPoints,
      invite: useInvite ? state.invite : null,
    };
  }

  if (phase === "live")
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/30">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-30" />
          <Icon name="check" className="h-12 w-12" strokeWidth={3} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">You&apos;re live!</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-slate-600">
          {familyName} is set up{result?.added ? ` with ${result.added} school dates already on your calendar` : ""}.
          {result?.toReview ? ` ${result.toReview} more need a quick look.` : ""}
        </p>
        {result?.inviteLink && (
          <div className="mt-6 w-full rounded-2xl bg-white p-4 text-left shadow-sm">
            <p className="text-sm font-semibold">Send {state.invite?.name ?? "them"} this link to join:</p>
            <div className="mt-2 flex gap-2">
              <input readOnly value={result.inviteLink} aria-label="Invitation link" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className={buttonClass.ghost} onClick={async () => {
                const link = result.inviteLink!;
                if (navigator.share) { try { await navigator.share({ title: "Join our School Hub", url: link }); return; } catch {} }
                navigator.clipboard?.writeText(link); setCopied(true);
              }}>{copied ? "Copied" : "Share"}</button>
            </div>
          </div>
        )}
        <button type="button" onClick={onFinish} className={`${buttonClass.primary} mt-8 w-full !py-3.5 text-base`}>Open School Hub</button>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl px-4 pb-32 pt-8">
      <p className="text-sm font-semibold text-indigo-600">Ready when you are</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Here&apos;s your School Hub</h1>
      <p className="mt-1 text-[15px] text-slate-600">Check it over — tap anything to turn it off. Nothing is set up until you approve.</p>

      <div className="mt-5 space-y-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500" htmlFor="famname">Family name</label>
          <input id="famname" value={familyName} onChange={(e) => setFamilyName(e.target.value)} className={`${inputClass} mt-1.5`} />
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kids & schools</h2>
          <ul className="mt-2 space-y-3">
            {state.kids.map((k) => {
              const s = k.school ? schools.find((x) => x.key === k.school!.trim().toLowerCase()) : undefined;
              const rr = s ? r(s.key) : null;
              return (
                <li key={k.first_name} className="text-[15px]">
                  <span className="font-semibold">{k.first_name}</span>{k.grade ? ` · ${k.grade}` : ""}
                  {s ? (
                    <div className="mt-0.5 text-sm text-slate-600">
                      {rr?.found ? <>✓ {rr.official_name}{rr.town ? `, ${rr.town}` : ""}{rr.website && <> · <a href={rr.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">website</a></>}</> : <>{s.school}{rr?.note ? <span className="text-amber-700"> · {rr.note}</span> : ""}</>}
                    </div>
                  ) : <div className="text-sm text-slate-500">No school yet</div>}
                </li>
              );
            })}
          </ul>
        </section>

        {schools.some((s) => (r(s.key)?.events.length ?? 0) > 0) && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Calendar dates found</h2>
            {schools.filter((s) => (r(s.key)?.events.length ?? 0) > 0).map((s) => {
              const rr = r(s.key)!;
              return (
                <label key={s.key} className="mt-2 flex items-start gap-3">
                  <input type="checkbox" checked={useEvents[s.key]} onChange={(e) => setUseEvents({ ...useEvents, [s.key]: e.target.checked })} className="mt-1 h-5 w-5 accent-indigo-600" />
                  <span className="text-[15px]">
                    <b>{rr.events.length} dates</b> from {rr.official_name}&apos;s official calendar
                    <span className="mt-1 block text-sm text-slate-500">{rr.events.slice(0, 4).map((e) => `${e.title} (${new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })})`).join(" · ")}{rr.events.length > 4 ? " …" : ""}</span>
                    {rr.calendar_url && <a href={rr.calendar_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 underline">Source</a>}
                  </span>
                </label>
              );
            })}
          </section>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">How updates will reach you</h2>
          <ul className="mt-2 space-y-1.5 text-[15px]">
            {[...state.platforms, ...schoolPlatforms.map((k) => ({ key: k, child_names: [], channels: [] as string[] }))].map((p) => {
              const cat = PLATFORMS.find((c) => c.key === p.key);
              const auto = (p.channels.includes("email") || cat?.typicalChannels.includes("email"));
              return (
                <li key={p.key} className="flex justify-between gap-3">
                  <span>{cat?.name ?? p.key}{p.child_names.length ? ` · ${p.child_names.join(", ")}` : ""}</span>
                  <span className={`shrink-0 text-sm ${auto ? "text-emerald-700" : "text-amber-700"}`}>{auto ? "by email" : "screenshots"}</span>
                </li>
              );
            })}
            {state.channelsMentioned.includes("sms") && <li className="flex justify-between"><span>School texts</span><span className="text-sm text-amber-700">forward to School Hub</span></li>}
            {!state.platforms.length && !schoolPlatforms.length && <li className="text-sm text-slate-500">Photos, PDFs and pasted messages — you can connect Gmail next.</li>}
          </ul>
          {state.platforms.some((p) => p.channels.includes("email")) && <p className="mt-2 text-xs text-slate-500">Next step after setup: connect Gmail so school emails are read automatically.</p>}
          {domains.length > 0 && (
            <label className="mt-3 flex items-start gap-3 border-t border-slate-100 pt-3">
              <input type="checkbox" checked={useDomains} onChange={(e) => setUseDomains(e.target.checked)} className="mt-1 h-5 w-5 accent-indigo-600" />
              <span className="text-[15px]">Watch for school emails from <b>{domains.map((d) => "@" + d).join(", ")}</b> once Gmail is connected</span>
            </label>
          )}
        </section>

        {state.invite && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={useInvite} onChange={(e) => setUseInvite(e.target.checked)} className="mt-1 h-5 w-5 accent-indigo-600" />
              <span className="text-[15px]">Invite <b>{state.invite.name ?? state.invite.email}</b> ({state.invite.email}) to see everything</span>
            </label>
          </section>
        )}

        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          <button type="button" onClick={onEdit} disabled={phase === "applying"} className={buttonClass.secondary}>Back</button>
          <button type="button" disabled={phase === "applying"} onClick={() => onApply(plan())} className={`${buttonClass.primary} flex-1 !py-3.5 text-base`}>
            {phase === "applying" ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Setting everything up…</> : <>Looks good — set it up{totalEvents ? ` (${totalEvents} dates)` : ""}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
