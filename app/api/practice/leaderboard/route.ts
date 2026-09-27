import {
  BackendUnavailable,
  callBackend,
  isRecord,
  notSignedInResponse,
  sessionUser,
  unavailableResponse,
} from "@/lib/server/backend";

export type LeaderboardEntry = {
  userId: number;
  /* The player's name, or a numbered stand-in when the record has none. */
  name: string;
  /* Best final score, 0 to 100. */
  scorePct: number;
  you: boolean;
};

const TOP = 5;

/* Every player's best final score, highest first, with names looked up for
   the top few. A name lookup that fails leaves a numbered stand-in rather
   than dropping the row. */
export async function GET(request: Request) {
  const user = await sessionUser();
  if (!user) return notSignedInResponse();
  try {
    const result = await callBackend(request, "/practice-session/all-user-high-scores");
    if (!result.ok || !Array.isArray(result.payload)) return Response.json({ entries: [] });

    const rows = result.payload
      .map((row) => {
        if (!isRecord(row)) return null;
        const userId = Number(row.user_id);
        const score = Number(row.high_score);
        return Number.isInteger(userId) && Number.isFinite(score) ? { userId, score } : null;
      })
      .filter((row): row is { userId: number; score: number } => row !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP);

    const names = await Promise.all(
      rows.map(async ({ userId }) => {
        if (userId === user.id) return null;
        try {
          const lookup = await callBackend(request, `/user/get-user/${userId}/`, { token: user.token });
          return lookup.ok && isRecord(lookup.payload) && typeof lookup.payload.name === "string" ? lookup.payload.name.trim() : "";
        } catch {
          return "";
        }
      }),
    );

    const entries: LeaderboardEntry[] = rows.map((row, i) => ({
      userId: row.userId,
      name: row.userId === user.id ? "You" : names[i] || `Player ${row.userId}`,
      scorePct: row.score,
      you: row.userId === user.id,
    }));
    return Response.json({ entries });
  } catch (error) {
    if (error instanceof BackendUnavailable) return unavailableResponse();
    throw error;
  }
}
