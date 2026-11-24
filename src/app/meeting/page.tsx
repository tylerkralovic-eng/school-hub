import { Star } from "@/components/behavior/Mark";
import { DeckViewer } from "@/components/meeting/DeckViewer";
import { MeetingControls } from "@/components/meeting/MeetingControls";
import { formatPoints } from "@/lib/behavior";
import { DAY_NAMES, nextMeetingDate } from "@/lib/meeting/schedule";
import { VALUES } from "@/lib/meeting/values";
import { requireFamily, type FamilyContext } from "@/lib/server/context";
import { loadDeck, type Deck, type KidWeek } from "@/lib/server/meeting";
import { fmt, fmtTime, todayIn, zonedToUtc } from "@/lib/time";
import { CATEGORY_LABELS } from "@/lib/types";

export const metadata = { title: "Family meeting · School Hub" };

const HEX: Record<string, string> = { violet: "#7c3aed", teal: "#0d9488", amber: "#d97706", rose: "#e11d48", sky: "#0284c7", emerald: "#059669" };
const hexOf = (c: { color: string }) => HEX[c.color] ?? HEX.violet;
const time12 = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/* ---------- slide building blocks (sized in container units so they scale) ---------- */

function Slide({ children, className = "", label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <section aria-label={label} className={`deck-slide @container relative aspect-video w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200 ${className}`}>
      <div className="absolute inset-0 flex flex-col p-[4.5cqw]">{children}</div>
    </section>
  );
}

function Head({ kicker, title, color = "#4f46e5" }: { kicker: string; title: string; color?: string }) {
  return (
    <header className="mb-[2.5cqw]">
      <p className="text-[1.6cqw] font-bold uppercase tracking-[0.14em]" style={{ color }}>{kicker}</p>
      <h2 className="mt-[0.4cqw] text-[4.4cqw] font-bold leading-[1.05] tracking-tight text-slate-900">{title}</h2>
    </header>
  );
}

function DayMark({ k, d }: { k: KidWeek; d: KidWeek["days"][number] }) {
  if (k.shape === "dots") {
    const max = k.countMax ?? 3;
    return (
      <span className="flex h-[8cqw] items-center justify-center gap-[0.7cqw]" role="img" aria-label={`${d.label}`}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className="h-[2.4cqw] w-[2.4cqw] rounded-full" style={{ background: d.count != null && i < d.count ? d.color : "#e2e8f0" }} />
        ))}
      </span>
    );
  }
  if (k.shape === "star")
    return (
      <span className={`flex h-[8cqw] items-center justify-center [&_svg]:h-[7.5cqw] [&_svg]:w-[7.5cqw] ${d.color ? "" : "opacity-30"}`}>
        <Star fill={d.color ?? "#f8fafc"} stroke={d.stroke ?? "#94a3b8"} label={d.label} />
      </span>
    );
  return (
    <span className="flex h-[8cqw] items-center justify-center">
      <span role="img" aria-label={d.label} className="h-[6cqw] w-[6cqw] rounded-full" style={{ background: d.color ?? "transparent", border: d.color ? `0.4cqw solid ${d.stroke ?? d.color}` : "0.4cqw dashed #cbd5e1" }} />
    </span>
  );
}

function Bar({ pct, done, color }: { pct: number; done: boolean; color: string }) {
  return (
    <div className="h-[1.3cqw] overflow-hidden rounded-full bg-slate-200/80">
      <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: done ? "#10b981" : color }} />
    </div>
  );
}

function whoFor(item: { child_id: string | null; school_id: string | null }, ctx: FamilyContext) {
  const child = ctx.children.find((c) => c.id === item.child_id);
  if (child) return [child];
  if (item.school_id) return ctx.children.filter((c) => c.school_id === item.school_id);
  return [];
}

/* ---------- slides ---------- */

