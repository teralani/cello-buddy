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
  formatDuration,
  labelEvery,
  percent,
  signed,
  useWidth,
  type StatDelta,
} from "@/components/chart-kit";
import Milestones from "@/components/milestones";
import PanelSection from "@/components/panel-section";
import { milestones } from "@/lib/milestones";
import {
  daysSince,
  fetchPracticeHistory,
  meanOf,
  personalBests,
  playedDays,
  sessionsInWindow,
  streakDays,
  summarizePieces,
  totalMinutes,
  weeklyCalendar,
  type DayTotal,
  type PracticeHistoryEntry,
} from "@/lib/practiceHistory";
import { useSessionEmail } from "@/lib/useSessionEmail";

const TREND_SESSIONS = 12;
const CALENDAR_WEEKS = 12;

function shortDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fullDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* "Prelude from Suite No. 1 (Bach)" reads as "the Prelude" in a sentence. */
function shortPiece(piece: string): string {
  const head = piece.replace(/\s*\(.*\)\s*$/, "").split(/ from | in /)[0].trim();
  return head.length > 0 && head.length < piece.length ? `the ${head}` : piece;
}

function delta(current: number | null, previous: number | null, unit: string, period: string): StatDelta | undefined {
  if (current === null || previous === null) return undefined;
  const change = Math.round(current - previous);
  return {
    text: `${signed(change, unit)} vs ${period}`,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

/* ---------- Greeting ---------- */

/* The part of an email before the @, if it looks like a name. */
function nameFromEmail(email: string | null): string | null {
  const local = email?.split("@")[0]?.split(/[._\-+0-9]/)[0] ?? "";
  if (local.length < 2 || local.length > 14 || !/^[a-z]+$/i.test(local)) return null;
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}

/* One or two sentences picked from what the history actually says. */
function greetingLine(history: PracticeHistoryEntry[], now: Date): string {
  const parts: string[] = [];
  const streak = streakDays(history, now);
  const latest = history[0];
  const newBest = personalBests(history, now).find((b) => b.recordedAt !== "" && daysSince(b.recordedAt, now) <= 6 && b.label !== "Longest streak");

  if (streak >= 2) parts.push(`${streak} days running.`);
  if (newBest) {
    parts.push(`New ${newBest.label.toLowerCase()} this week: ${newBest.value} on ${shortPiece(newBest.detail)}.`);
  } else if (latest && daysSince(latest.recordedAt, now) >= 2) {
    const gap = daysSince(latest.recordedAt, now);
    parts.push(`It has been ${gap} days since your last session. ${shortPiece(latest.piece)} is waiting.`);
  } else if (latest) {
    parts.push(`Last time: ${shortPiece(latest.piece)}, ${percent(latest.pitchAccuracyPct)} in tune.`);
  } else {
    parts.push("Load a score and the numbers start here.");
  }
  return parts.join(" ");
}

function Greeting({ history, now }: { history: PracticeHistoryEntry[]; now: Date }) {
  const email = useSessionEmail();
  const name = nameFromEmail(email);
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">
        Good {timeOfDay}
        {name ? `, ${name}` : ""}.
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{greetingLine(history, now)}</p>
    </div>
  );
}

/* ---------- Headline tiles ---------- */

function WeekStrip({ days }: { days: { date: Date; played: boolean }[] }) {
  return (
    <ol className="flex justify-between gap-1" aria-label="Last seven days">
      {days.map((day, i) => {
        const letter = day.date.toLocaleDateString(undefined, { weekday: "narrow" });
        return (
          <li key={day.date.toISOString()} className="flex flex-col items-center gap-1 text-[10px] text-muted" aria-label={`${fullDate(day.date)}: ${day.played ? "practiced" : "rest day"}`}>
            <span
              aria-hidden
              className={`chart-fade block h-3 w-3 rounded-sm ${day.played ? "bg-foreground" : "border border-border-strong"}`}
              style={{ animationDelay: `${i * 50}ms` }}
            />
            <span aria-hidden>{letter}</span>
          </li>
        );
      })}
    </ol>
  );
}

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
        detail={streak === 0 ? "Today is a good day to start one" : playedToday ? "Practiced today" : "Play today to keep it"}
      >
        <WeekStrip days={playedDays(history, now, 7)} />
      </StatTile>
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
  const every = labelEvery(count);
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
          {series.map((s, i) => (
            <path
              key={s.key}
              d={linePath(s.key)}
              pathLength={1}
              className="chart-draw"
              style={{ animationDelay: `${i * 150}ms` }}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {series.map((s) =>
            sessions.map((session, i) => {
              const value = session[s.key];
              if (value === null) return null;
              return (
                <circle
                  key={`${s.key}-${session.id}`}
                  className="chart-fade"
                  style={{ animationDelay: `${300 + (i / Math.max(1, count - 1)) * 800}ms` }}
                  cx={x(i)}
                  cy={y(value)}
                  r={hover === i ? 5 : 4}
                  fill={s.color}
                  stroke={INK.surface}
                  strokeWidth={2}
                />
              );
            }),
          )}
          {ends.map((end) =>
            end ? (
              <text key={end.key} className="chart-fade" style={{ animationDelay: "1100ms" }} x={end.x + 8} y={end.y} dy="0.35em" fontSize={10} fontWeight={500} fill={INK.muted}>
                {end.label}
              </text>
            ) : null,
          )}
          {sessions.map((session, i) =>
            i % every === 0 ? (
              <text key={session.id} x={x(i)} y={TREND_FRAME.height - 6} textAnchor="middle" fontSize={10} fill={INK.muted}>
                {shortDate(session.recordedAt)}
              </text>
            ) : null,
          )}
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

/* ---------- Practice calendar ---------- */

/* One hue, light to dark, for minutes in a day. Lightness steps down
   monotonically so the scale reads in any colour vision. */
const CALENDAR_STEPS = [INK.band, "#cde2fb", "#93bff1", "#5b9be6", INK.flat];
const CALENDAR_LABELS = ["Rest", "Under 3 min", "3 to 4 min", "5 to 6 min", "7 min or more"];

function calendarStep(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes <= 2) return 1;
  if (minutes <= 4) return 2;
  if (minutes <= 6) return 3;
  return 4;
}

/* Twelve weeks of days as a grid, one column per week, Monday at the top.
   Darker cells are longer days; the gaps are as much the story as the fills. */
function PracticeCalendar({ weeks }: { weeks: (DayTotal | null)[][] }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<[number, number] | null>(null);
  const gutter = 28;
  const gap = 3;
  const cell = Math.max(9, Math.min(18, Math.floor((width - gutter) / weeks.length) - gap));
  const pitch = cell + gap;
  const height = 7 * pitch - gap + 16;
  const hovered = hover ? weeks[hover[0]][hover[1]] : null;
  const dayNames = ["M", "T", "W", "T", "F", "S", "S"];

  /* Month labels sit above the first column in which that month starts. */
  const monthLabels = weeks.map((column, w) => {
    const first = column.find((d): d is DayTotal => d !== null);
    if (!first) return null;
    const previous = w > 0 ? weeks[w - 1].find((d): d is DayTotal => d !== null) : null;
    if (previous && previous.date.getMonth() === first.date.getMonth()) return null;
    return first.date.toLocaleDateString(undefined, { month: "short" });
  });

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={`Practice days over the last ${weeks.length} weeks`}>
          {monthLabels.map((label, w) =>
            label ? (
              <text key={w} x={gutter + w * pitch} y={10} fontSize={10} fill={INK.muted}>
                {label}
              </text>
            ) : null,
          )}
          {dayNames.map((name, d) =>
            d % 2 === 0 ? (
              <text key={d} x={gutter - 8} y={16 + d * pitch + cell / 2} dy="0.35em" textAnchor="end" fontSize={10} fill={INK.muted}>
                {name}
              </text>
            ) : null,
          )}
          {weeks.map((column, w) =>
            column.map((day, d) => {
              if (!day) return null;
              const dim = hover !== null && (hover[0] !== w || hover[1] !== d);
              return (
                <rect
                  key={day.date.toISOString()}
                  className="chart-fade"
                  style={{ animationDelay: `${w * 40 + d * 10}ms` }}
                  x={gutter + w * pitch}
                  y={16 + d * pitch}
                  width={cell}
                  height={cell}
                  rx={2}
                  fill={CALENDAR_STEPS[calendarStep(day.minutes)]}
                  opacity={dim ? 0.5 : 1}
                />
              );
            }),
          )}
          {weeks.map((column, w) =>
            column.map((day, d) =>
              day ? (
                <rect
                  key={`hit-${day.date.toISOString()}`}
                  x={gutter + w * pitch - gap / 2}
                  y={16 + d * pitch - gap / 2}
                  width={pitch}
                  height={pitch}
                  fill="transparent"
                  tabIndex={0}
                  className="outline-none"
                  aria-label={`${fullDate(day.date)}: ${day.minutes === 0 ? "rest day" : `${day.minutes} minutes in ${day.sessions} ${day.sessions === 1 ? "session" : "sessions"}`}`}
                  onMouseEnter={() => setHover([w, d])}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover([w, d])}
                  onBlur={() => setHover(null)}
                />
              ) : null,
            ),
          )}
        </svg>
      ) : null}
      {hovered && hover ? (
        <Tooltip
          x={gutter + hover[0] * pitch + cell / 2}
          y={16 + hover[1] * pitch - 4}
          width={width}
          title={fullDate(hovered.date)}
          rows={hovered.sessions === 0 ? [["Practiced", "rest day"]] : [["Practiced", `${hovered.minutes} min`], ["Sessions", `${hovered.sessions}`]]}
        />
      ) : null}
    </div>
  );
}

