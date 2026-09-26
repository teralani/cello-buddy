import Link from "next/link";
import AppHeader from "@/components/app-header";
import { buttonClass } from "@/components/button";
import PlaceholderPanel from "@/components/placeholder-panel";
import ReviewButton from "./review-button";

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
          <PlaceholderPanel
            title="Sheet music"
            note="The score renders here and a cursor will follow along as you play."
            status="Waiting for score"
          />
        </section>
      </div>
    </main>
  );
}
