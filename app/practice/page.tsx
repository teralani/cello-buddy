"use client"
import Link from "next/link";
import PlaceholderPanel from "@/components/placeholder-panel";
import ScoreTitle from "./score-title";
import OpenSheetMusicDisplay from "@/components/open-sheet-music-display";
import dataURLtoFile from "@/helpers";
import { SCORE_MXL, SCORE_NAME_KEY } from "@/components/upload-form";

export default function PracticePage() {
  return (
    <main className="flex h-dvh flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b-4 border-ink bg-bezel px-3 py-1">
        <Link
          href="/"
          className="font-display text-2xl leading-none uppercase tracking-wider hover:bg-butter hover:text-night"
        >
          Cello Buddy
        </Link>
        <p className="flex min-w-0 items-center gap-2 text-xs">
          <span className="uppercase tracking-widest text-ink-soft">Now playing</span>
          <ScoreTitle />
        </p>
        <Link
          href="/"
          className="ml-auto border-2 border-rose bg-rose px-3 font-display text-xl leading-none uppercase tracking-wider text-night hover:border-butter hover:bg-butter hover:text-night"
        >
          Eject
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
        <section
          aria-label="Camera"
          className="min-h-0 overflow-hidden border-b-4 border-ink bg-screen scanlines lg:border-b-0 lg:border-r-4"
        >
          <PlaceholderPanel
            title="Camera feed"
            note="Your webcam preview will appear here, with posture and bow tracking drawn over it."
          />
        </section>

        <section aria-label="Sheet music" className="min-h-0 overflow-hidden bg-bezel">
          <OpenSheetMusicDisplay
            file = {
                dataURLtoFile(getMXLFromLocalStorage(), getScoreNameFromLocalStorage())
            }
          />
        </section>
      </div>
    </main>
  );
}

function getMXLFromLocalStorage(): string {
  const dataURL = window.localStorage.getItem(SCORE_MXL);
  if (!dataURL) {throw new Error("MXL file not found");}
  return dataURL;
  
}

function getScoreNameFromLocalStorage(): string {
  const filename = window.localStorage.getItem(SCORE_NAME_KEY);
  if (!filename) {throw new Error("MXL filename not found")};
  return filename;
}