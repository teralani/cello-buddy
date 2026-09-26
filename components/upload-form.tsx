"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonClass } from "@/components/button";

export const SCORE_NAME_KEY = "cello-buddy:score-name";
export const SCORE_MXL = "cello-buddy:score-file-mxl"

/* Accepts any file for now. The file is not read or sent anywhere.
   Only its name is kept so the practice screen can show what was loaded. */
export default function UploadForm() {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [mxlFile, setMxlFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fileName || !mxlFile) {
      setError("Pick a file before tuning in.");
      return;
    }
    try {
      window.localStorage.setItem(SCORE_NAME_KEY, fileName);
      const reader = new FileReader();
      reader.readAsDataURL(mxlFile);
      reader.onloadend = () => {
        console.log(reader.result);
        window.localStorage.setItem(SCORE_MXL, String(reader.result));
      };
    } catch {
      /* Session storage may be unavailable. The practice page handles a missing name. */
    }
    router.push("/practice");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label
        htmlFor="score-file"
        className={`block cursor-pointer rounded-lg border border-dashed bg-surface px-6 py-10 text-center transition-colors hover:border-foreground has-[:focus-visible]:border-foreground ${
          error ? "border-danger" : "border-border-strong"
        }`}
      >
        <span className="block text-sm font-medium break-all">
          {fileName ?? "Choose a score"}
        </span>
        <span className="mt-1 block text-sm text-muted">
          {fileName ? "Click to choose a different file" : "MusicXML or .mxl"}
        </span>
        <input
          id="score-file"
          name="score"
          type="file"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileName(file ? file.name : null);
            setMxlFile(file ? file : null);
            setError(null);
          }}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button type="submit" className={buttonClass("primary", "self-start")}>
        Start practicing
      </button>
    </form>
  );
}
