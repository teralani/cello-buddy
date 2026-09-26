"use client"
import Link from "next/link";
import AppHeader from "@/components/app-header";
import { buttonClass } from "@/components/button";
import PlaceholderPanel from "@/components/placeholder-panel";
import ReviewButton from "./review-button";
import OpenSheetMusicDisplay from "@/components/open-sheet-music-display";
import dataURLtoFile from "@/helpers";
import { SCORE_MXL, SCORE_NAME_KEY } from "@/components/upload-form";

export default function PracticePage() {
  return (
    <main className="flex h-dvh flex-col">
      <AppHeader
        status="Practicing"
        actions={
          <>
            <Link href="/" className={buttonClass("secondary")}>
              Exit
            </Link>
            <ReviewButton />
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
        <section
          aria-label="Camera"
          className="min-h-0 overflow-hidden bg-[#141311] lg:border-r lg:border-border"
        >
          <PlaceholderPanel
            tone="dark"
            title="Camera"
            note="Your webcam preview will appear here, with posture and bow tracking drawn over it."
            status="Not connected"
          />
        </section>

        <section
          aria-label="Sheet music"
          className="min-h-0 overflow-hidden border-t border-border bg-surface lg:border-t-0"
        >
          <OpenSheetMusicDisplay
            file = {
                dataURLtoFile(getMXLFromLocalStorage(), getScoreNameFromLocalStorage())
            }
            status="Waiting for score"
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