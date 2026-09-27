import Link from "next/link";
import AppHeader from "@/components/app-header";
import { buttonClass } from "@/components/button";
import ChatThread from "@/components/chat-thread";
import SessionInsights from "@/components/session-insights";

export default function FeedbackPage() {
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
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
        <section aria-label="Session review" className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <ChatThread />
        </section>
        <aside aria-label="Session charts" className="min-h-0 max-h-[55dvh] overflow-y-auto overscroll-contain border-t border-border bg-background lg:max-h-none lg:border-l lg:border-t-0">
          <SessionInsights />
        </aside>
      </div>
    </main>
  );
}
