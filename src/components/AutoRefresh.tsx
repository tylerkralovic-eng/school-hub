"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes server data periodically while background work is in progress. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
