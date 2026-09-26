"use client";

import { useEffect, useRef } from "react";
import { OpenSheetMusicDisplay as OSMD } from "opensheetmusicdisplay";

type Props = {
  file: File | Blob | string | null;
  /* Called once the score is loaded and drawn, with the live OSMD instance. */
  onReady?: (osmd: OSMD) => void;
  onError?: (message: string) => void;
  drawTitle?: boolean;
};

/* Renders a MusicXML file with OpenSheetMusicDisplay. The instance is handed
   back through onReady so the practice engine can walk its notes and the
   overlay can draw on them. */
export default function OpenSheetMusicDisplay({ file, onReady, onError, drawTitle = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OSMD | null>(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !file) return;
    let cancelled = false;
    const osmd = new OSMD(container, { autoResize: true, drawTitle });
    osmdRef.current = osmd;
    osmd
      .load(file)
      .then(() => {
        if (cancelled) return;
        osmd.render();
        onReadyRef.current?.(osmd);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onErrorRef.current?.(error instanceof Error ? error.message : "Could not read the score.");
      });
    return () => {
      cancelled = true;
      try {
        osmd.clear();
      } catch {
        /* The container may already be gone. */
      }
      container.replaceChildren();
      osmdRef.current = null;
    };
  }, [file, drawTitle]);

  return <div ref={containerRef} className="h-full w-full" />;
}
