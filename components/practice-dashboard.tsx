"use client";

import { useEffect, useState } from "react";
import {
  ChartSection,
  DataTable,
  FRAME,
  INK,
  Legend,
  StatTile,
  Tooltip,
  columnPath,
  formatDuration,
  labelEvery,
  percent,
  signed,
  useWidth,
  type StatDelta,
} from "@/components/chart-kit";
import PanelSection from "@/components/panel-section";
import {
  dailyTotals,
  fetchPracticeHistory,
  meanOf,
  sessionsInWindow,
  streakDays,
  summarizePieces,
  totalMinutes,
  type DayTotal,
  type PracticeHistoryEntry,
} from "@/lib/practiceHistory";

const TREND_SESSIONS = 12;
const DAYS_OF_MINUTES = 14;

/* Non-breaking space so a date never wraps inside a narrow table cell. */
function shortDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }).replace(/ /g, " ");
}

function fullDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function delta(current: number | null, previous: number | null, unit: string, period: string): StatDelta | undefined {
  if (current === null || previous === null) return undefined;
  const change = Math.round(current - previous);
  return {
    text: `${signed(change, unit)} vs ${period}`,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

/* ---------- Headline tiles ---------- */

function StatTiles({ history, now }: { history: PracticeHistoryEntry[]; now: Date }) {
  const thisWeek = sessionsInWindow(history, now, 7);
  const lastWeek = sessionsInWindow(history, now, 7, 1);
  const minutes = totalMinutes(thisWeek);
  const pitch = meanOf(thisWeek, "pitchAccuracyPct");
  const timing = meanOf(thisWeek, "timingAccuracyPct");
  const cents = meanOf(thisWeek, "meanAbsCents");
  const ms = meanOf(thisWeek, "meanAbsTimingMs");
  const streak = streakDays(history, now);
  const playedToday = sessionsInWindow(history, now, 1).length > 0;

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatTile
        label="This week"
        value={`${minutes} min`}
        detail={`${thisWeek.length} ${thisWeek.length === 1 ? "session" : "sessions"}`}
        delta={delta(minutes, totalMinutes(lastWeek), " min", "last week")}
      />
      <StatTile
        label="Pitch accuracy"
        value={percent(pitch)}
        detail={cents === null ? "No pitch heard this week" : `avg ${Math.round(cents)}¢ off`}
        delta={delta(pitch, meanOf(lastWeek, "pitchAccuracyPct"), " pts", "last week")}
      />
      <StatTile
        label="Timing accuracy"
        value={percent(timing)}
        detail={ms === null ? "No onsets heard this week" : `avg ${Math.round(ms)} ms off`}
        delta={delta(timing, meanOf(lastWeek, "timingAccuracyPct"), " pts", "last week")}
      />
      <StatTile
        label="Streak"
        value={`${streak} ${streak === 1 ? "day" : "days"}`}
        detail={streak === 0 ? "No recent sessions" : playedToday ? "Practiced today" : "Last practiced yesterday"}
      />
    </div>
  );
}

/* ---------- Accuracy by session ---------- */

/* Wider right margin than the shared frame so the direct labels fit. */
const TREND_FRAME = { ...FRAME, right: 52 };

/* Pitch and timing accuracy for the most recent sessions, oldest to newest,
   as two lines. A crosshair snaps to the nearest session and the tooltip
   lists both series, so the reader aims at a date, never at a line. */
function AccuracyTrendChart({ sessions }: { sessions: PracticeHistoryEntry[] }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const count = sessions.length;
  const plotWidth = Math.max(0, width - TREND_FRAME.left - TREND_FRAME.right);
  const plotHeight = TREND_FRAME.height - TREND_FRAME.top - TREND_FRAME.bottom;
  const values = sessions.flatMap((s) => [s.pitchAccuracyPct, s.timingAccuracyPct]).filter((v): v is number => v !== null);
  const min = Math.max(0, Math.floor((Math.min(100, ...values) - 10) / 10) * 10);
  const y = (pct: number) => TREND_FRAME.top + plotHeight - ((pct - min) / (100 - min)) * plotHeight;
  const slot = count ? plotWidth / count : 0;
  const x = (i: number) => TREND_FRAME.left + slot * (i + 0.5);
  /* A date label needs about 44px; on a narrow screen label every k-th session. */
  const every = slot > 0 ? Math.max(labelEvery(count), Math.ceil(44 / slot)) : 1;
  const hovered = hover === null ? null : sessions[hover];

  const series = [
    { key: "pitchAccuracyPct", label: "Pitch", color: INK.flat },
    { key: "timingAccuracyPct", label: "Timing", color: INK.second },
  ] as const;

  function linePath(key: (typeof series)[number]["key"]): string {
    let path = "";
    let penDown = false;
    sessions.forEach((session, i) => {
      const value = session[key];
      if (value === null) {
        penDown = false;
        return;
      }
      path += `${penDown ? "L" : "M"}${x(i)},${y(value)} `;
      penDown = true;
    });
    return path;
  }

  /* Direct labels sit at each line's last point; nudge apart if they collide. */
  const ends = series.map((s) => {
    for (let i = count - 1; i >= 0; i -= 1) {
      const value = sessions[i][s.key];
      if (value !== null) return { ...s, x: x(i), y: y(value) };
    }
    return null;
  });
  if (ends[0] && ends[1] && Math.abs(ends[0].y - ends[1].y) < 12) {
    const upper = ends[0].y < ends[1].y ? ends[0] : ends[1];
    const lower = upper === ends[0] ? ends[1] : ends[0];
    const mid = (upper.y + lower.y) / 2;
    upper.y = mid - 6;
    lower.y = mid + 6;
  }

  return (
    <div ref={ref} className="relative" style={{ height: TREND_FRAME.height }}>
      {width > 0 && count > 0 ? (
        <svg width={width} height={TREND_FRAME.height} role="img" aria-label="Pitch and timing accuracy per session">
          {[min, (min + 100) / 2, 100].map((v) => (
            <g key={v}>
              <line x1={TREND_FRAME.left} x2={TREND_FRAME.left + plotWidth} y1={y(v)} y2={y(v)} stroke={INK.grid} />
              <text x={TREND_FRAME.left - 6} y={y(v)} dy="0.35em" textAnchor="end" fontSize={10} fill={INK.muted}>
                {Math.round(v)}%
              </text>
            </g>
          ))}
          {hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={TREND_FRAME.top} y2={TREND_FRAME.top + plotHeight} stroke={INK.axis} />
          ) : null}
          {series.map((s) => (
            <path key={s.key} d={linePath(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.map((s) =>
            sessions.map((session, i) => {
              const value = session[s.key];
              if (value === null) return null;
              return <circle key={`${s.key}-${session.id}`} cx={x(i)} cy={y(value)} r={hover === i ? 5 : 4} fill={s.color} stroke={INK.surface} strokeWidth={2} />;
            }),
          )}
          {ends.map((end) =>
            end ? (
              <text key={end.key} x={end.x + 8} y={end.y} dy="0.35em" fontSize={10} fontWeight={500} fill={INK.muted}>
                {end.label}
              </text>
            ) : null,
          )}
          {sessions.map((session, i) => {
            /* Two sessions on one day share a single date label. */
            const label = shortDate(session.recordedAt);
            const repeat = i > 0 && shortDate(sessions[i - 1].recordedAt) === label;
            return i % every === 0 && !repeat ? (
              <text key={session.id} x={x(i)} y={TREND_FRAME.height - 6} textAnchor="middle" fontSize={10} fill={INK.muted}>
                {label}
              </text>
            ) : null;
          })}
          {sessions.map((session, i) => (
            <rect
              key={session.id}
              x={TREND_FRAME.left + i * slot}
              y={TREND_FRAME.top}
              width={slot}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              className="outline-none"
              aria-label={`${fullDate(session.recordedAt)}, ${session.piece}: pitch ${percent(session.pitchAccuracyPct)}, timing ${percent(session.timingAccuracyPct)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>
      ) : null}
      {hovered && hover !== null ? (
        <Tooltip
          x={x(hover)}
          width={width}
          title={fullDate(hovered.recordedAt)}
          rows={[
            ["Pitch", percent(hovered.pitchAccuracyPct), INK.flat],
            ["Timing", percent(hovered.timingAccuracyPct), INK.second],
          ]}
          note={hovered.piece}
        />
      ) : null}
    </div>
  );
}

/* ---------- Practice time by day ---------- */

/* One column per day in a single hue: every column measures the same thing,
   so there is no identity or polarity for colour to carry. */
function DailyMinutesChart({ days }: { days: DayTotal[] }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const count = days.length;
  const plotWidth = Math.max(0, width - FRAME.left - FRAME.right);
  const baseline = FRAME.height - FRAME.bottom;
  /* Even ceiling so the half-way tick is a whole minute; a play-through is
     usually only a few minutes, so the floor stays low. */
  const max = Math.max(4, Math.ceil(Math.max(...days.map((d) => d.minutes)) / 2) * 2);
  const y = (minutes: number) => baseline - (minutes / max) * (baseline - FRAME.top);
  const slot = count ? plotWidth / count : 0;
  const barWidth = Math.max(4, Math.min(28, slot - 4));
  const every = slot < 26 ? 2 : 1;
  const hovered = hover === null ? null : days[hover];

  return (
    <div ref={ref} className="relative" style={{ height: FRAME.height }}>
      {width > 0 ? (
        <svg width={width} height={FRAME.height} role="img" aria-label={`Minutes practiced per day over the last ${count} days`}>
          {[max, max / 2].map((v) => (
            <g key={v}>
              <line x1={FRAME.left} x2={FRAME.left + plotWidth} y1={y(v)} y2={y(v)} stroke={INK.grid} />
              <text x={FRAME.left - 6} y={y(v)} dy="0.35em" textAnchor="end" fontSize={10} fill={INK.muted}>
                {v}
              </text>
            </g>
          ))}
          <line x1={FRAME.left} x2={FRAME.left + plotWidth} y1={baseline} y2={baseline} stroke={INK.axis} />
          <text x={FRAME.left - 6} y={baseline} dy="0.35em" textAnchor="end" fontSize={10} fill={INK.muted}>
            0
          </text>
          {days.map((day, i) => {
            const x = FRAME.left + i * slot + (slot - barWidth) / 2;
            const dim = hover !== null && hover !== i;
            return (
              <g key={day.date.toISOString()} opacity={dim ? 0.45 : 1}>
                {day.minutes > 0 ? <path d={columnPath(x, baseline, y(day.minutes), barWidth)} fill={INK.flat} /> : null}
                {(count - 1 - i) % every === 0 ? (
                  <text x={x + barWidth / 2} y={FRAME.height - 6} textAnchor="middle" fontSize={10} fill={INK.muted}>
                    {day.date.getDate()}
                  </text>
                ) : null}
              </g>
            );
          })}
          {days.map((day, i) => (
            <rect
              key={day.date.toISOString()}
              x={FRAME.left + i * slot}
              y={FRAME.top}
              width={slot}
              height={baseline - FRAME.top}
              fill="transparent"
              tabIndex={0}
              className="outline-none"
              aria-label={`${fullDate(day.date)}: ${day.minutes} minutes in ${day.sessions} ${day.sessions === 1 ? "session" : "sessions"}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>
      ) : null}
      {hovered && hover !== null ? (
        <Tooltip
          x={FRAME.left + hover * slot + slot / 2}
          width={width}
          title={fullDate(hovered.date)}
          rows={[
            ["Practiced", `${hovered.minutes} min`],
            ["Sessions", `${hovered.sessions}`],
          ]}
        />
      ) : null}
    </div>
  );
}

/* ---------- History lists ---------- */

function progress(first: number | null, latest: number | null): string {
  if (latest === null) return "—";
  if (first === null || first === latest) return percent(latest);
  return `${percent(first)} → ${percent(latest)}`;
}

function PieceList({ history }: { history: PracticeHistoryEntry[] }) {
  const pieces = summarizePieces(history);
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-surface">
      {pieces.map((piece) => (
        <li key={piece.piece} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 px-3 py-2.5 text-xs">
          <div className="min-w-0">
            <p className="text-sm font-medium">{piece.piece}</p>
            <p className="text-muted">
              {piece.sessions} {piece.sessions === 1 ? "session" : "sessions"} · {piece.completions} complete · last {shortDate(piece.lastPlayedAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted">Pitch</p>
            <p className="font-medium tabular-nums">{progress(piece.firstPitchPct, piece.latestPitchPct)}</p>
          </div>
          <div className="text-right">
            <p className="text-muted">Timing</p>
            <p className="font-medium tabular-nums">{progress(piece.firstTimingPct, piece.latestTimingPct)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecentSessions({ history }: { history: PracticeHistoryEntry[] }) {
  const rows = history.slice(0, 8).map((entry) => [
    shortDate(entry.recordedAt),
    entry.piece,
    formatDuration(entry.durationSeconds),
    `${entry.measuresPlayed}/${entry.measuresInPiece}${entry.completed ? "" : " · stopped"}`,
    percent(entry.pitchAccuracyPct),
    percent(entry.timingAccuracyPct),
    percent(entry.articulationAccuracyPct),
    entry.tempoPlayed === null ? `— / ${entry.tempoTarget}` : `${Math.round(entry.tempoPlayed)} / ${entry.tempoTarget}`,
  ]);
  return (
    <DataTable
      table={{
        columns: ["Date", { label: "Piece", wrap: true }, "Length", "Measures", "Pitch", "Timing", "Articulation", "Tempo (bpm)"],
        rows,
      }}
    />
  );
}

/* ---------- Dashboard ---------- */

/* The home-page dashboard: headline stats, trends, and past sessions built
   from the stored history rows. History loads after mount, the way a database
   fetch will, so the server render never disagrees with the client's clock. */
export default function PracticeDashboard() {
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

  if (!state) {
    return (
      <div className="flex flex-col gap-8" aria-busy>
        <PanelSection eyebrow="Progress" title="Your practice">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {["This week", "Pitch accuracy", "Timing accuracy", "Streak"].map((label) => (
              <StatTile key={label} label={label} value="—" />
            ))}
          </div>
        </PanelSection>
      </div>
    );
  }

  const { history, now } = state;
  const trend = history.slice(0, TREND_SESSIONS).reverse();
  const days = dailyTotals(history, now, DAYS_OF_MINUTES);

  return (
    <div className="flex flex-col gap-8">
      <PanelSection
        eyebrow="Progress"
        title="Your practice"
        aside={<span title="A real database is coming; until then these are sample sessions.">Sample data</span>}
      >
        <StatTiles history={history} now={now} />
      </PanelSection>

      <ChartSection
        eyebrow="Progress"
        title="Accuracy by session"
        table={{
          columns: ["Date", { label: "Piece", wrap: true }, "Pitch", "Timing"],
          rows: trend.map((s) => [shortDate(s.recordedAt), s.piece, percent(s.pitchAccuracyPct), percent(s.timingAccuracyPct)]),
        }}
      >
        <AccuracyTrendChart sessions={trend} />
        <Legend
          items={[
            { color: INK.flat, label: "Pitch: notes within tolerance", line: true },
            { color: INK.second, label: "Timing: onsets within tolerance", line: true },
          ]}
        />
      </ChartSection>

      <ChartSection
        eyebrow="Progress"
        title="Practice time"
        table={{
          columns: ["Day", "Minutes", "Sessions"],
          rows: days.map((d) => [fullDate(d.date), d.minutes, d.sessions]),
        }}
      >
        <DailyMinutesChart days={days} />
        <p className="text-xs text-muted">Minutes per day over the last {DAYS_OF_MINUTES} days.</p>
      </ChartSection>

      <PanelSection eyebrow="History" title="Pieces">
        <PieceList history={history} />
      </PanelSection>

      <PanelSection eyebrow="History" title="Recent sessions">
        <RecentSessions history={history} />
      </PanelSection>
    </div>
  );
}
