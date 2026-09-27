"use client";

import { Fragment, useState } from "react";
import {
  ChartSection,
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
} from "@/components/chart-kit";
import IntonationHeatmap from "@/components/intonation-heatmap";
import PanelSection from "@/components/panel-section";
import type { MeasureMetrics, PracticeMetrics } from "@/lib/metrics";
import { useSessionMetrics } from "@/lib/useSessionMetrics";

/* A measure whose mean error is inside this many cents reads as in tune on the
   drift chart, matching the pitch map's colour scale above it. */
const IN_TUNE_CENTS = 10;

/* The measure with the lowest combined pitch and timing accuracy: the one
   place to drill next. null when no measure has a score on either axis. */
function toughestMeasure(measures: MeasureMetrics[]): MeasureMetrics | null {
  let worst: MeasureMetrics | null = null;
  let worstScore = Infinity;
  for (const measure of measures) {
    const scores = [measure.pitch.accuracyPct, measure.timing.accuracyPct].filter((v): v is number => v !== null);
    if (scores.length === 0) continue;
    const score = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (score < worstScore) {
      worstScore = score;
      worst = measure;
    }
  }
  return worst;
}

function StatTiles({ metrics }: { metrics: PracticeMetrics }) {
  const { summary } = metrics;
  const toughest = toughestMeasure(metrics.measures);
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatTile
        label="Pitch accuracy"
        value={percent(summary.pitchAccuracyPct)}
        detail={summary.meanAbsCents === null ? "No pitch heard" : `avg ${summary.meanAbsCents}¢ off`}
      />
      <StatTile
        label="Timing accuracy"
        value={percent(summary.timingAccuracyPct)}
        detail={summary.meanAbsTimingMs === null ? "No onsets heard" : `avg ${summary.meanAbsTimingMs} ms off`}
      />
      <StatTile
        label="Articulation"
        value={percent(summary.articulationAccuracyPct)}
        detail={summary.articulationAccuracyPct === null ? "No style markings" : "Marked notes matched"}
      />
      <StatTile
        label="Measures played"
        value={`${metrics.measures.length}/${metrics.measuresInPiece}`}
        detail={`${summary.gradedNotes} notes · ${formatDuration(metrics.durationSeconds)}${metrics.completed ? "" : " · stopped early"}`}
      />
      <StatTile
        label="Toughest measure"
        value={toughest === null ? "—" : `m. ${toughest.number}`}
        detail={
          toughest === null
            ? "No measure scored"
            : `pitch ${percent(toughest.pitch.accuracyPct)} · timing ${percent(toughest.timing.accuracyPct)}`
        }
      />
    </div>
  );
}

