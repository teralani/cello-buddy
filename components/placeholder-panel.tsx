type PlaceholderPanelProps = {
  title: string;
  note: string;
  status: string;
  tone?: "light" | "dark";
};

/* Holds the space where the live camera feed and the sheet music renderer
   will go. Both are being built separately. */
export default function PlaceholderPanel({
  title,
  note,
  status,
  tone = "light",
}: PlaceholderPanelProps) {
  const dark = tone === "dark";
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 p-6 text-center">
      <p className={`text-sm font-medium ${dark ? "text-white" : ""}`}>
        {title}
      </p>
      <p className={`max-w-xs text-sm ${dark ? "text-white/60" : "text-muted"}`}>
        {note}
      </p>
      <p
        className={`mt-3 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${
          dark ? "border-white/15 text-white/70" : "border-border text-muted"
        }`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-white/40" : "bg-border-strong"}`}
        />
        {status}
      </p>
    </div>
  );
}
