import type { ReactNode } from "react";

type TvFrameProps = {
  children: ReactNode;
  label?: string;
  className?: string;
  screenClassName?: string;
};

/* A television cabinet: wood-toned body, cream bezel, a curved screen,
   and a control strip with two dials and a speaker grille. */
export default function TvFrame({
  children,
  label,
  className = "",
  screenClassName = "",
}: TvFrameProps) {
  return (
    <div
      className={`bg-cabinet border-4 border-cabinet-edge rounded-2xl p-4 hard-shadow flex flex-col ${className}`}
    >
      <div className="bg-bezel border-4 border-cabinet-dark rounded-xl p-3 flex-1 flex flex-col">
        <div
          className={`screen-curve bg-screen border-4 border-screen-edge scanlines flex-1 overflow-hidden ${screenClassName}`}
        >
          {children}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <Dial />
        <Dial />
        <Grille />
        {label ? (
          <span className="ml-auto font-display text-2xl leading-none text-knob-mark tracking-wider uppercase">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Dial() {
  return (
    <span
      aria-hidden
      className="relative inline-block h-8 w-8 rounded-full bg-knob border-2 border-knob-mark"
    >
      <span className="absolute left-1/2 top-1 h-3 w-0.5 -translate-x-1/2 bg-knob-mark" />
    </span>
  );
}

function Grille() {
  return (
    <span aria-hidden className="flex flex-col gap-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className="block h-0.5 w-20 bg-cabinet-edge" />
      ))}
    </span>
  );
}
