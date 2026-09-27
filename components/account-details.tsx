"use client";

import { useEffect, useState } from "react";
import { daysSince, fetchPracticeHistory, longestStreak, totalMinutes, totalNotes, type PracticeHistoryEntry } from "@/lib/practiceHistory";
import { useSessionEmail } from "@/lib/useSessionEmail";

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function hoursAndMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : `${h} h ${m} min`;
}

/* The signed-in email plus practice totals from the stored history. The
   email is real; the totals come from the same sample rows as the dashboard
   until there is a database. */
export default function AccountDetails() {
  const email = useSessionEmail();
  const [state, setState] = useState<{ history: PracticeHistoryEntry[]; now: Date } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    fetchPracticeHistory(now).then((history) => {
      if (!cancelled) setState({ history, now });
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
  const initial = email?.trim().charAt(0).toUpperCase() || "?";

  const rows: [label: string, value: string][] = [
    ["Email", email ?? "—"],
    ["Practicing since", first ? longDate(first.recordedAt) : "—"],
    ["Sessions recorded", history ? `${history.length}` : "—"],
    ["Total practice time", history ? hoursAndMinutes(totalMinutes(history)) : "—"],
    ["Notes graded", history ? totalNotes(history).toLocaleString() : "—"],
    ["Longest streak", streak !== null ? `${streak} ${streak === 1 ? "day" : "days"}` : "—"],
    ["Pieces in rotation", pieces !== null ? `${pieces}` : "—"],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-foreground text-2xl font-semibold text-background">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{email ?? "Signed in"}</p>
          <p className="text-sm text-muted">
            {daysIn === null ? "Loading your history" : `Day ${daysIn} of playing with a buddy.`}
          </p>
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
    </div>
  );
}
