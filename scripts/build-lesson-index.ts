/* Builds data/lesson-index.json: fetches transcripts for the cello lesson
   videos below, merges the cues into chunks of about 45 seconds, embeds each
   chunk with Voyage AI, and writes the result so the feedback chatbot can
   deep-link into a lesson at the right moment.

   Usage: VOYAGE_API_KEY=... npm run build-index
   Add --dry-run to fetch and chunk without embedding or writing. */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fetchTranscript } from "youtube-transcript-plus";
import { VoyageAIClient } from "voyageai";

const MODEL = "voyage-3.5";
const CHUNK_SECONDS = 45;
/* Voyage accounts without a payment method are limited to 3 requests and
   10K tokens per minute, so batches stay small and requests are spaced out. */
const EMBED_BATCH = 20;
const BATCH_PAUSE_MS = 21_000;
const MAX_RETRIES = 5;
const OUT_PATH = "data/lesson-index.json";

type Video = { id: string; title: string };

/* Swap or extend this list freely. Only videos with captions will be indexed. */
const VIDEOS: Video[] = [
  { id: "3xk2eXK_meE", title: "How to Hold the Cello and Bow: Posture and Setup" },
  { id: "M7c0G-fLqmo", title: "Cello Bow Arm Technique Explained (Jamie Fiste)" },
  { id: "crW3U0DGR6k", title: "Cello Basics 13: Bow Contact Points Explained (Ailbhe McDonagh)" },
  { id: "WaCQ99ntQrc", title: "Cello Basics 14: Your Bow Arm (Ailbhe McDonagh)" },
  { id: "pnNElzPGysQ", title: "How to Bow Straight on Cello" },
  { id: "5NWsbiP3VLs", title: "Essential Point of Bow Contact for Cello" },
  { id: "2nUXPIaKQKI", title: "How to Improve Intonation" },
  { id: "D-nHuEe_nWg", title: "3 Easy Ways to Improve Cello Intonation" },
  { id: "DC-Oww8hlzU", title: "How to Practice Intonation (Ilia Laporev)" },
  { id: "mdgry2HQPRk", title: "Cello Basics 08: Left Hand C-Shape and 1st Finger (Ailbhe McDonagh)" },
  { id: "1AYOboPxZEA", title: "Left Hand Position for Beginners" },
  { id: "efb6YwAKt-M", title: "Using a Metronome for Cello Practice" },
  { id: "__ORdRHjE6Y", title: "Practicing with a Metronome, Q and A Lesson" },
];

type Chunk = {
  videoId: string;
  title: string;
  url: string;
  start: number;
  text: string;
  embedding: number[];
};

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r]*)"?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedBatch(client: VoyageAIClient, texts: string[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await client.embed({ input: texts, model: MODEL, inputType: "document" });
      return response.data ?? [];
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status !== 429 || attempt >= MAX_RETRIES) throw error;
      const wait = BATCH_PAUSE_MS * (attempt + 1);
      console.warn(`rate limited, retrying in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
}

function chunkTranscript(video: Video, cues: { text: string; offset: number }[]) {
  const chunks: Omit<Chunk, "embedding">[] = [];
  let start = 0;
  let words: string[] = [];
  const flush = () => {
    const text = words.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      chunks.push({
        videoId: video.id,
        title: video.title,
        url: `https://www.youtube.com/watch?v=${video.id}&t=${Math.floor(start)}s`,
        start: Math.floor(start),
        text,
      });
    }
    words = [];
  };
  for (const cue of cues) {
    if (words.length === 0) start = cue.offset;
    words.push(cue.text);
    if (cue.offset - start >= CHUNK_SECONDS) flush();
  }
  flush();
  return chunks;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!dryRun && !apiKey) {
    console.error("VOYAGE_API_KEY is not set. Add it to .env.local or pass --dry-run.");
    process.exit(1);
  }
  if (VIDEOS.length === 0) {
    console.error("The VIDEOS list in scripts/build-lesson-index.ts is empty.");
    process.exit(1);
  }

  const pending: Omit<Chunk, "embedding">[] = [];
  for (const video of VIDEOS) {
    try {
      const cues = await fetchTranscript(video.id);
      const chunks = chunkTranscript(video, cues);
      pending.push(...chunks);
      console.log(`${video.id}  ${chunks.length} chunks  ${video.title}`);
    } catch (error) {
      console.warn(`${video.id}  skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (pending.length === 0) {
    console.error("No transcripts were fetched, nothing to index.");
    process.exit(1);
  }
  if (dryRun) {
    console.log(`Dry run: ${pending.length} chunks, nothing written.`);
    return;
  }

  const client = new VoyageAIClient({ apiKey });
  const chunks: Chunk[] = [];
  mkdirSync("data", { recursive: true });
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    if (i > 0) await sleep(BATCH_PAUSE_MS);
    const batch = pending.slice(i, i + EMBED_BATCH);
    const items = await embedBatch(client, batch.map((c) => c.text));
    batch.forEach((chunk, j) => {
      const embedding = items[j]?.embedding;
      if (embedding) chunks.push({ ...chunk, embedding });
    });
    /* Write after every batch so a failure keeps what was already embedded. */
    writeFileSync(OUT_PATH, JSON.stringify({ model: MODEL, chunks }));
    console.log(`embedded ${Math.min(i + EMBED_BATCH, pending.length)} / ${pending.length}`);
  }
  console.log(`Wrote ${chunks.length} chunks to ${OUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
