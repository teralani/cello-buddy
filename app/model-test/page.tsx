import Link from "next/link";
import ModelTestBench from "@/components/model-test-bench";

export default function ModelTestPage() {
  return (
    <main className="min-h-dvh bg-room">
      <header className="flex items-center gap-4 border-b-4 border-ink bg-bezel px-4 py-3">
        <Link href="/" className="font-display text-3xl uppercase tracking-wider hover:text-butter">Cello Buddy</Link>
        <span className="text-xs uppercase tracking-widest text-ink-soft">Model test bench</span>
        <Link href="/practice" className="ml-auto border-2 border-butter px-3 py-1 font-display text-xl uppercase text-butter hover:bg-butter hover:text-night">Practice</Link>
      </header>
      <ModelTestBench />
    </main>
  );
}