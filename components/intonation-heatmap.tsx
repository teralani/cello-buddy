"use client";

const strings = ["A", "D", "G", "C"];
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function cellColor(cents: number | null) {
  if (cents === null) return "bg-screen";
  if (Math.abs(cents) < 12) return "bg-emerald-500/80";
  return cents < 0 ? "bg-sky/80" : "bg-rose/80";
}

export default function IntonationHeatmap() {
  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-end justify-between border-b-2 border-screen-edge pb-3">
        <div><p className="text-xs uppercase tracking-widest text-ink-soft">Pitch map</p><h2 className="font-display text-4xl uppercase">Intonation</h2></div>
        <span className="text-xs uppercase text-ink-soft">Live / cents</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[3rem_repeat(12,minmax(2rem,1fr))] gap-1 text-center text-[10px] uppercase text-ink-soft"><span />{notes.map((note) => <span key={note}>{note}</span>)}</div>
          {strings.map((string, row) => <div key={string} className="mt-1 grid grid-cols-[3rem_repeat(12,minmax(2rem,1fr))] gap-1"><span className="self-center text-xs font-semibold">{string}</span>{notes.map((note, column) => <span key={note} className={`aspect-square border border-screen-edge ${cellColor((row + column) % 5 === 0 ? (column % 3 - 1) * 8 : null)}`} title={`${string} ${note}`} />)}</div>)}
        </div>
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 border-t-2 border-screen-edge pt-3 text-xs uppercase"><span><i className="mr-2 inline-block h-2 w-2 bg-sky" />Flat</span><span><i className="mr-2 inline-block h-2 w-2 bg-emerald-500" />In tune</span><span><i className="mr-2 inline-block h-2 w-2 bg-rose" />Sharp</span></div>
    </div>
  );
}