"use client";

import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const WIDTH_KEY = "cello-buddy:feedback-panel-width";
const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 480;
/* The main pane keeps at least this much room, whatever the panel asks for. */
const MIN_MAIN_WIDTH = 360;

/* The panel width lives in localStorage so it survives reloads. Components
   subscribe to it through useSyncExternalStore, which also keeps the server
   render on the default width until the client has read the stored one. */
const listeners = new Set<() => void>();
let liveWidth: number | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readWidth() {
  if (liveWidth !== null) return liveWidth;
  try {
    const stored = Number(window.localStorage.getItem(WIDTH_KEY));
    liveWidth = Number.isFinite(stored) && stored >= MIN_WIDTH ? stored : DEFAULT_WIDTH;
  } catch {
    liveWidth = DEFAULT_WIDTH;
  }
  return liveWidth;
}

function writeWidth(next: number) {
  liveWidth = next;
  try {
    window.localStorage.setItem(WIDTH_KEY, String(Math.round(next)));
  } catch {
    /* Storage unavailable: the width still applies for this visit. */
  }
  listeners.forEach((listener) => listener());
}

type Props = {
  main: ReactNode;
  panel: ReactNode;
  mainLabel: string;
  panelLabel: string;
};

/* Two panes side by side on wide screens with a draggable divider that sets
   the right pane's width, or stacked (main above panel) on narrow screens.
   The chosen width is kept per browser. */
export default function ResizableSplit({ main, panel, mainLabel, panelLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useSyncExternalStore(subscribe, readWidth, () => DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback((next: number) => {
    const total = containerRef.current?.getBoundingClientRect().width ?? Infinity;
    return Math.max(MIN_WIDTH, Math.min(total - MIN_MAIN_WIDTH, next));
  }, []);

  const commit = useCallback((next: number) => writeWidth(next), []);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setDragging(true);
    const move = (moveEvent: PointerEvent) => {
      const right = containerRef.current?.getBoundingClientRect().right ?? 0;
      commit(clamp(right - moveEvent.clientX));
    };
    const stop = (stopEvent: PointerEvent) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      setDragging(false);
      const right = containerRef.current?.getBoundingClientRect().right ?? 0;
      commit(clamp(right - stopEvent.clientX));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 80 : 24;
    if (event.key === "ArrowLeft") commit(clamp(width + step));
    else if (event.key === "ArrowRight") commit(clamp(width - step));
    else if (event.key === "Home") commit(clamp(Infinity));
    else if (event.key === "End") commit(MIN_WIDTH);
    else return;
    event.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_var(--panel-width)] lg:grid-rows-1 ${dragging ? "select-none" : ""}`}
      style={{ ["--panel-width" as string]: `${width}px` }}
    >
      <section aria-label={mainLabel} className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        {main}
      </section>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize charts panel"
        aria-valuemin={MIN_WIDTH}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={onKeyDown}
        className={`group relative hidden w-2 shrink-0 cursor-col-resize touch-none items-stretch justify-center bg-background outline-none lg:flex ${dragging ? "bg-surface-muted" : "hover:bg-surface-muted focus-visible:bg-surface-muted"}`}
      >
        <span className={`w-px ${dragging ? "bg-border-strong" : "bg-border group-hover:bg-border-strong group-focus-visible:bg-border-strong"}`} />
      </div>
      <aside
        aria-label={panelLabel}
        className="min-h-0 max-h-[55dvh] overflow-y-auto overscroll-contain border-t border-border bg-background lg:max-h-none lg:border-t-0"
      >
        {panel}
      </aside>
    </div>
  );
}
