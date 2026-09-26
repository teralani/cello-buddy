import ChannelBadge from "@/components/channel-badge";
import TvFrame from "@/components/tv-frame";
import UploadForm from "@/components/upload-form";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <TvFrame label="Model CB-1" className="w-full max-w-3xl">
        <div className="flex h-full flex-col gap-8 p-6 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <ChannelBadge number="01" name="Welcome" />
            <span className="text-xs uppercase tracking-widest text-ink-soft">
              Now broadcasting
            </span>
          </div>

          <header className="flex flex-col gap-2">
            <h1 className="font-display text-7xl leading-none uppercase sm:text-8xl">
              Cello Buddy
            </h1>
            <p className="max-w-md text-base leading-relaxed">
              Good evening, and welcome to tonight&apos;s program. Load a score
              and your buddy will watch your bow, listen to your pitch, and
              follow along on the page.
            </p>
          </header>

          <UploadForm />

          <ol className="mt-auto grid gap-2 border-t-4 border-screen-edge pt-4 text-sm sm:grid-cols-3">
            <Step number="1" title="Load" body="Upload a MusicXML score." />
            <Step
              number="2"
              title="Set up"
              body="Sit where the camera can see your bow arm."
            />
            <Step number="3" title="Play" body="The cursor follows you as you go." />
          </ol>
        </div>
      </TvFrame>
    </main>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="font-display text-3xl leading-none">{number}.</span>
      <span>
        <span className="block font-semibold uppercase tracking-wider">{title}</span>
        <span className="block text-ink-soft">{body}</span>
      </span>
    </li>
  );
}
