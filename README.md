# Cello Buddy

A practice companion for cellists. Upload a MusicXML score, play it with your webcam on, then review the session with a chatbot that gives actionable feedback and links into teaching videos at the right moment.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `.env.local` in the repo root. It is gitignored.

```
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
```

- `ANTHROPIC_API_KEY` powers the feedback chatbot. Without it the chat page shows an error instead of a review.
- `VOYAGE_API_KEY` is used for embeddings. It is needed to build the lesson index and, at runtime, to embed each question for retrieval. Without it the chatbot still works but does not suggest video clips.

## Practice session

The practice screen renders the score with OpenSheetMusicDisplay and grades a play-through against it.

1. `lib/scoreTimeline.ts` walks the loaded score and produces one entry per sounding note: start and length in beats, pitch (MIDI), the dynamic marking in force, whether the note starts or sits under a slur, and staccato. Tied notes are merged into one.
2. Press **Play**. The tempo box sets the beat; the score's own metronome marking is used the first time if it has one. A measure of clicks counts in (the count shows over the score), then the microphone starts.
3. `lib/practiceEngine.ts` reads the mic on the AudioContext clock, detects pitch with a normalized autocorrelation (McLeod) and finds onsets two ways: a bow attack (level rises sharply after a dip or silence) and a plain pitch change (the left hand moving under a slur). Each note is graded once its window has passed:
   - **Pitch**: median pitch over the sustained part of the note, within the cents tolerance.
   - **Rhythm**: nearest onset to the written start, within the timing tolerance.
   - **Dynamics**: the note's loud part mapped onto ppp..fff around a calibrated mf level, within the level tolerance.
   - **Slurs**: a note under a slur should show a pitch change without a bow attack; the first note of a slur should show an attack.
4. A bar slides along the rendered score in time with the tempo (`components/score-overlay.tsx`, geometry in `lib/scoreGeometry.ts`), and each note on the score is painted as soon as it is graded: green for right, red for a pitch miss, amber for a rhythm, dynamic, or slur miss. The note strip above the score shows the same colors like a typing test. Hover a strip note for the details.
5. **Tuning** opens the tolerances: rhythm wiggle room, pitch cents, dynamic levels, decibels per level, the mf reference level, bow attack sensitivity, silence floor, mic latency, count-in length, and whether the click keeps going. Settings are kept in `localStorage`.

## Feedback chatbot

1. The practice screen writes the session's metrics JSON to `sessionStorage` under the key in `lib/metrics.ts` (`METRICS_KEY`). The shape is the `PracticeMetrics` type in that file. A finished play-through writes real pitch and timing numbers per measure; the Review feedback button writes a sample session if nothing has been recorded yet.
2. The feedback page at `/feedback` sends the metrics and the chat history to `app/api/feedback/route.ts`, which streams a reply from Claude as newline-delimited JSON.
3. On each turn the route embeds the question, finds the closest transcript chunks in `data/lesson-index.json`, and gives them to the model so it can recommend a timestamped YouTube link.

## Building the lesson index

The video list lives in `scripts/build-lesson-index.ts`. The script fetches each video's captions, splits them into chunks of about 45 seconds, embeds the chunks with Voyage AI, and writes `data/lesson-index.json`.

```bash
npm run build-index -- --dry-run   # fetch and chunk only, no key needed
npm run build-index                # embed and write the index
```

Commit the generated JSON so the deployed app can use it.
