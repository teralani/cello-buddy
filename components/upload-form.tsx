"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export const SCORE_NAME_KEY = "cello-buddy:score-name";

/* Accepts any file for now. The file is not read or sent anywhere.
   Only its name is kept so the practice screen can show what was loaded. */
export default function UploadForm() {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fileName) {
      setError("Pick a file before tuning in.");
      return;
    }
    try {
      window.sessionStorage.setItem(SCORE_NAME_KEY, fileName);
    } catch {
      /* Session storage may be unavailable. The practice page handles a missing name. */
    }
    router.push("/practice");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label
        htmlFor="score-file"
        className="block cursor-pointer border-4 border-dashed border-ink bg-screen-dim px-6 py-8 text-center hover:bg-butter hover:text-night [&:hover_span]:text-night"
      >
        <span className="block font-display text-3xl leading-none break-all">
          {fileName ?? "Drop in your sheet music"}
        </span>
        <span className="mt-2 block text-sm text-ink-soft">
          {fileName
            ? "Click to choose a different file"
            : "MusicXML or .mxl, or any file for now"}
        </span>
        <input
          id="score-file"
          name="score"
          type="file"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileName(file ? file.name : null);
            setError(null);
          }}
        />
      </label>

      {error ? (
        <p role="alert" className="bg-rose px-3 py-2 text-sm text-night">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="self-start bg-peach text-night border-4 border-ink px-6 py-2 font-display text-3xl leading-none uppercase tracking-wider hard-shadow-ink hover:bg-butter active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        Tune in
      </button>
    </form>
  );
}