function buildSlides(deck: Deck, ctx: FamilyContext) {
  const tz = ctx.family.timezone;
  const dayName = (d: string, o: Intl.DateTimeFormatOptions) => fmt(zonedToUtc(d, "12:00", tz), tz, o);
  const slides: { title: string; node: React.ReactNode }[] = [];
  const kidsWithPrizes = deck.kids;

  slides.push({
    title: "Welcome",
    node: (
      <Slide label="Welcome" className="bg-indigo-600 text-white ring-indigo-700">
        <p className="text-[1.8cqw] font-bold uppercase tracking-[0.16em] text-indigo-200">{ctx.family.name} · Family meeting</p>
        <h2 className="mt-[1cqw] text-[7cqw] font-bold leading-none tracking-tight">{dayName(deck.date, { weekday: "long", month: "long", day: "numeric" })}</h2>
        <div className="mt-auto grid grid-cols-2 gap-[3cqw]">
          <div>
            <p className="text-[1.6cqw] font-semibold uppercase tracking-wider text-indigo-200">Tonight</p>
            <ol className="mt-[1cqw] space-y-[0.6cqw] text-[2.3cqw] font-medium">
              {deck.kids.length > 0 && <li>1. How the week went</li>}
              {deck.kids.length > 0 && <li>2. Points &amp; prizes</li>}
              <li>{deck.kids.length > 0 ? 3 : 1}. Next week</li>
              <li>{deck.kids.length > 0 ? 4 : 2}. Coming up</li>
              <li>{deck.kids.length > 0 ? 5 : 3}. Value of the week</li>
            </ol>
          </div>
          <div className="self-end rounded-[2cqw] bg-white/12 p-[2.5cqw] ring-1 ring-white/20">
            <p className="text-[1.6cqw] font-semibold uppercase tracking-wider text-indigo-200">This week&apos;s value</p>
            <p className="mt-[0.5cqw] text-[4cqw] font-bold leading-tight">{deck.value.name}</p>
          </div>
        </div>
      </Slide>
    ),
  });

  for (const k of deck.kids) {
    const color = hexOf(k.child);
    const diff = k.points - k.lastWeekPoints;
    slides.push({
      title: `${k.child.first_name}'s week`,
      node: (
        <Slide label={`${k.child.first_name}'s week`} className="bg-white">
          <Head kicker={`${k.systemName} · ${dayName(deck.reviewWeek[0], { month: "short", day: "numeric" })}–${dayName(deck.reviewWeek[4], { month: "short", day: "numeric" })}`} title={`${k.child.first_name}'s week`} color={color} />
          <div className="grid grid-cols-5 gap-[1.5cqw]">
            {k.days.map((d) => (
              <div key={d.day} className="rounded-[1.6cqw] bg-slate-50 py-[1.4cqw] text-center ring-1 ring-slate-200/70">
                <p className="text-[1.6cqw] font-bold uppercase text-slate-500">{dayName(d.day, { weekday: "short" })}</p>
                <DayMark k={k} d={d} />
                <p className="text-[1.7cqw] font-semibold text-slate-800">{d.points === null ? "—" : d.label}</p>
                <p className="text-[1.5cqw] text-slate-500">{d.points === null ? "not logged" : `${formatPoints(d.points)} pts`}</p>
              </div>
            ))}
          </div>
          <div className="mt-[2.5cqw] grid grid-cols-3 gap-[1.5cqw]">
            <Stat big={formatPoints(k.points)} label="points this week" sub={k.lastWeekPoints || k.points ? `${diff >= 0 ? "+" : "−"}${Math.abs(diff)} vs last week` : undefined} />
            <Stat big={`${k.goodDays}/${k.logged || 5}`} label="good days" />
            <Stat big={String(k.streak)} label={`${k.streakLabel} in a row`} />
          </div>
          <p className="mt-auto rounded-[1.6cqw] px-[2.2cqw] py-[1.4cqw] text-[2.4cqw] font-semibold" style={{ background: `${color}14`, color }}>{k.shoutout}</p>
        </Slide>
      ),
    });
  }

  if (kidsWithPrizes.length) {
    slides.push({
      title: "Points & prizes",
      node: (
        <Slide label="Points and prizes" className="bg-amber-50">
          <Head kicker="Points & prizes" title="What are we working toward?" color="#b45309" />
          <div className={`grid flex-1 gap-[2cqw] ${kidsWithPrizes.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {kidsWithPrizes.slice(0, 4).map((k) => {
              const color = hexOf(k.child);
              return (
                <div key={k.child.id} className="rounded-[1.8cqw] bg-white p-[2cqw] ring-1 ring-amber-200/70">
                  <p className="text-[2.6cqw] font-bold" style={{ color }}>{k.child.first_name}</p>
                  {k.prizes.length === 0 ? (
                    <p className="mt-[1cqw] text-[1.9cqw] text-slate-600">No prize yet — pick one together tonight!</p>
                  ) : (
                    <ul className="mt-[1cqw] space-y-[1.4cqw]">
                      {k.prizes.slice(0, 3).map((p, i) => (
                        <li key={i}>
                          <div className="mb-[0.5cqw] flex items-baseline justify-between gap-[1cqw] text-[1.8cqw]">
                            <span className="min-w-0 truncate font-semibold text-slate-800"><span className="font-medium text-slate-500">{p.horizon === "week" ? "This week" : "Big prize"}:</span> {p.title}</span>
                            <span className={`shrink-0 font-bold ${p.done ? "text-emerald-600" : "text-slate-600"}`}>{p.done ? "Earned!" : `${p.pts}/${p.goal}`}</span>
                          </div>
                          <Bar pct={p.pct} done={p.done} color={color} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-[1.6cqw] text-[1.9cqw] font-medium text-amber-900">Talk about it: what prize should we work toward next week — and for the big one?</p>
        </Slide>
      ),
    });
  }

  const busiest = Math.max(1, ...deck.nextWeek.map((d) => d.items.length));
  slides.push({
    title: "Next week",
    node: (
      <Slide label="Next week" className="bg-white">
        <Head kicker="Next week" title={`${dayName(deck.nextWeek[0].day, { month: "short", day: "numeric" })} – ${dayName(deck.nextWeek[6].day, { month: "short", day: "numeric" })}`} color="#0284c7" />
        <div className="grid flex-1 grid-cols-7 gap-[1cqw]">
          {deck.nextWeek.map((d) => {
            const shown = d.items.slice(0, busiest > 5 ? 4 : 5);
            const weekend = [0, 6].includes(new Date(`${d.day}T12:00:00Z`).getUTCDay());
            return (
              <div key={d.day} className={`flex min-w-0 flex-col rounded-[1.4cqw] p-[1cqw] ring-1 ${weekend ? "bg-slate-50 ring-slate-200/60" : "bg-sky-50/60 ring-sky-100"}`}>
                <p className="text-[1.4cqw] font-bold uppercase text-slate-500">{dayName(d.day, { weekday: "short" })}</p>
                <p className="text-[2.6cqw] font-bold leading-tight text-slate-900">{Number(d.day.slice(8))}</p>
                <ul className="mt-[0.6cqw] space-y-[0.6cqw]">
                  {shown.map((it) => {
                    const who = whoFor(it, ctx);
                    const tone = it.category === "closure" || it.category === "early_dismissal" ? "bg-rose-100 text-rose-900" : it.isDue ? "bg-amber-100 text-amber-900" : "bg-white text-slate-800";
                    return (
                      <li key={it.id + (it.isDue ? "d" : "")} className={`rounded-[0.8cqw] px-[0.7cqw] py-[0.5cqw] text-[1.3cqw] leading-snug ring-1 ring-slate-200/60 ${tone}`}>
                        <span className="line-clamp-3 font-medium">{it.isDue ? `Due: ${it.title}` : it.title}</span>
                        <span className="mt-[0.2cqw] flex items-center gap-[0.4cqw] text-[1.1cqw] text-slate-500">
                          {!it.isDue && !it.all_day && it.starts_at && <span>{fmtTime(it.starts_at, tz)}</span>}
                          {who.map((c) => <span key={c.id} className="inline-block h-[1cqw] w-[1cqw] rounded-full" style={{ background: hexOf(c) }} title={c.first_name} />)}
                        </span>
                      </li>
                    );
                  })}
                  {d.items.length > shown.length && <li className="text-[1.2cqw] font-medium text-slate-500">+{d.items.length - shown.length} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
        {ctx.children.length > 1 && (
          <p className="mt-[1.2cqw] flex gap-[2cqw] text-[1.4cqw] text-slate-600">
            {ctx.children.map((c) => <span key={c.id} className="flex items-center gap-[0.5cqw]"><span className="inline-block h-[1.2cqw] w-[1.2cqw] rounded-full" style={{ background: hexOf(c) }} />{c.first_name}</span>)}
            <span>· no dot = whole family</span>
          </p>
        )}
      </Slide>
    ),
  });

  slides.push({
    title: "Coming up",
    node: (
      <Slide label="Coming up" className="bg-white">
        <Head kicker="Coming up" title="Important dates ahead" color="#e11d48" />
        {deck.comingUp.length === 0 ? (
          <p className="text-[2.2cqw] text-slate-500">Nothing big on the calendar for the next month.</p>
        ) : (
          <ul className={`grid gap-x-[3cqw] gap-y-[1.2cqw] ${deck.comingUp.length > 4 ? "grid-cols-2" : "grid-cols-1"}`}>
            {deck.comingUp.map((it) => (
              <li key={it.id + (it.isDue ? "d" : "")} className="flex items-center gap-[1.6cqw]">
                <span className="w-[7cqw] shrink-0 rounded-[1.2cqw] bg-rose-50 py-[0.6cqw] text-center ring-1 ring-rose-100">
                  <span className="block text-[1.3cqw] font-bold uppercase text-rose-600">{dayName(it.when, { month: "short" })}</span>
                  <span className="block text-[2.6cqw] font-bold leading-tight text-slate-900">{Number(it.when.slice(8))}</span>
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-[2cqw] font-semibold leading-snug text-slate-900">{it.isDue ? `Due: ${it.title}` : it.title}</span>
                  <span className="block text-[1.5cqw] text-slate-500">
                    {dayName(it.when, { weekday: "long" })}
                    {it.category !== "general" ? ` · ${CATEGORY_LABELS[it.category]}` : ""}
                    {whoFor(it, ctx).length ? ` · ${whoFor(it, ctx).map((c) => c.first_name).join(" & ")}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Slide>
    ),
  });

  slides.push({
    title: "Value of the week",
    node: (
      <Slide label="Value of the week" className="bg-emerald-50 ring-emerald-100">
        <p className="text-[1.6cqw] font-bold uppercase tracking-[0.14em] text-emerald-700">Value of the week</p>
        <h2 className="mt-[0.4cqw] text-[7cqw] font-bold leading-none tracking-tight text-emerald-950">{deck.value.name}</h2>
        <p className="mt-[1.6cqw] max-w-[80%] text-[3cqw] font-medium leading-snug text-emerald-900">{deck.value.kid}</p>
        <div className="mt-auto grid grid-cols-2 gap-[2cqw]">
          <div className="rounded-[1.8cqw] bg-white p-[2.2cqw] ring-1 ring-emerald-200/70">
            <p className="text-[1.5cqw] font-bold uppercase tracking-wider text-emerald-700">Let&apos;s talk</p>
            <p className="mt-[0.6cqw] text-[2.3cqw] font-semibold leading-snug text-slate-900">{deck.value.ask}</p>
          </div>
          <div className="rounded-[1.8cqw] bg-emerald-600 p-[2.2cqw] text-white">
            <p className="text-[1.5cqw] font-bold uppercase tracking-wider text-emerald-100">This week, let&apos;s try</p>
            <p className="mt-[0.6cqw] text-[2.3cqw] font-semibold leading-snug">{deck.value.try}</p>
          </div>
        </div>
      </Slide>
    ),
  });

  slides.push({
    title: "Wrap-up",
    node: (
      <Slide label="Wrap-up" className="bg-indigo-600 text-white ring-indigo-700">
        <p className="text-[1.6cqw] font-bold uppercase tracking-[0.14em] text-indigo-200">Before we go</p>
        <h2 className="mt-[0.4cqw] text-[5.5cqw] font-bold leading-none tracking-tight">Anything else?</h2>
        <ul className="mt-[3cqw] space-y-[1.4cqw] text-[2.6cqw] font-medium">
          <li>⭐ One thing each person is proud of</li>
          <li>💬 Anything that&apos;s bothering anyone?</li>
          <li>🎉 Pick one fun thing to do together this week</li>
        </ul>
        <p className="mt-auto text-[1.9cqw] text-indigo-100">
          {deck.settings ? `Next meeting: ${DAY_NAMES[deck.settings.day]} at ${time12(deck.settings.time)}` : "Same time next week?"}
        </p>
      </Slide>
    ),
  });

  return slides;
}

function Stat({ big, label, sub }: { big: string; label: string; sub?: string }) {
  return (
    <div className="rounded-[1.6cqw] bg-slate-50 px-[2cqw] py-[1.4cqw] ring-1 ring-slate-200/70">
      <p className="text-[4cqw] font-bold leading-none text-slate-900">{big}</p>
      <p className="mt-[0.5cqw] text-[1.6cqw] font-medium text-slate-600">{label}</p>
      {sub && <p className="text-[1.4cqw] text-slate-500">{sub}</p>}
    </div>
  );
}

export default async function MeetingPage({ searchParams }: { searchParams: Promise<{ date?: string; saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFamily();
  const deck = await loadDeck(ctx, sp.date);
  const slides = buildSlides(deck, ctx);
  const title = `Family meeting · ${fmt(zonedToUtc(deck.date, "12:00", ctx.family.timezone), ctx.family.timezone, { weekday: "short", month: "short", day: "numeric" })}`;

  return (
    <main className="min-h-dvh bg-[#f4f3ef] pb-16">
      <DeckViewer slides={slides.map((s) => s.node)} titles={slides.map((s) => s.title)} title={title} settingsHref="#meeting-settings" />
      <MeetingControls
        date={deck.date}
        isCurrent={deck.date === nextMeetingDate(todayIn(ctx.family.timezone), deck.settings?.day ?? 0)}
        settings={deck.settings}
        valueKey={deck.value.key}
        values={VALUES.map((v) => ({ key: v.key, name: v.name }))}
        untracked={deck.untrackedKids.map((c) => c.first_name)}
        saved={sp.saved === "1"}
        error={sp.error === "settings"}
      />
    </main>
  );
}
