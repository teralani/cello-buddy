import type { Milestone, MilestoneGlyph } from "@/lib/milestones";

/* Notation-style marks drawn in the current text colour, so an earned chip
   reads in foreground ink and a locked one in muted ink. */
function Glyph({ kind }: { kind: MilestoneGlyph }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden className="shrink-0">
      {kind === "note" ? (
        <>
          <ellipse cx={9.5} cy={17} rx={4.2} ry={2.8} transform="rotate(-20 9.5 17)" fill="currentColor" />
          <path d="M13.3 16.2V4.5" {...stroke} />
        </>
      ) : null}
      {kind === "notes" ? (
        <>
          <ellipse cx={7} cy={18} rx={3.4} ry={2.3} transform="rotate(-20 7 18)" fill="currentColor" />
          <ellipse cx={16} cy={16} rx={3.4} ry={2.3} transform="rotate(-20 16 16)" fill="currentColor" />
          <path d="M10 17.5V6.5M19 15.5V4.5" {...stroke} />
          <path d="M10 6.5 19 4.5v3l-9 2z" fill="currentColor" />
        </>
      ) : null}
      {kind === "repeat" ? (
        <>
          <path d="M7 5v14" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
          <path d="M11 5v14" {...stroke} />
          <circle cx={16} cy={10} r={1.4} fill="currentColor" />
          <circle cx={16} cy={14} r={1.4} fill="currentColor" />
        </>
      ) : null}
      {kind === "fork" ? <path d="M8 4v6a4 4 0 0 0 8 0V4M12 14v6M9 20h6" {...stroke} /> : null}
      {kind === "fermata" ? (
        <>
          <path d="M4 16a8 8 0 0 1 16 0" {...stroke} />
          <circle cx={12} cy={16} r={1.6} fill="currentColor" />
        </>
      ) : null}
      {kind === "metronome" ? (
        <>
          <path d="M9 4h6l3 16H6z" {...stroke} />
          <path d="M12 18 17 7" {...stroke} />
          <circle cx={17} cy={7} r={1.4} fill="currentColor" />
        </>
      ) : null}
      {kind === "bow" ? (
        <>
          <path d="M3 17C8 9 15 6 21 5" {...stroke} />
          <path d="M5 20C10 12 16 9 21 8" {...stroke} strokeWidth={1} />
          <path d="M3 17l2 3" {...stroke} strokeWidth={2.4} />
        </>
      ) : null}
      {kind === "tally" ? <path d="M6 6v12M10 6v12M14 6v12M18 6v12M4 15 20 9" {...stroke} /> : null}
      {kind === "sheets" ? <path d="M6 4h9l3 3v13H6zM15 4v3h3M9 11h6M9 15h6" {...stroke} /> : null}
    </svg>
  );
}

/* Chips for every milestone: earned ones in full ink, locked ones dashed and
   muted with what is still needed, so the row always shows a next target. */
export default function Milestones({ items }: { items: Milestone[] }) {
  const earned = items.filter((m) => m.earned).length;
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((m, i) => (
          <li
            key={m.id}
            className={`chart-fade flex items-center gap-3 rounded-md border px-3 py-2.5 ${
              m.earned ? "border-border bg-surface text-foreground" : "border-dashed border-border-strong text-muted"
            }`}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <Glyph kind={m.glyph} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{m.title}</p>
              <p className="text-[11px] leading-snug text-muted">{m.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        {earned} of {items.length} earned. Every one is judged from a real session measurement.
      </p>
    </div>
  );
}