/* Diverging columns: one per measure, up for sharp, down for flat. */
function PitchDriftChart({ measures }: { measures: MeasureMetrics[] }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const count = measures.length;
  const plotWidth = Math.max(0, width - FRAME.left - FRAME.right);
  const plotHeight = FRAME.height - FRAME.top - FRAME.bottom;
  const maxAbs = Math.max(IN_TUNE_CENTS * 2, ...measures.map((m) => Math.abs(m.pitch.meanCents ?? 0)));
  const domain = Math.min(50, Math.ceil(maxAbs / 10) * 10);
  const y = (cents: number) =>
    FRAME.top + plotHeight / 2 - (Math.max(-domain, Math.min(domain, cents)) / domain) * (plotHeight / 2);
  const zero = y(0);
  const slot = count ? plotWidth / count : 0;
  const barWidth = Math.max(3, Math.min(24, slot - 2));
  const every = labelEvery(count);
  const hovered = hover === null ? null : measures[hover];

  return (
    <div ref={ref} className="relative" style={{ height: FRAME.height }}>
      {width > 0 ? (
        <svg width={width} height={FRAME.height} role="img" aria-label="Mean pitch error per measure, in cents">
          <rect x={FRAME.left} y={y(IN_TUNE_CENTS)} width={plotWidth} height={y(-IN_TUNE_CENTS) - y(IN_TUNE_CENTS)} fill={INK.band} />
          {[domain, -domain].map((v) => (
            <line key={v} x1={FRAME.left} x2={FRAME.left + plotWidth} y1={y(v)} y2={y(v)} stroke={INK.grid} />
          ))}
          <line x1={FRAME.left} x2={FRAME.left + plotWidth} y1={zero} y2={zero} stroke={INK.axis} />
          {[domain, 0, -domain].map((v) => (
            <text key={v} x={FRAME.left - 6} y={y(v)} dy="0.35em" textAnchor="end" fontSize={10} fill={INK.muted}>
              {v === 0 ? "0" : signed(v, "¢")}
            </text>
          ))}
          {measures.map((measure, i) => {
            const x = FRAME.left + i * slot + (slot - barWidth) / 2;
            const cents = measure.pitch.meanCents;
            const dim = hover !== null && hover !== i;
            const fill = cents === null ? INK.muted : Math.abs(cents) <= IN_TUNE_CENTS ? INK.neutral : cents > 0 ? INK.sharp : INK.flat;
            return (
              <g key={measure.number} opacity={dim ? 0.45 : 1}>
                {cents === null ? (
                  <circle cx={x + barWidth / 2} cy={zero} r={3} fill={INK.surface} stroke={INK.muted} strokeWidth={1.5} />
                ) : (
                  <path d={columnPath(x, zero, y(cents), barWidth)} fill={fill} />
                )}
                {i % every === 0 ? (
                  <text x={x + barWidth / 2} y={FRAME.height - 6} textAnchor="middle" fontSize={10} fill={INK.muted}>
                    {measure.number}
                  </text>
                ) : null}
              </g>
            );
          })}
          {measures.map((measure, i) => (
            <rect
              key={measure.number}
              x={FRAME.left + i * slot}
              y={FRAME.top}
              width={slot}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              className="outline-none"
              aria-label={`Measure ${measure.number}: ${measure.pitch.meanCents === null ? "no pitch heard" : signed(measure.pitch.meanCents, " cents")}`}
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
          title={`Measure ${hovered.number}`}
          rows={[
            ["Mean error", hovered.pitch.meanCents === null ? "not heard" : signed(hovered.pitch.meanCents, "¢")],
            ["Worst note", hovered.pitch.maxAbsCents === null ? "—" : `${hovered.pitch.maxAbsCents}¢`],
            ["In tolerance", percent(hovered.pitch.accuracyPct)],
            ["Unheard", `${hovered.pitch.unheard} of ${hovered.notes}`],
          ]}
        />
      ) : null}
    </div>
  );
}

/* Played tempo per measure as a line against the target tempo. */
function TempoChart({ metrics }: { metrics: PracticeMetrics }) {
  const { measures, tempo } = metrics;
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const count = measures.length;
  const plotWidth = Math.max(0, width - FRAME.left - FRAME.right);
  const plotHeight = FRAME.height - FRAME.top - FRAME.bottom;
  const played = measures.map((m) => m.timing.playedBpm).filter((v): v is number => v !== null);
  const low = Math.min(tempo.target, ...played);
  const high = Math.max(tempo.target, ...played);
  const pad = Math.max(6, (high - low) * 0.15);
  const min = Math.floor((low - pad) / 5) * 5;
  const max = Math.ceil((high + pad) / 5) * 5;
  const y = (bpm: number) => FRAME.top + plotHeight - ((bpm - min) / (max - min)) * plotHeight;
  const slot = count ? plotWidth / count : 0;
  const x = (i: number) => FRAME.left + slot * (i + 0.5);
  const every = labelEvery(count);
  const showMarkers = count <= 24;
  const hovered = hover === null ? null : measures[hover];

  let path = "";
  let penDown = false;
  measures.forEach((measure, i) => {
    const bpm = measure.timing.playedBpm;
    if (bpm === null) {
      penDown = false;
      return;
    }
    path += `${penDown ? "L" : "M"}${x(i)},${y(bpm)} `;
    penDown = true;
  });

  /* Skip an edge tick that would collide with the target label. */
  const ticks = [min, tempo.target, max].filter((v, i) => i === 1 || Math.abs(y(v) - y(tempo.target)) > 12);

  return (
    <div ref={ref} className="relative" style={{ height: FRAME.height }}>
      {width > 0 ? (
        <svg width={width} height={FRAME.height} role="img" aria-label="Tempo played per measure against the target tempo">
          {[min, max].map((v) => (
            <line key={v} x1={FRAME.left} x2={FRAME.left + plotWidth} y1={y(v)} y2={y(v)} stroke={INK.grid} />
          ))}
          <line x1={FRAME.left} x2={FRAME.left + plotWidth} y1={y(tempo.target)} y2={y(tempo.target)} stroke={INK.axis} strokeWidth={1.5} />
          {ticks.map((v) => (
            <text key={v} x={FRAME.left - 6} y={y(v)} dy="0.35em" textAnchor="end" fontSize={10} fill={INK.muted}>
              {v}
            </text>
          ))}
          {hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={FRAME.top} y2={FRAME.top + plotHeight} stroke={INK.axis} />
          ) : null}
          <path d={path} fill="none" stroke={INK.flat} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {measures.map((measure, i) => {
            const bpm = measure.timing.playedBpm;
            if (bpm === null || (!showMarkers && hover !== i)) return null;
            return <circle key={measure.number} cx={x(i)} cy={y(bpm)} r={hover === i ? 5 : 4} fill={INK.flat} stroke={INK.surface} strokeWidth={2} />;
          })}
          {measures.map((measure, i) =>
            i % every === 0 ? (
              <text key={measure.number} x={x(i)} y={FRAME.height - 6} textAnchor="middle" fontSize={10} fill={INK.muted}>
                {measure.number}
              </text>
            ) : null,
          )}
          {measures.map((measure, i) => (
            <rect
              key={measure.number}
              x={FRAME.left + i * slot}
              y={FRAME.top}
              width={slot}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              className="outline-none"
              aria-label={`Measure ${measure.number}: ${measure.timing.playedBpm === null ? "tempo not measured" : `${measure.timing.playedBpm} bpm`}`}
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
          title={`Measure ${hovered.number}`}
          rows={[
            ["Played", hovered.timing.playedBpm === null ? "not measured" : `${hovered.timing.playedBpm} bpm`],
            ["vs target", hovered.timing.playedBpm === null ? "—" : signed(hovered.timing.playedBpm - tempo.target, " bpm")],
            ["Onsets", hovered.timing.meanDeviationMs === null ? "—" : `${signed(hovered.timing.meanDeviationMs, " ms")} ${hovered.timing.meanDeviationMs < 0 ? "early" : "late"}`],
            ["In tolerance", percent(hovered.timing.accuracyPct)],
          ]}
        />
      ) : null}
    </div>
  );
}

/* How the right wrist travelled: tilt of its path, share of sideways motion,
   and bow changes seen against the ones the score asks for. */
function BowPath({ metrics }: { metrics: PracticeMetrics }) {
  const bow = metrics.summary.bow;
  const written = metrics.measures.reduce((sum, m) => sum + m.bowedNotes, 0);
  if (!bow || bow.samples === 0) {
    return (
      <p className="rounded-md border border-border bg-surface p-3 text-sm text-muted">
        The camera did not track your bow arm this session.
      </p>
    );
  }
  const angle = bow.pathAngleDeg;
  const share = bow.horizontalShare;
  const radians = ((angle ?? 0) * Math.PI) / 180;
  const dx = Math.cos(radians) * 38;
  const dy = Math.sin(radians) * 38;
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-4 rounded-md border border-border bg-surface p-3">
      <svg
        viewBox="0 0 96 80"
        width={96}
        height={80}
        role="img"
        aria-label={angle === null ? "Bow path tilt unknown" : `Bow path tilted ${Math.round(angle)} degrees from level`}
      >
        <line x1={6} x2={90} y1={40} y2={40} stroke={INK.grid} />
        <text x={90} y={52} textAnchor="end" fontSize={9} fill={INK.muted}>level</text>
        {angle !== null ? (
          <line x1={48 - dx} y1={40 + dy} x2={48 + dx} y2={40 - dy} stroke={INK.flat} strokeWidth={2} strokeLinecap="round" />
        ) : null}
        <circle cx={48} cy={40} r={4} fill={INK.flat} stroke={INK.surface} strokeWidth={2} />
      </svg>
      <dl className="grid gap-2.5 text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Path tilt</dt>
          <dd className="font-medium tabular-nums">{angle === null ? "barely moved" : `${Math.round(angle)}° from level`}</dd>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-muted">Sideways travel</dt>
            <dd className="font-medium tabular-nums">{share === null ? "—" : `${Math.round(share * 100)}%`}</dd>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: INK.track }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round((share ?? 0) * 100)}%`, background: INK.flat }} />
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted">Bow changes seen</dt>
          <dd className="font-medium tabular-nums">
            {bow.reversals} <span className="font-normal text-muted">of {written} written</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* One spoke of the spider map: a 0 to 100 score for one area of playing.
   `value` is null when the session did not measure that area. */
type RadarAxis = { label: string; value: number | null; basis: string };

function radarAxes(metrics: PracticeMetrics): RadarAxis[] {
  const { summary } = metrics;
  const share = summary.bow?.horizontalShare ?? null;
  return [
    { label: "Pitch", value: summary.pitchAccuracyPct, basis: "Notes within the pitch tolerance" },
    { label: "Rhythm", value: summary.timingAccuracyPct, basis: "Onsets within the timing tolerance" },
    { label: "Bow", value: share === null ? null : Math.round(share * 100), basis: "Share of bow-arm travel that was sideways" },
    { label: "Musical Slurs", value: summary.slurAccuracyPct, basis: "Slurred notes kept in one bow" },
    { label: "Articulation", value: summary.articulationAccuracyPct, basis: "Explicit style markings matched" },
    { label: "Dynamics", value: summary.dynamicAccuracyPct, basis: "Notes played at the marked dynamic" },
  ];
}

function ArticulationChart({ measures }: { measures: MeasureMetrics[] }) {
  const [ref, width] = useWidth();
  const plotWidth = Math.max(0, width - FRAME.left - FRAME.right);
  const slot = measures.length ? plotWidth / measures.length : 0;
  const barWidth = Math.max(4, Math.min(24, slot - 2));
  const every = labelEvery(measures.length);
  return (
    <div ref={ref} className="relative" style={{ height: FRAME.height }}>
      {width > 0 ? (
        <svg width={width} height={FRAME.height} role="img" aria-label="Articulation accuracy per measure">
          {[0, 50, 100].map((value) => {
            const y = FRAME.top + (100 - value) / 100 * (FRAME.height - FRAME.top - FRAME.bottom);
            return <line key={value} x1={FRAME.left} x2={FRAME.left + plotWidth} y1={y} y2={y} stroke={INK.grid} />;
          })}
          {measures.map((measure, index) => {
            const value = measure.articulation.accuracyPct;
            const x = FRAME.left + index * slot + (slot - barWidth) / 2;
            const baseline = FRAME.height - FRAME.bottom;
            const y = value === null ? baseline : baseline - (value / 100) * (baseline - FRAME.top);
            return (
              <Fragment key={measure.number}>
                <rect x={x} y={y} width={barWidth} height={Math.max(0, baseline - y)} rx={2} fill={value === null ? INK.neutral : INK.flat} />
                {index % every === 0 ? <text x={x + barWidth / 2} y={baseline + 16} textAnchor="middle" fill={INK.muted} fontSize="10">{measure.number}</text> : null}
              </Fragment>
            );
          })}
          <text x={FRAME.left - 6} y={FRAME.top + 4} textAnchor="end" fill={INK.muted} fontSize="10">100</text>
          <text x={FRAME.left - 6} y={FRAME.height - FRAME.bottom + 4} textAnchor="end" fill={INK.muted} fontSize="10">0</text>
        </svg>
      ) : null}
    </div>
  );
}

/* A spider map over every area the session measured. Missing areas are left
   out rather than drawn at zero, so the shape only reflects real scores. */
function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const measured = axes.filter((axis): axis is RadarAxis & { value: number } => axis.value !== null);
  const count = measured.length;
  const size = Math.min(width, 320);
  const cx = width / 2;
  const cy = size / 2;
  const radius = Math.max(0, size / 2 - 48);
  const angle = (i: number) => -Math.PI / 2 + (i / count) * 2 * Math.PI;
  const point = (i: number, r: number): [number, number] => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  const ring = (fraction: number) => measured.map((_, i) => point(i, radius * fraction).join(",")).join(" ");
  const hovered = hover === null ? null : measured[hover];

  if (count < 3) {
    return (
      <p className="rounded-md border border-border bg-surface p-3 text-sm text-muted">
        Too few areas were measured this session to draw a spider map.
      </p>
    );
  }

  return (
    <div ref={ref} className="relative" style={{ minHeight: 200 }}>
      {width > 0 ? (
        <svg width={width} height={size} role="img" aria-label="Spider map of session scores out of 100">
          {[0.25, 0.5, 0.75, 1].map((fraction) => (
            <polygon key={fraction} points={ring(fraction)} fill="none" stroke={fraction === 1 ? INK.axis : INK.grid} />
          ))}
          {measured.map((axis, i) => {
            const [x, y] = point(i, radius);
            return <line key={axis.label} x1={cx} y1={cy} x2={x} y2={y} stroke={INK.grid} />;
          })}
          <polygon
            points={measured.map((axis, i) => point(i, (radius * axis.value) / 100).join(",")).join(" ")}
            fill={INK.flat}
            fillOpacity={0.12}
            stroke={INK.flat}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {measured.map((axis, i) => {
            const [x, y] = point(i, (radius * axis.value) / 100);
            const [lx, ly] = point(i, radius + 16);
            const cos = Math.cos(angle(i));
            const sin = Math.sin(angle(i));
            const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";
            const shift = sin < -0.15 ? -7 : sin > 0.15 ? 7 : 0;
            const active = hover === i;
            return (
              <g key={axis.label}>
                <text x={lx} y={ly + shift - 6} textAnchor={anchor} fontSize={10} fill={INK.muted}>{axis.label}</text>
                <text x={lx} y={ly + shift + 7} textAnchor={anchor} fontSize={11} fontWeight={600} fill={active ? "#1c1b19" : INK.muted}>
                  {axis.value}
                </text>
                <circle cx={x} cy={y} r={active ? 5 : 4} fill={INK.flat} stroke={INK.surface} strokeWidth={2} />
                <circle
                  cx={x}
                  cy={y}
                  r={18}
                  fill="transparent"
                  tabIndex={0}
                  className="outline-none"
                  aria-label={`${axis.label}: ${axis.value} out of 100`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      ) : null}
      {hovered && hover !== null ? (
        <Tooltip
          x={point(hover, (radius * hovered.value) / 100)[0]}
          y={Math.max(4, point(hover, (radius * hovered.value) / 100)[1] - 24)}
          width={width}
          title={hovered.label}
          rows={[["Score", `${hovered.value} / 100`]]}
          note={hovered.basis}
        />
      ) : null}
    </div>
  );
}

export default function SessionInsights() {
  const metrics = useSessionMetrics();
  const measures = metrics?.measures ?? [];
  const axes = metrics ? radarAxes(metrics) : [];
  const unmeasured = axes.filter((axis) => axis.value === null).map((axis) => axis.label.toLowerCase());

  return (
    <div className="flex flex-col gap-7 p-4 sm:p-6">
      {metrics ? (
        <>
          <PanelSection eyebrow="Session" title="At a glance">
            <StatTiles metrics={metrics} />
          </PanelSection>
          <ChartSection
            eyebrow="Session"
            title="Spider map"
            table={{
              columns: ["Area", "Score", "Basis"],
              rows: axes.map((axis) => [axis.label, axis.value === null ? "—" : `${axis.value} / 100`, axis.value === null ? "Not measured" : axis.basis]),
            }}
          >
            <RadarChart axes={axes} />
            {unmeasured.length > 0 ? (
              <p className="text-xs text-muted">Not measured this session: {unmeasured.join(", ")}.</p>
            ) : null}
          </ChartSection>
        </>
      ) : metrics === null ? (
        <p className="rounded-md border border-border bg-surface p-3 text-sm text-muted">
          No session recorded yet. The charts fill in after a play-through.
        </p>
      ) : null}

      <IntonationHeatmap />

      {metrics && measures.length > 0 ? (
        <>
          <ChartSection
            eyebrow="By measure"
            title="Pitch drift"
            table={{
              columns: ["Measure", "Mean", "Worst", "In tolerance", "Unheard"],
              rows: measures.map((m) => [
                m.number,
                m.pitch.meanCents === null ? "—" : signed(m.pitch.meanCents, "¢"),
                m.pitch.maxAbsCents === null ? "—" : `${m.pitch.maxAbsCents}¢`,
                percent(m.pitch.accuracyPct),
                `${m.pitch.unheard}/${m.notes}`,
              ]),
            }}
          >
            <PitchDriftChart measures={measures} />
            <Legend
              items={[
                { color: INK.sharp, label: "Sharp" },
                { color: INK.flat, label: "Flat" },
                { color: INK.neutral, label: `Within ${IN_TUNE_CENTS}¢` },
              ]}
            />
          </ChartSection>

          <ChartSection
            eyebrow="By measure"
            title="Tempo"
            table={{
              columns: ["Measure", "Played", "vs target", "Onsets", "In tolerance"],
              rows: measures.map((m) => [
                m.number,
                m.timing.playedBpm === null ? "—" : `${m.timing.playedBpm} bpm`,
                m.timing.playedBpm === null ? "—" : signed(m.timing.playedBpm - metrics.tempo.target),
                m.timing.meanDeviationMs === null ? "—" : signed(m.timing.meanDeviationMs, " ms"),
                percent(m.timing.accuracyPct),
              ]),
            }}
          >
            <TempoChart metrics={metrics} />
            <Legend
              items={[
                { color: INK.flat, label: "Played", line: true },
                { color: INK.axis, label: `Target ${metrics.tempo.target} bpm`, line: true },
              ]}
            />
          </ChartSection>

          <ChartSection
            eyebrow="By measure"
            title="Articulation"
            table={{
              columns: ["Measure", "Accuracy", "Checked"],
              rows: measures.map((m) => [m.number, percent(m.articulation.accuracyPct), m.articulation.checked]),
            }}
          >
            <ArticulationChart measures={measures} />
            <Legend items={[{ color: INK.flat, label: "Marked notes matched" }, { color: INK.neutral, label: "No style marking" }]} />
          </ChartSection>

          <PanelSection eyebrow="Camera" title="Bow path">
            <BowPath metrics={metrics} />
          </PanelSection>
        </>
      ) : null}
    </div>
  );
}
