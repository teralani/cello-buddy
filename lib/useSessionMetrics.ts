"use client";

import { useMemo, useSyncExternalStore } from "react";
import { METRICS_KEY, isPracticeMetrics, type PracticeMetrics } from "@/lib/metrics";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot(): string | null {
  try {
    return window.sessionStorage.getItem(METRICS_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): undefined {
  return undefined;
}

/* Metrics written by an older build of the practice screen fail the shape
   check and count as no session, so nothing ever reviews stale data. */
export function parseMetrics(raw: string | null | undefined): PracticeMetrics | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPracticeMetrics(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/* The last play-through's metrics from sessionStorage. `undefined` until the
   client has hydrated, `null` when no session has been recorded. */
export function useSessionMetrics(): PracticeMetrics | null | undefined {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => (raw === undefined ? undefined : parseMetrics(raw)), [raw]);
}
