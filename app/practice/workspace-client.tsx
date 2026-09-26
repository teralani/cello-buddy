"use client";

import dynamic from "next/dynamic";

/* OpenSheetMusicDisplay and the Web Audio engine only exist in the browser,
   so the workspace is loaded on the client and skipped during server rendering. */
const PracticeWorkspace = dynamic(() => import("@/components/practice-workspace"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted">Loading practice room…</p>,
});

export default PracticeWorkspace;
