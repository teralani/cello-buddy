export type ButtonVariant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-md px-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-foreground text-background hover:bg-foreground/85 disabled:hover:bg-foreground",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-muted disabled:hover:bg-surface",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
};

/* Class names shared by <button> and <Link> so both look the same. */
export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`.trim();
}