/* ---------- Personal bests ---------- */

function PersonalBests({ history, now }: { history: PracticeHistoryEntry[]; now: Date }) {
  const bests = personalBests(history, now);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 [&>*]:min-w-0">
      {bests.map((best, i) => {
        const fresh = best.recordedAt !== "" && daysSince(best.recordedAt, now) <= 6;
        return (
          <div key={best.label} className="chart-fade rounded-md border border-border bg-surface px-3 py-2.5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] text-muted">{best.label}</p>
              {fresh ? <span className="shrink-0 rounded-sm border border-foreground px-1 text-[9px] font-medium uppercase tracking-wider">New</span> : null}
            </div>
            <p className="mt-0.5 text-xl font-semibold tracking-tight">{best.value}</p>
            <p className="text-[11px] leading-snug text-muted">{best.detail}</p>
            {best.recordedAt !== "" ? <p className="text-[11px] text-muted">{shortDate(best.recordedAt)}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- History lists ---------- */

function progress(first: number | null, latest: number | null): string {
  if (latest === null) return "—";
  if (first === null || first === latest) return percent(latest);
  return `${percent(first)} → ${percent(latest)}`;
}

/* One line of encouragement or a prod, from the piece's own numbers. */
function pieceNote(piece: ReturnType<typeof summarizePieces>[number], now: Date): string | null {
  const idle = daysSince(piece.lastPlayedAt, now);
  if (idle >= 3) return `Not played in ${idle} days. It misses you.`;
  const gain = piece.firstPitchPct !== null && piece.latestPitchPct !== null ? piece.latestPitchPct - piece.firstPitchPct : 0;
  if (gain >= 20) return `Up ${Math.round(gain)} points in tune since you started it.`;
  if (piece.completions === 0) return "Still waiting on a first full play-through.";
  if (piece.latestPitchPct !== null && piece.latestPitchPct >= 85) return "Sounding solid. Try nudging the tempo up.";
  return null;
}

function PieceList({ history, now }: { history: PracticeHistoryEntry[]; now: Date }) {
  const pieces = summarizePieces(history);
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-surface">
      {pieces.map((piece) => {
        const note = pieceNote(piece, now);
        return (
          <li key={piece.piece} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 px-3 py-2.5 text-xs">
            <div className="min-w-0">
              <p className="text-sm font-medium">{piece.piece}</p>
              <p className="text-muted">
                {piece.sessions} {piece.sessions === 1 ? "session" : "sessions"} · {piece.completions} complete · last {shortDate(piece.lastPlayedAt)}
              </p>
              {note ? <p className="mt-0.5 text-foreground">{note}</p> : null}
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
        );
      })}
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
  return <DataTable table={{ columns: ["Date", "Piece", "Length", "Measures", "Pitch", "Timing", "Articulation", "Tempo (bpm)"], rows }} />;
}

/* ---------- Dashboard ---------- */

/* The home-page dashboard: a greeting, headline stats, trends, bests,
   milestones, and past sessions, all built from the stored history rows.
   History loads after mount, the way a database fetch will, so the server
   render never disagrees with the client's clock. */
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
  const weeks = weeklyCalendar(history, now, CALENDAR_WEEKS);
  const playedDaysInCalendar = weeks.flat().filter((d): d is DayTotal => d !== null && d.sessions > 0);

  return (
    <div className="flex flex-col gap-8">
      <Greeting history={history} now={now} />

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
        title="Practice calendar"
        table={{
          columns: ["Day", "Minutes", "Sessions"],
          rows: playedDaysInCalendar.map((d) => [fullDate(d.date), d.minutes, d.sessions]),
        }}
      >
        <PracticeCalendar weeks={weeks} />
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {CALENDAR_STEPS.map((color, i) => (
            <li key={color} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm border border-border" style={{ background: color }} />
              {CALENDAR_LABELS[i]}
            </li>
          ))}
        </ul>
      </ChartSection>

      <PanelSection eyebrow="Records" title="Personal bests" aside="Single-session figures">
        <PersonalBests history={history} now={now} />
      </PanelSection>

      <PanelSection eyebrow="Records" title="Milestones">
        <Milestones items={milestones(history, now)} />
      </PanelSection>

      <PanelSection eyebrow="History" title="Pieces">
        <PieceList history={history} now={now} />
      </PanelSection>

      <PanelSection eyebrow="History" title="Recent sessions">
        <RecentSessions history={history} />
      </PanelSection>
    </div>
  );
}
