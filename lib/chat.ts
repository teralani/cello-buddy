/* Shared between the feedback route and the chat UI. */

export const FIRST_PROMPT =
  "Review my practice session and tell me what to work on first.";

export type LessonSource = {
  title: string;
  url: string;
  start: number;
  text: string;
};

export type ChatEvent =
  | { type: "sources"; sources: LessonSource[] }
  | { type: "text"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
