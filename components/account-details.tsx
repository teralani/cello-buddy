"use client";

import { useEffect, useState } from "react";
import { fetchPracticeHistory, totalMinutes, type PracticeHistoryEntry } from "@/lib/practiceHistory";
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
  const [history, setHistory] = useState<PracticeHistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPracticeHistory().then((rows) => {
      if (!cancelled) setHistory(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const first = history?.[history.length - 1];
  const rows: [label: string, value: string][] = [
    ["Email", email ?? "—"],
    ["Practicing since", first ? longDate(first.recordedAt) : "—"],
    ["Sessions recorded", history ? `${history.length}` : "—"],
    ["Total practice time", history ? hoursAndMinutes(totalMinutes(history)) : "—"],
  ];

  return (
    <dl className="divide-y divide-border rounded-md border border-border bg-surface">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2.5 text-sm">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
