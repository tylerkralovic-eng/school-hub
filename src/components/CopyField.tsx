"use client";
import { useState } from "react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly aria-label={label} value={value} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-700" />
      <button type="button" onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-lg px-2 py-1 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
