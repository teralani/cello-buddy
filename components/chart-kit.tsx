"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import PanelSection from "@/components/panel-section";

/* Shared chart primitives for the feedback panel and the home dashboard, so
   every chart in the app draws from the same ink and chrome.

   Marks use one diverging pair (blue flat, red sharp) that clears every
   contrast and colour-vision check against the white surface. `second` is the
   orange used when two series share a chart and neither is a pitch error, so
   red keeps meaning "sharp" everywhere. Chrome reuses the app's neutral tokens
   so the charts sit quietly in their panel. */
export const INK = {
  flat: "#2a78d6",
  sharp: "#e34948",
  second: "#c9812a",
  neutral: "#c9c5bd",
  track: "#cde2fb",
  band: "#efede8",
  grid: "#e4e1db",
  axis: "#c9c5bd",
  muted: "#6e6a63",
  surface: "#ffffff",
};

/* Fixed chart frame; the height already includes the x-axis band. */
export const FRAME = { height: 150, top: 10, bottom: 22, left: 36, right: 10 };

/* Tracks the rendered width of a container so SVG charts can lay out in
   pixels and keep their text at a fixed size. */
export function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0]?.contentRect.width ?? 0));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function signed(value: number, unit = "", digits = 0): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}${unit}`;
}

export function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* Every measure gets a label when they fit; otherwise every k-th one. */
export function labelEvery(count: number): number {
  return count <= 16 ? 1 : Math.ceil(count / 12);
}

/* A column with a 4px rounded data end and a square foot on the baseline,
   drawn upward or downward from `baseline` to `tip`. */
export function columnPath(x: number, baseline: number, tip: number, width: number): string {
  const r = Math.min(4, width / 2, Math.abs(tip - baseline));
  const dir = tip < baseline ? 1 : -1;
  const shoulder = tip + dir * r;
  return [
    `M${x},${baseline}`,
    `V${shoulder}`,
    `Q${x},${tip} ${x + r},${tip}`,
    `H${x + width - r}`,
    `Q${x + width},${tip} ${x + width},${shoulder}`,
    `V${baseline}`,
    "Z",
  ].join(" ");
}

/* An optional third entry keys the row to its series with a short stroke. */
export type TooltipRow = [label: string, value: string, color?: string];

export function Tooltip({ x, y = 4, width, title, rows, note }: { x: number; y?: number; width: number; title: string; rows: TooltipRow[]; note?: string }) {
  const flip = x > width * 0.62;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-max max-w-56 rounded-md border border-border bg-surface px-2.5 py-2 text-xs shadow-sm"
      style={{ top: y, ...(flip ? { right: width - x + 10 } : { left: x + 10 }) }}
    >
      <p className="font-medium">{title}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
        {rows.map(([label, value, color]) => (
          <Fragment key={label}>
            <dt className="flex items-center gap-1.5 text-muted">
              {color ? <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: color }} /> : null}
              {label}
            </dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </Fragment>
        ))}
      </dl>
      {note ? <p className="mt-1 text-muted">{note}</p> : null}
    </div>
  );
}

/* Cells stay on one line and the container scrolls sideways when the table
   is too wide; a column of long text can opt into wrapping instead. */
export type TableColumn = string | { label: string; wrap?: boolean };
export type Table = { columns: TableColumn[]; rows: (string | number)[][] };

function columnClass(column: TableColumn | undefined): string {
  return typeof column === "object" && column.wrap ? "min-w-40" : "whitespace-nowrap";
}

export function DataTable({ table }: { table: Table }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="bg-surface-muted text-left text-muted">
            {table.columns.map((column) => {
              const label = typeof column === "string" ? column : column.label;
              return (
                <th key={label} className={`px-2 py-1.5 font-medium ${columnClass(column)}`}>{label}</th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className={`px-2 py-1 ${columnClass(table.columns[j])}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* A section whose chart can be swapped for its table twin. */
export function ChartSection({ eyebrow, title, table, children }: { eyebrow: string; title: string; table: Table; children: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <PanelSection
      eyebrow={eyebrow}
      title={title}
      aside={
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          className="rounded-md border border-border px-2 py-1 text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-border-strong hover:text-foreground"
        >
          {showTable ? "Chart" : "Table"}
        </button>
      }
    >
      {showTable ? <DataTable table={table} /> : children}
    </PanelSection>
  );
}

export function Legend({ items }: { items: { color: string; label: string; line?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={item.line ? "h-0.5 w-4 rounded-full" : "h-2.5 w-2.5 rounded-sm"}
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* Change against a named earlier period, e.g. "+6 pts vs last week". */
export type StatDelta = { text: string; direction: "up" | "down" | "flat" };

export function StatTile({ label, value, detail, delta, children }: { label: string; value: string; detail?: string; delta?: StatDelta; children?: ReactNode }) {
  const glyph = delta?.direction === "up" ? "▲" : delta?.direction === "down" ? "▼" : "–";
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
      {detail ? <p className="text-[11px] text-muted">{detail}</p> : null}
      {delta ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
          <span aria-hidden className="text-[9px]">{glyph}</span>
          {delta.text}
        </p>
      ) : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
