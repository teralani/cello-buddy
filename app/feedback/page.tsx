import Link from "next/link";
import AppHeader from "@/components/app-header";
import { buttonClass } from "@/components/button";
import ChatThread from "@/components/chat-thread";
import IntonationHeatmap from "@/components/intonation-heatmap";

export default function FeedbackPage() {
  return (
    <main className="flex h-dvh flex-col">
      <AppHeader
        status="Reviewing"
        actions={
          <>
            <Link href="/" className={buttonClass("ghost")}>
              Exit
            </Link>
            <Link href="/practice" className={buttonClass("secondary")}>
              Back to practice
            </Link>
          </>
        }
      />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(24rem,34rem)] lg:grid-rows-1">
        <section aria-label="Session review" className="min-h-0 min-w-0">
          <ChatThread />
        </section>
        <aside aria-label="Intonation heatmap" className="min-h-0 overflow-y-auto border-t border-border bg-background lg:border-l lg:border-t-0">
          <IntonationHeatmap />
        </aside>
      </div>
    </main>
  );
}
