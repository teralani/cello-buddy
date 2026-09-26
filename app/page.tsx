import UploadForm from "@/components/upload-form";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-xl px-6 pt-16 pb-20 sm:pt-28">
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Cello Buddy
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
          Load a score and your buddy will watch your bow, listen to your
          pitch, and follow along on the page. Afterwards you can talk through
          the session.
        </p>

        <div className="mt-10">
          <UploadForm />
        </div>

        <ol className="mt-16 grid gap-8 border-t border-border pt-8 sm:grid-cols-3">
          <Step number="1" title="Load" body="Upload a MusicXML score." />
          <Step
            number="2"
            title="Set up"
            body="Sit where the camera can see your bow arm."
          />
          <Step number="3" title="Play" body="The cursor follows you as you go." />
        </ol>
      </section>
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
    <li className="text-sm">
      <span className="text-muted tabular-nums">{number}</span>
      <span className="mt-1 block font-medium">{title}</span>
      <span className="mt-1 block leading-relaxed text-muted">{body}</span>
    </li>
  );
}
