import Link from "next/link";
import AppHeader from "@/components/app-header";
import { buttonClass } from "@/components/button";
import ChatThread from "@/components/chat-thread";

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
      <ChatThread />
    </main>
  );
}
