import Anthropic from "@anthropic-ai/sdk";
import { FIRST_PROMPT, type ChatEvent, type LessonSource } from "@/lib/chat";
import { findLessons } from "@/lib/lessons";
import { isPracticeMetrics, type PracticeMetrics } from "@/lib/metrics";

export const runtime = "nodejs";

const MODEL = "claude-opus-5";
const MISSING_KEY_MESSAGE =
  "The server has no ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.";

const TEACHER_PROMPT = `You are Cello Buddy, a patient cello teacher reviewing a student's practice session.

You receive a JSON object of measurements from the session. Everything in it was measured: pitch and timing come from the microphone, bow motion from the camera tracking the student's right wrist. The summary covers the whole play-through and each entry in measures covers one measure.
- pitch: accuracyPct is the share of notes within the pitch tolerance; meanCents is signed, positive is sharp; unheard is how many notes produced no detectable pitch.
- timing: accuracyPct is the share of notes whose onset landed within the timing tolerance; meanDeviationMs is signed, negative is early or rushed; playedBpm is the tempo actually played in that measure, to compare with tempo.target and tempo.averagePlayed.
- articulation: accuracyPct is the share of explicitly marked notes played with the requested style; checked is how many marked notes were measured. A null accuracyPct means the score had no supported style markings, not that the student failed.
- bow: the right wrist's path. pathAngleDeg is the tilt of its line of travel, 0 is level bowing and anything above about 20 means the arm is moving up and down rather than across. horizontalShare is the fraction of travel that was sideways. reversals counts bow direction changes; compare it with bowedNotes, the number of notes that should each get a new bow. horizontalRangePct and verticalRangePct are the path's extent as a percentage of the camera frame's height; when both are near 0 the bow arm barely moved. bow is null when the camera did not see the wrist.
- completed is false when the student stopped before the end; measures then lists only what was played, out of measuresInPiece. Review what is there and do not treat the unplayed measures as a problem.
- null anywhere means that value could not be measured. Do not treat null as zero or as a problem.

How to respond:
- Be brief. The whole reply should fit on one screen without scrolling.
- For a session review, list the problems in priority order as a numbered list, at most three items. Each item is one short line naming the problem and the measure numbers, then a second line starting with "Try:" giving one concrete exercise. Round numbers; do not quote every metric.
- If a lesson clip below fits an item, put its exact URL alone on the line right after that item's "Try:" line. The app renders the URL as a link with the video title, so do not describe the video or say "watch this". Use each URL at most once. Never invent a URL or a timestamp.
- After the list, one closing sentence at most: what was solid, or the one thing to do first.
- For follow-up questions, answer directly in a few short sentences or a short numbered list. Same rules for links.
- Plain text only. No markdown headings, no bold, no bullets other than the numbered list, no emoji, and no dashes used as punctuation.
- Do not invent metrics. If the data does not show a problem, say so plainly.
- The clip list is searched fresh for every message, so it changes from turn to turn. Links you gave in earlier replies came from earlier lists and are still valid. Do not retract or apologize for them.`;

type RequestBody = {
  metrics: unknown;
  messages: unknown;
};

function isTextMessage(value: unknown): value is Anthropic.MessageParam {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (v.role === "user" || v.role === "assistant") && typeof v.content === "string";
}

/* On the first turn there is no user question yet, so search the lesson index
   with a summary of the worst metrics instead. */
function retrievalQuery(metrics: PracticeMetrics, messages: Anthropic.MessageParam[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser && typeof lastUser.content === "string") return lastUser.content;

  const parts: string[] = [];
  const s = metrics.summary;
  if ((s.meanAbsCents ?? 0) > 10 || (s.pitchAccuracyPct ?? 100) < 70)
    parts.push("cello intonation playing sharp or flat");
  if (s.bow && ((s.bow.pathAngleDeg ?? 0) > 20 || (s.bow.horizontalShare ?? 1) < 0.75))
    parts.push("keeping the bow straight and the right arm moving level across the strings");
  const tempoOff = metrics.tempo.averagePlayed !== null && Math.abs(metrics.tempo.averagePlayed - metrics.tempo.target) > 4;
  if (tempoOff || (s.meanAbsTimingMs ?? 0) > 25 || (s.timingAccuracyPct ?? 100) < 70)
    parts.push("rushing and keeping a steady tempo");
  return parts.join(", ") || "cello practice fundamentals";
}

function buildSystem(metrics: PracticeMetrics, lessons: LessonSource[]): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: TEACHER_PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: `Session metrics:\n${JSON.stringify(metrics, null, 2)}` },
  ];
  if (lessons.length > 0) {
    const clips = lessons
      .map((l) => `Title: ${l.title}\nURL: ${l.url}\nTranscript excerpt: ${l.text}`)
      .join("\n\n");
    blocks.push({ type: "text", text: `Lesson clips that may be relevant:\n\n${clips}` });
  }
  return blocks;
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return MISSING_KEY_MESSAGE;
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "The chatbot is rate limited right now. Wait a moment and try again.";
  }
  if (error instanceof Anthropic.APIError) {
    return `The chatbot request failed (${error.status}). ${error.message}`;
  }
  return "Something went wrong while talking to the chatbot.";
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!isPracticeMetrics(body.metrics)) {
    return Response.json({ error: "Missing or malformed metrics." }, { status: 400 });
  }
  const metrics = body.metrics;
  const history = Array.isArray(body.messages) ? body.messages.filter(isTextMessage) : [];
  const messages: Anthropic.MessageParam[] =
    history.length > 0 ? history : [{ role: "user", content: FIRST_PROMPT }];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          send({ type: "error", message: MISSING_KEY_MESSAGE });
          return;
        }
        let lessons: LessonSource[] = [];
        try {
          lessons = await findLessons(retrievalQuery(metrics, messages));
        } catch {
          /* Retrieval is optional. The reply still works without clips. */
        }
        send({ type: "sources", sources: lessons });

        const client = new Anthropic();
        const claude = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: buildSystem(metrics, lessons),
          messages,
        });

        for await (const event of claude) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "text", text: event.delta.text });
          }
        }

        const final = await claude.finalMessage();
        if (final.stop_reason === "refusal") {
          send({ type: "error", message: "The chatbot declined to answer that. Try rephrasing." });
        }
        send({ type: "done" });
      } catch (error) {
        send({ type: "error", message: describeError(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
