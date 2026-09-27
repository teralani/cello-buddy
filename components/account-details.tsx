"use client";

import { useEffect, useState } from "react";
import {
  PLACEHOLDER_NOTE,
  daysSince,
  fetchPracticeHistory,
  longestStreak,
  totalMinutes,
  totalNotes,
  type PracticeHistory,
} from "@/lib/practiceHistory";
import { displayName, useCurrentUser } from "@/lib/useCurrentUser";

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function hoursAndMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : `${h} h ${m} min`;
}

/* The signed-in user's name and email from the backend, plus practice totals
   from their stored sessions. Totals that the backend does not record yet
   (practice time, notes, pieces) are built from fixed per-session
   placeholders; see lib/practiceHistory.ts. */
export default function AccountDetails() {
  const user = useCurrentUser();
  const [state, setState] = useState<(PracticeHistory & { now: Date }) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    fetchPracticeHistory(now).then((result) => {
      if (!cancelled) setState({ ...result, now });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const history = state?.history;
  const first = history?.[history.length - 1];
  const daysIn = first && state ? daysSince(first.recordedAt, state.now) + 1 : null;
  const pieces = history ? new Set(history.map((e) => e.piece)).size : null;
  const streak = history && state ? longestStreak(history, state.now) : null;
  const name = displayName(user);
  const email = user?.email ?? null;
  const initial = (user?.name?.trim() || email || "").charAt(0).toUpperCase() || "?";

  const rows: [label: string, value: string][] = [
    ["Name", user?.name?.trim() || "—"],
    ["Email", email ?? (user === undefined ? "—" : "Not signed in")],
    ["Practicing since", first ? longDate(first.recordedAt) : "—"],
    ["Sessions recorded", history ? `${history.length}` : "—"],
    ["Total practice time", history ? hoursAndMinutes(totalMinutes(history)) : "—"],
    ["Notes graded", history ? totalNotes(history).toLocaleString() : "—"],
    ["Longest streak", streak !== null ? `${streak} ${streak === 1 ? "day" : "days"}` : "—"],
    ["Pieces in rotation", pieces !== null ? `${pieces}` : "—"],
  ];

  const subtitle =
    state === null
      ? "Loading your history"
      : history && history.length === 0
        ? "No sessions recorded yet."
        : `Day ${daysIn} of playing with a buddy.`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-foreground text-2xl font-semibold text-background">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{name ?? email ?? "Signed in"}</p>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <dl className="divide-y divide-border rounded-md border border-border bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2.5 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 truncate text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {state ? (
        <p className="text-xs text-muted">
          {state.source === "live" ? PLACEHOLDER_NOTE : "The backend could not be reached, so these totals are sample data."}
        </p>
      ) : null}
    </div>
  );
}
