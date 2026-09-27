"use client";

const strings = ["A", "D", "G", "C"];
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function heatStyle(cents: number | null) {
  if (cents === null) return undefined;
  const intensity = Math.min(Math.abs(cents), 40) / 40;
  const center = cents < -10 ? "#2595d1" : cents > 10 ? "#f12d24" : "#7bd334";
  const middle = cents < -10 ? "#7bd334" : cents > 10 ? "#ffb000" : "#c7ed39";
  return {
    backgroundImage: `radial-gradient(circle, ${center} 0%, ${middle} 24%, rgba(126, 211, 52, ${0.7 + intensity * 0.25}) 43%, transparent 76%)`,
    opacity: 0.72 + intensity * 0.28,
  };
}

export default function IntonationHeatmap() {
  return (
    <div className="flex h-full flex-col gap-4 bg-background p-4 sm:p-6">
      <div className="flex items-end justify-between border-b-2 border-border-strong pb-3">
        <div><p className="text-xs uppercase tracking-widest text-muted">Pitch map</p><h2 className="font-display text-4xl uppercase">Intonation</h2></div>
        <span className="text-xs uppercase text-muted">Live / cents</span>
      </div>
      <div className="overflow-hidden border border-border-strong bg-[#111216] p-3 shadow-inner">
        <div className="w-[133.333%] min-w-170">
          <div className="grid grid-cols-[3rem_repeat(12,minmax(2rem,1fr))] items-end text-center text-[10px] uppercase text-muted">
            <span />{notes.map((note) => <span key={note} className="pb-2">{note}</span>)}
          </div>
          <div className="relative h-64 overflow-hidden">
            <div className="absolute inset-y-3 left-8 right-0 [clip-path:polygon(0_34%,100%_0,100%_100%,0_66%)] bg-[linear-gradient(100deg,#211c20_0%,#3e3439_28%,#171519_100%)] shadow-[inset_0_0_18px_rgba(0,0,0,0.8)]" />
            <div className="absolute inset-y-3 left-8 right-0 [clip-path:polygon(0_34%,100%_0,100%_100%,0_66%)] bg-[repeating-linear-gradient(100deg,transparent_0,transparent_42px,rgba(255,255,255,0.05)_43px,transparent_45px)] opacity-60" />
            <div className="absolute inset-y-3 left-8 top-0 z-20 w-1 bg-[#c7b9a3] shadow-[0_0_4px_rgba(255,255,255,0.6)]" />
            <div className="absolute inset-y-8 left-8 right-0 z-10 grid grid-rows-4 [clip-path:polygon(0_22%,100%_0,100%_100%,0_78%)]">
              {strings.map((string, row) => (
                <div key={string} className="relative flex items-center">
                  <span className="absolute -left-8 w-7 text-right text-xs font-semibold text-white">{string}</span>
                {notes.map((note, column) => {
                  const cents = (row + column) % 5 === 0 ? (column % 3 - 1) * 8 : (column % 4 === 0 ? 24 : -18);
                  return <span key={note} className="relative h-full flex-1" title={`${string} ${note}: ${cents > 0 ? "+" : ""}${cents} cents`}><span className="absolute -inset-3 blur-[5px]" style={heatStyle(cents)} /></span>;
                })}
              </div>
            ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-8 right-0 z-30 grid grid-rows-4 py-8 [clip-path:polygon(0_22%,100%_0,100%_100%,0_78%)]">
              {strings.map((string) => <span key={string} className="border-y border-[#eee6d7]/70 shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />)}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto border-t-2 border-border-strong pt-3 text-xs uppercase">
        <div className="mb-2 h-2 w-full bg-[linear-gradient(90deg,#238bd1_0%,#56c8bf_35%,#6ccf68_50%,#f0c64c_68%,#d94f49_100%)]" />
        <div className="flex justify-between text-muted"><span>-40¢ flat</span><span>In tune</span><span>+40¢ sharp</span></div>
      </div>
    </div>
  );
}