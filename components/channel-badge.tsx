type ChannelBadgeProps = {
  number: string;
  name: string;
};

/* The channel readout that sits in a screen corner. */
export default function ChannelBadge({ number, name }: ChannelBadgeProps) {
  return (
    <div className="inline-flex items-baseline gap-2 bg-ink text-night px-2 py-1">
      <span className="font-display text-2xl leading-none">CH {number}</span>
      <span className="text-xs uppercase tracking-widest">{name}</span>
    </div>
  );
}
