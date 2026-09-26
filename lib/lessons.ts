import "server-only";
import { VoyageAIClient } from "voyageai";
import type { LessonSource } from "@/lib/chat";
import index from "@/data/lesson-index.json";

/* One chunk of a teaching video transcript, embedded offline by
   scripts/build-lesson-index.ts. */
export type LessonChunk = {
  videoId: string;
  title: string;
  url: string;
  start: number;
  text: string;
  embedding: number[];
};

export type { LessonSource } from "@/lib/chat";

type LessonIndex = {
  model: string;
  chunks: LessonChunk[];
};

/* YouTube captions arrive with HTML entities such as &#39; and &amp;. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const lessonIndex: LessonIndex = {
  model: (index as LessonIndex).model,
  chunks: (index as LessonIndex).chunks.map((chunk) => ({ ...chunk, text: decodeEntities(chunk.text) })),
};

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* Returns the closest transcript chunks to the query, or an empty list when
   there is no index or no Voyage key, so the chat still works without them. */
export async function findLessons(query: string, limit = 4): Promise<LessonSource[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey || lessonIndex.chunks.length === 0 || !query.trim()) return [];

  const client = new VoyageAIClient({ apiKey });
  const response = await client.embed({
    input: query,
    model: lessonIndex.model,
    inputType: "query",
  });
  const queryEmbedding = response.data?.[0]?.embedding;
  if (!queryEmbedding) return [];

  const scored = lessonIndex.chunks
    .map((chunk) => ({ chunk, score: cosine(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score);

  /* At most one chunk per video so the suggestions cover different lessons. */
  const seen = new Set<string>();
  const picked: LessonSource[] = [];
  for (const { chunk } of scored) {
    if (seen.has(chunk.videoId)) continue;
    seen.add(chunk.videoId);
    picked.push({ title: chunk.title, url: chunk.url, start: chunk.start, text: chunk.text });
    if (picked.length === limit) break;
  }
  return picked;
}
