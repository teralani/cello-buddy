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

## Backend API

The sign-in and registration routes under `app/api/auth/` are served by the FastAPI app in `api/`, which stores users in PostgreSQL.

Set `SQL_DB_URL` in the repo-root `.env.local` to the PostgreSQL connection URL from TigerData. The API also accepts `DATABASE_URL`. PostgreSQL connections use psycopg 3 and require TLS by default; an explicit `sslmode` in the URL is preserved.

```text
SQL_DB_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

Install and run the API from the repo root:

```bash
python -m pip install -r api/requirements.txt
uvicorn api.main:app --reload
```

The database must already contain the `users`, `practice_session`, and `connection` tables expected by the API models.

### How the frontend reaches the API

The Next.js auth routes call the backend through the app's own origin at `/api/py/...`, so no extra configuration is needed in either environment:

- In `next dev`, `/api/py/*` is proxied to the local uvicorn at `http://127.0.0.1:8000`.
- On Vercel, `api/main.py` is deployed as a Python serverless function at `/api/main`, and `/api/py/*` is rewritten to it. The FastAPI app strips the `/api/py` prefix itself, so the same routes work in both places. `SQL_DB_URL` (or `DATABASE_URL`) must be set in the Vercel project's environment variables.

### What the app reads and writes

- `POST /api/auth/login`, `register`, `logout` (`app/api/auth/`): sign-in against `/auth/token` and `/auth/`; the token is kept in an httpOnly cookie.
- `GET /api/me`: the signed-in user's id and email from the token, plus their name from `/user/get-user/{id}/`.
- `GET /api/practice/sessions`: the user's sessions from `/practice-session/user-ordered-scores/{id}`, newest first. `POST` stores a finished play-through through `/practice-session/create-practice-session/`; the practice screen calls it when a session ends.
- `GET /api/practice/leaderboard`: every player's best score from `/practice-session/all-user-high-scores`, top five, with names looked up.

The backend stores four numbers per session (pitch accuracy, bow share, articulation accuracy, and the score built from them) plus the time. The dashboard figures it does not store (piece, length, measures, tempo, notes graded, cents, timing accuracy) are fixed placeholder values on live rows; see `PLACEHOLDERS` in `lib/practiceHistory.ts`. When the backend cannot be reached at all, the dashboard falls back to sample sessions and says so.

To use a backend hosted somewhere else instead, set `API_BASE_URL` to its origin (for example `API_BASE_URL=https://api.example.com`) and the auth routes will call it directly.

## Practice session

The practice screen renders the score with OpenSheetMusicDisplay and grades a play-through against it.

1. `lib/scoreTimeline.ts` walks the loaded score and produces one entry per sounding note: start and length in beats, pitch (MIDI), the dynamic marking in force, whether the note starts or sits under a slur, and staccato. Tied notes are merged into one.
2. Press **Play**. The tempo box sets the beat; the score's own metronome marking is used the first time if it has one. One measure of clicks counts in, one per beat of the time signature, with the beat number shown over the score on each click. Then the microphone starts on the downbeat. The **Metronome** button keeps the click going through the piece, and **Timing ±** sets how far from the beat a note may start and still count.
3. `lib/practiceEngine.ts` reads the mic on the AudioContext clock, detects pitch with a normalized autocorrelation (McLeod, tuned for bowed strings: a low clarity floor and a preference for the stronger peak an octave down when the second harmonic dominates) and finds onsets two ways: a bow attack (level rises sharply after a dip or silence) and a plain pitch change (the left hand moving under a slur). Each note is graded once its window has passed:
   - **Pitch**: median pitch over the sustained part of the note, within the cents tolerance. By default only the note name is graded, so a detection octave slip on the low strings is not a wrong note.
   - **Rhythm**: nearest onset to the written start, within the timing tolerance.
   - **Dynamics**: the note's loud part mapped onto ppp..fff around a calibrated mf level, within the level tolerance.
   - **Slurs**: a note under a slur should show a pitch change without a bow attack; the first note of a slur should show an attack.
4. A bar slides along the rendered score in time with the tempo (`components/score-overlay.tsx`, geometry in `lib/scoreGeometry.ts`), and each note on the score is painted as soon as it is graded: green for right, red for a pitch miss, amber for a rhythm, dynamic, or slur miss. The note strip above the score shows the same colors like a typing test. Hover a strip note for the details.
5. **Tuning** opens the tolerances: rhythm wiggle room, pitch cents, pitch clarity floor, octave tolerance, dynamic levels, decibels per level, the mf reference level, bow attack sensitivity, silence floor, mic latency, count-in length, and whether the click keeps going. Settings are kept in `localStorage`.
6. The model test bench at `/model-test` has a live pitch readout (`components/pitch-monitor.tsx`) using the same detector, with a clarity slider, so you can check what the grader hears from your instrument before practicing.

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
