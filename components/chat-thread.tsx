"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FIRST_PROMPT, type ChatEvent, type LessonSource } from "@/lib/chat";
import { buttonClass } from "@/components/button";
import type { PracticeMetrics } from "@/lib/metrics";
import { useSessionMetrics } from "@/lib/useSessionMetrics";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const URL_TEST = /^https?:\/\/[^\s]+$/;

/* Splits trailing punctuation off a URL the model wrote at the end of a sentence. */
function splitUrl(part: string): [string, string] {
  const match = part.match(/^(.*?)([.,;:!?)]*)$/);
  return match ? [match[1], match[2]] : [part, ""];
}

/* Pulls the video id and start time out of a YouTube watch or share URL. */
function parseYouTube(url: string): { id: string; start: number } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtube.com" || host === "m.youtube.com")
    id = parsed.searchParams.get("v");
  else if (host === "youtu.be") id = parsed.pathname.slice(1);
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  const t = parsed.searchParams.get("t") ?? "0";
  const start = Number.parseInt(t, 10);
  return { id, start: Number.isFinite(start) ? start : 0 };
}

/* An embedded YouTube player that starts at the clip's timestamp. */
function YouTubeEmbed({ url, source }: { url: string; source?: LessonSource }) {
  const video = parseYouTube(url);
  if (!video) return <InlineLink url={url} source={source} />;
  const start = source?.start ?? video.start;
  const title = source?.title ?? "YouTube video";
  return (
    <figure className="my-3">
      <figcaption className="mb-1.5 flex items-baseline gap-2 text-xs text-muted">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline decoration-border-strong underline-offset-2 hover:decoration-foreground"
        >
          {title}
        </a>
        <span>at {formatTime(start)}</span>
      </figcaption>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${video.id}?start=${start}`}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="aspect-video w-full rounded-md border border-border bg-black"
      />
    </figure>
  );
}

/* A URL inside a sentence, shown by clip title when the clip is known. */
function InlineLink({ url, source }: { url: string; source?: LessonSource }) {
  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-border-strong underline-offset-2 hover:decoration-foreground"
      >
        {source ? source.title : url}
      </a>
      {source ? (
        <span className="ml-1.5 text-muted">at {formatTime(source.start)}</span>
      ) : null}
    </>
  );
}

function TextLine({
  line,
  sources,
}: {
  line: string;
  sources: Map<string, LessonSource>;
}) {
  return (
    <>
      {line.split(URL_PATTERN).map((part, k) => {
        if (!URL_TEST.test(part)) return <span key={k}>{part}</span>;
        const [url, trailing] = splitUrl(part);
        return (
          <span key={k}>
            <InlineLink url={url} source={sources.get(url)} />
            {trailing}
          </span>
        );
      })}
    </>
  );
}

/* Plain text with paragraph breaks. A line that is only a YouTube URL becomes
   an embedded player. URLs inside sentences become links. */
function MessageText({
  text,
  sources,
}: {
  text: string;
  sources: Map<string, LessonSource>;
}) {
  type Block =
    { kind: "text"; lines: string[] } | { kind: "embed"; url: string };
  const out: Block[] = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    let current: string[] = [];
    const flush = () => {
      if (current.length > 0) out.push({ kind: "text", lines: current });
      current = [];
    };
    for (const line of paragraph.split("\n")) {
      const trimmed = line.trim();
      const [url] = URL_TEST.test(trimmed) ? splitUrl(trimmed) : [""];
      if (url && parseYouTube(url)) {
        flush();
        out.push({ kind: "embed", url });
      } else {
        current.push(line);
      }
    }
    flush();
  }

  return (
    <>
      {out.map((block, i) =>
        block.kind === "embed" ? (
          <YouTubeEmbed
            key={i}
            url={block.url}
            source={sources.get(block.url)}
          />
        ) : (
          <p key={i} className={i > 0 ? "mt-3" : undefined}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                <TextLine line={line} sources={sources} />
              </span>
            ))}
          </p>
        ),
      )}
    </>
  );
}

/* Three follow-up questions chosen from the session's weakest areas, in
   priority order, padded with general questions when the playing was clean. */
function suggestQuestions(metrics: PracticeMetrics): string[] {
  const s = metrics.summary;
  /* Each score reaches 1 at the point the metric starts to matter. */
  const missPct = (accuracyPct: number | null) =>
    accuracyPct === null ? 0 : (100 - accuracyPct) / 30;
  const tempoOff =
    metrics.tempo.averagePlayed === null
      ? 0
      : Math.abs(metrics.tempo.averagePlayed - metrics.tempo.target) / 4;
  const ranked: { score: number; question: string }[] = [
    {
      score: Math.max((s.meanAbsCents ?? 0) / 8, missPct(s.pitchAccuracyPct)),
      question: "How do I fix the notes that were sharp or flat?",
    },
    {
      score: s.bow
        ? Math.max(
            (s.bow.pathAngleDeg ?? 0) / 20,
            (1 - (s.bow.horizontalShare ?? 1)) / 0.25,
          )
        : 0,
      question: "How do I keep my bow arm moving straight across?",
    },
    {
      score: Math.max(
        tempoOff,
        (s.meanAbsTimingMs ?? 0) / 25,
        missPct(s.timingAccuracyPct),
      ),
      question: "How do I keep a steadier tempo?",
    },
  ];
  const picked = ranked
    .filter((r) => r.score >= 1)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.question);
  const general = [
    "What should I practice first tomorrow?",
    "Which measures were my best?",
    "Can you give me a five minute warm-up for this piece?",
  ];
  return [...picked, ...general.filter((q) => !picked.includes(q))].slice(0, 3);
}

export default function ChatThread() {
  const metrics = useSessionMetrics();
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /* Every clip the server has sent this session, keyed by URL, so links in
     earlier replies keep their titles after the clip list changes. */
  const [sources, setSources] = useState<Map<string, LessonSource>>(
    () => new Map(),
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  /* Sends the full history plus metrics, and streams the reply into a new
     assistant message. `history` excludes the placeholder first prompt. */
  async function ask(history: ChatMessage[], current: PracticeMetrics) {
    setStreaming(true);
    setError(null);
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metrics: current,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null);
        throw new Error(
          detail?.error ?? `Request failed (${response.status}).`,
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const apply = (event: ChatEvent) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.role !== "assistant") return prev;
          const rest = prev.slice(0, -1);
          if (event.type === "text")
            return [...rest, { ...last, content: last.content + event.text }];
          return prev;
        });
        if (event.type === "sources") {
          setSources((prev) => {
            const next = new Map(prev);
            for (const source of event.sources) next.set(source.url, source);
            return next;
          });
        }
        if (event.type === "error") setError(event.message);
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) apply(JSON.parse(line) as ChatEvent);
        }
      }
      if (buffer.trim()) apply(JSON.parse(buffer) as ChatEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The request failed.");
    } finally {
      setStreaming(false);
    }
  }

  /* Request the first review as soon as the stored metrics are available.
     The timer is cancelled if the effect is torn down before it fires, which
     happens under React strict mode in development, so the guard is reset in
     that case and the next run schedules it again. Once it has fired, the
     guard stays set so re-renders never send a second first review. */
  useEffect(() => {
    if (startedRef.current || !metrics) return;
    startedRef.current = true;
    let fired = false;
    const timer = window.setTimeout(() => {
      fired = true;
      void ask([], metrics);
    }, 0);
    return () => {
      if (!fired) {
        window.clearTimeout(timer);
        startedRef.current = false;
      }
    };
  }, [metrics]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function send(text: string) {
    if (!text || streaming || !metrics) return;
    setDraft("");
    /* Give the first exchange its real user turn so the history stays valid. */
    const history: ChatMessage[] =
      messages.length > 0 && messages[0].role === "assistant"
        ? [{ role: "user", content: FIRST_PROMPT }, ...messages]
        : messages;
    void ask([...history, { role: "user", content: text }], metrics);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft.trim());
  }

  /* Suggestions wait until the initial review has fully streamed in. */
  const reviewDone =
    !streaming &&
    messages.length > 0 &&
    messages[0].role === "assistant" &&
    messages[0].content.length > 0;
  const suggestions = metrics && reviewDone ? suggestQuestions(metrics) : [];

  if (metrics === undefined) {
    return <p className="p-6 text-sm text-muted">Loading session.</p>;
  }

  if (!metrics) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base font-medium">No session recorded</p>
        <p className="max-w-sm text-sm text-muted">
          Play through a piece on the practice screen, then press Review
          session.
        </p>
        <Link href="/practice" className={buttonClass("secondary", "mt-2")}>
          Back to practice
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          {messages.map((message, i) =>
            message.role === "user" ? (
              <div
                key={i}
                className="max-w-[85%] self-end rounded-lg bg-surface-muted px-4 py-2.5 text-sm leading-relaxed"
              >
                <MessageText text={message.content} sources={sources} />
              </div>
            ) : (
              <div
                key={i}
                className="w-full self-start text-sm leading-relaxed"
              >
                <p className="mb-1.5 text-xs font-medium text-muted">
                  Cello Buddy
                </p>
                {message.content ? (
                  <MessageText text={message.content} sources={sources} />
                ) : (
                  <p className="text-muted">Listening back to your session.</p>
                )}
              </div>
            ),
          )}

          {error ? (
            <p
              role="alert"
              className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          {metrics ? (
            <div className="text-xs">
              <button
                type="button"
                onClick={() => setShowData((v) => !v)}
                className="text-muted underline decoration-border-strong underline-offset-2 hover:text-foreground"
              >
                {showData ? "Hide session data" : "Show session data"}
              </button>
              {showData ? (
                <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-surface p-3 font-mono text-muted">
                  {JSON.stringify(metrics, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-4">
        {suggestions.length > 0 ? (
          <div className="pb-3">
            <ul className="mx-auto flex w-full max-w-2xl flex-wrap gap-2">
              {suggestions.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    disabled={streaming}
                    onClick={() => send(question)}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:border-border-strong hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-surface"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-2xl gap-2"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              streaming ? "Waiting for reply" : "Ask a follow-up question"
            }
            disabled={streaming}
            aria-label="Your question"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted focus:border-foreground focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !draft.trim()}
            className={buttonClass("primary")}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
