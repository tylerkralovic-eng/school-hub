"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Card } from "@/components/ui";

const steps: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "share",
    title: "Share",
    body: "Paste a school message, or share a screenshot from any school app.",
  },
  {
    icon: "sparkle",
    title: "Extract",
    body: "School Hub pulls out dates, deadlines and which child it's about. It never guesses a missing date or child.",
  },
  {
    icon: "check",
    title: "You review",
    body: "Check and edit anything uncertain before it's added. Nothing publishes without you.",
  },
  {
    icon: "inbox",
    title: "Added to your hub",
    body: "It appears in the feed and calendar, linked to the original message.",
  },
];

export default function SharePage() {
  const [text, setText] = useState("");

  return (
    <div className="space-y-5 pb-4">
      <div className="px-1 pt-1">
        <h1 className="text-2xl font-semibold tracking-tight">Share an update</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add messages from apps and emails that School Hub isn&apos;t connected to.
        </p>
      </div>

      <div
        role="status"
        className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">Extraction isn&apos;t connected yet</p>
          <p className="mt-1 leading-relaxed text-amber-900">
            This screen is a preview. Nothing you type here is sent, processed or saved. Please don&apos;t paste
            real messages about your children into the demo.
          </p>
        </div>
      </div>

      <Card className="p-4">
        <label htmlFor="share-text" className="text-sm font-semibold text-slate-800">
          Paste a message
        </label>
        <textarea
          id="share-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="e.g. “Reminder: the 4th grade field trip is next Thursday. Please return permission slips by Monday.”"
          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[15px] leading-relaxed placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-400">
          <Icon name="image" className="h-5 w-5" />
          <span>Screenshot upload: coming soon</span>
        </div>
        <button
          type="button"
          disabled
          className="mt-4 w-full cursor-not-allowed rounded-xl bg-slate-200 py-3 text-[15px] font-semibold text-slate-500"
        >
          Extract details (not available in demo)
        </button>
        {text.length > 0 && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Your text stays on this screen only and disappears when you leave.
          </p>
        )}
      </Card>

      <section>
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
          How it will work
        </h2>
        <Card>
          <ol className="divide-y divide-slate-100">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3 px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Icon name={s.icon} className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold">
                    <span className="text-slate-400">{i + 1}.</span> {s.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-500">
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
        School Hub will never ask for school passwords. Shared content will be private to your family.
      </p>
    </div>
  );
}
