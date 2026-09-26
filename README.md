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

## Feedback chatbot

1. The practice screen writes the session's metrics JSON to `sessionStorage` under the key in `lib/metrics.ts` (`METRICS_KEY`). The shape is the `PracticeMetrics` type in that file. Until the recorder exists, the Review feedback button writes a sample session if nothing has been recorded.
2. The feedback page at `/feedback` sends the metrics and the chat history to `app/api/feedback/route.ts`, which streams a reply from Claude as newline-delimited JSON.
3. On each turn the route embeds the question, finds the closest transcript chunks in `data/lesson-index.json`, and gives them to the model so it can recommend a timestamped YouTube link.

## Building the lesson index

The video list lives in `scripts/build-lesson-index.ts`. The script fetches each video's captions, splits them into chunks of about 45 seconds, embeds the chunks with Voyage AI, and writes `data/lesson-index.json`.

```bash
npm run build-index -- --dry-run   # fetch and chunk only, no key needed
npm run build-index                # embed and write the index
```

Commit the generated JSON so the deployed app can use it.
