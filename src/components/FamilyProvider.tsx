"use client";

/**
 * Client-side family state for the demo: the loaded snapshot, child filter
 * and task completion. Persisted to localStorage only (no server, no account).
 *
 * The snapshot is built after mount so relative dates and times render in the
 * viewer's own timezone without server/client hydration mismatches.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getFamilySnapshot } from "@/lib/data";
import type { ChildFilter } from "@/lib/selectors";
import type { FamilySnapshot } from "@/lib/types";

const STORAGE_KEY = "schoolhub.demo.v1";

interface StoredState {
  filter: ChildFilter;
  completed: string[];
}

interface FamilyContextValue {
  now: Date;
  snapshot: FamilySnapshot;
  filter: ChildFilter;
  setFilter: (f: ChildFilter) => void;
  isDone: (itemId: string) => boolean;
  toggleDone: (itemId: string) => void;
  resetDemo: () => void;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

function readStored(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredState) : null;
  } catch {
    return null;
  }
}

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState<{ now: Date; snapshot: FamilySnapshot } | null>(null);
  const [filter, setFilterState] = useState<ChildFilter>("all");
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const now = new Date();
    const snapshot = getFamilySnapshot(now);
    const stored = readStored();
    if (stored) {
      const validFilter =
        stored.filter === "all" || snapshot.children.some((c) => c.id === stored.filter);
      setFilterState(validFilter ? stored.filter : "all");
      setCompleted(new Set(stored.completed));
    }
    setLoaded({ now, snapshot });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      const state: StoredState = { filter, completed: [...completed] };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode): demo still works in memory.
    }
  }, [loaded, filter, completed]);

  const toggleDone = useCallback((id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const value = useMemo<FamilyContextValue | null>(() => {
    if (!loaded) return null;
    return {
      ...loaded,
      filter,
      setFilter: setFilterState,
      isDone: (id) => completed.has(id),
      toggleDone,
      resetDemo: () => {
        setCompleted(new Set());
        setFilterState("all");
      },
    };
  }, [loaded, filter, completed, toggleDone]);

  if (!value) return <LoadingShell />;
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used inside <FamilyProvider>");
  return ctx;
}

function LoadingShell() {
  return (
    <div className="space-y-3 px-4 pt-4" aria-busy="true" aria-label="Loading">
      <div className="h-24 animate-pulse rounded-3xl bg-slate-200/70" />
      <div className="h-16 animate-pulse rounded-2xl bg-slate-200/60" />
      <div className="h-16 animate-pulse rounded-2xl bg-slate-200/50" />
    </div>
  );
}
