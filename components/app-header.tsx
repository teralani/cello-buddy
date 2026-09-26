import Link from "next/link";
import type { ReactNode } from "react";
import ScoreTitle from "@/components/score-title";

type AppHeaderProps = {
  /* Short label shown before the score name, e.g. "Practicing". */
  status: string;
  actions?: ReactNode;
};

/* The thin bar at the top of the practice and feedback screens. */
export default function AppHeader({ status, actions }: AppHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight hover:text-muted"
      >
        Cello Buddy
      </Link>
      <span aria-hidden className="h-4 w-px bg-border" />
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <span className="shrink-0">{status}</span>
        <ScoreTitle className="text-foreground" />
      </p>
      {actions ? (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
