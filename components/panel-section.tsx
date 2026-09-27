import type { ReactNode } from "react";

type PanelSectionProps = {
  /* Small label above the title, e.g. "By measure". */
  eyebrow: string;
  title: string;
  /* Optional control or note on the right of the heading. */
  aside?: ReactNode;
  children: ReactNode;
};

/* One titled block in the review side panel. Every visualization on the
   feedback screen sits inside one so the panel reads as a single column. */
export default function PanelSection({ eyebrow, title, aside, children }: PanelSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 border-b border-border-strong pb-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted">{eyebrow}</p>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        {aside ? <div className="shrink-0 text-xs text-muted">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}
