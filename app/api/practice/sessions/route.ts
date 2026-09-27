import { isPracticeMetrics } from "@/lib/metrics";
import {
  BackendUnavailable,
  backendErrorMessage,
  callBackend,
  isRecord,
  notSignedInResponse,
  sessionUser,
  unavailableResponse,
} from "@/lib/server/backend";

/* One stored practice session as the backend keeps it, percentages 0 to 100. */
export type ApiSession = {
  id: string;
  /* ISO timestamp, always with a timezone. */
  recordedAt: string;
  pitchAccuracyPct: number;
  /* Share of bow travel that was sideways, 0 to 1. */
  bowHorizontalShare: number;
  articulationAccuracyPct: number;
  finalScorePct: number;
};

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/* Timestamps come back without a zone when the column is `timestamp without
   time zone`; they were stored in UTC (see POST), so read them as UTC. */
function isoWithZone(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const time = new Date(withZone).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function toApiSession(row: unknown): ApiSession | null {
  if (!isRecord(row)) return null;
  const id = asNumber(row.practice_session_id);
  const recordedAt = isoWithZone(row.time_created);
  const pitch = asNumber(row.notes_correct);
  const bow = asNumber(row.correct_bow_pos);
  const articulation = asNumber(row.articulation);
  const score = asNumber(row.final_score);
  if (id === null || recordedAt === null || pitch === null || bow === null || articulation === null || score === null) return null;
  return {
    id: `session-${id}`,
    recordedAt,
    pitchAccuracyPct: pitch,
    bowHorizontalShare: bow / 100,
    articulationAccuracyPct: articulation,
    finalScorePct: score,
  };
}

/* The signed-in user's sessions, newest first. */
export async function GET(request: Request) {
  const user = await sessionUser();
  if (!user) return notSignedInResponse();
  try {
    const result = await callBackend(request, `/practice-session/user-ordered-scores/${user.id}`);
    if (!result.ok) {
      return Response.json(
        { error: backendErrorMessage(result.payload, "Could not load your sessions.") },
        { status: result.status },
      );
    }
    const rows = Array.isArray(result.payload) ? result.payload : [];
    const sessions = rows
      .map(toApiSession)
      .filter((row): row is ApiSession => row !== null)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    return Response.json({ sessions });
  } catch (error) {
    if (error instanceof BackendUnavailable) return unavailableResponse();
    throw error;
  }
}

/* Stores a finished play-through. The body is the PracticeMetrics record the
   practice screen produces; only the measurements the backend has columns
   for are kept, as fractions 0 to 1. The backend computes the final score. */
export async function POST(request: Request) {
  const user = await sessionUser();
  if (!user) return notSignedInResponse();

  let metrics: unknown;
  try {
    metrics = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!isPracticeMetrics(metrics)) {
    return Response.json({ error: "Request body is not a practice metrics record." }, { status: 400 });
  }

  const recordedAt = new Date(metrics.recordedAt);
  const body = {
    user_id: user.id,
    notes_correct: (metrics.summary.pitchAccuracyPct ?? 0) / 100,
    correct_bow_pos: metrics.summary.bow?.horizontalShare ?? 0,
    articulation: (metrics.summary.articulationAccuracyPct ?? 0) / 100,
    time_created: (Number.isFinite(recordedAt.getTime()) ? recordedAt : new Date()).toISOString(),
    final_score: 0,
  };
  try {
    const result = await callBackend(request, "/practice-session/create-practice-session/", { method: "POST", body });
    if (!result.ok) {
      return Response.json(
        { error: backendErrorMessage(result.payload, "Could not save the session.") },
        { status: result.status },
      );
    }
    const id = isRecord(result.payload) ? asNumber(result.payload.practice_session_id) : null;
    return Response.json({ ok: true, id: id === null ? null : `session-${id}` }, { status: 201 });
  } catch (error) {
    if (error instanceof BackendUnavailable) return unavailableResponse();
    throw error;
  }
}
