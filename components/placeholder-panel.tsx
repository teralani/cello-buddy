type PlaceholderPanelProps = {
  title: string;
  note: string;
};

/* Holds the space where the live camera feed and the sheet music renderer
   will go. Both are being built separately. */
export default function PlaceholderPanel({ title, note }: PlaceholderPanelProps) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display text-4xl leading-none uppercase">{title}</p>
      <p className="max-w-xs text-sm text-ink-soft">{note}</p>
      <p className="mt-4 bg-ink px-3 py-1 font-display text-2xl leading-none text-night">
        NO SIGNAL
      </p>
    </div>
  );
}
