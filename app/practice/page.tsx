import Link from "next/link";
import AppHeader from "@/components/app-header";
import { buttonClass } from "@/components/button";
import PracticeWorkspace from "./workspace-client";
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
      <PracticeWorkspace />
    </main>
  );
}
