import Link from "next/link";
import AppHeader from "@/components/app-header";
import { buttonClass } from "@/components/button";
import ChatThread from "@/components/chat-thread";
import ResizableSplit from "@/components/resizable-split";
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
      <ResizableSplit mainLabel="Session review" panelLabel="Session charts" main={<ChatThread />} panel={<SessionInsights />} />
    </main>
  );
}
