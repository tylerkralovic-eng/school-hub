"use client";

import { useFamily } from "@/components/FamilyProvider";
import { Card, SectionHeader, StatusDot, statusMeta } from "@/components/ui";
import { formatReceived } from "@/lib/format";
import { sourcesForFilter, summarizeSources } from "@/lib/selectors";

/**
 * Shows which sources School Hub can and cannot see. Critical for trust:
 * "nothing new" from a disconnected app must never look like "all caught up".
 */
export function SourceHealth() {
  const { snapshot, filter, now } = useFamily();
  const sources = sourcesForFilter(snapshot, filter);
  const summary = summarizeSources(sources);

  const groups = [
    ...snapshot.schools.map((school) => ({
      key: school.id,
      title: school.name,
      sources: sources.filter((s) => s.schoolId === school.id),
    })),
    { key: "family", title: "Family", sources: sources.filter((s) => s.schoolId === null) },
  ].filter((g) => g.sources.length > 0);

  return (
    <section aria-labelledby="sources-heading">
      <SectionHeader
        title="Sources"
        action={
          <span id="sources-heading" className="text-xs text-slate-500">
            {summary.connected} connected · {summary.stale} out of date · {summary.notConnected} not connected
          </span>
        }
      />
      <Card className="divide-y divide-slate-100">
        {groups.map((g) => (
          <div key={g.key} className="px-4 py-3">
            <p className="text-xs font-semibold text-slate-500">{g.title}</p>
            <ul className="mt-1.5 space-y-2">
              {g.sources.map((s) => (
                <li key={s.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5">
                    <StatusDot status={s.status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-slate-800">{s.name}</span>
                      <span className={`shrink-0 text-xs ${statusMeta[s.status].text}`}>
                        {s.status === "not_connected"
                          ? "Not connected"
                          : s.lastSyncedAt
                            ? `${s.status === "stale" ? "Checked " : ""}${formatReceived(s.lastSyncedAt, now)}`
                            : statusMeta[s.status].label}
                      </span>
                    </div>
                    {s.note && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="px-4 py-3 text-xs leading-relaxed text-slate-500">
          School Hub only sees connected sources. It can&apos;t confirm there&apos;s nothing new in apps that
          aren&apos;t connected.
        </p>
      </Card>
    </section>
  );
}
