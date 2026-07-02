# StudyQuest

StudyQuest is a static study planner PWA with tasks, notes, focus sessions, timetable planning, OCR, spaced-repetition flashcards, exam mode, progress analytics, an RPG skill tree, Video Quest checkpoints, cloud sync, and an optional server-side AI endpoint.

## Run Locally

```bash
npm install
npm start
```

Open `http://127.0.0.1:4173/index.html`.

## Real AI Backend

The browser app calls `settings.aiEndpoint`, which defaults to `/api/ai`. The included `local-server.cjs` endpoint uses the OpenAI Responses API when an environment variable is available:

```bash
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-4o-mini
npm start
```

Keep the key on a server only. GitHub Pages is public static hosting, so it should point to a deployed backend URL in StudyQuest Settings.

## Free-Tier FastAPI Quest Backend

StudyQuest also includes `studyquest_api.py`, a single FastAPI monolith for the gamified Video Quest and account-sync system. It uses MongoDB Atlas Free Tier with native `$vectorSearch`, an in-memory sprint clock dictionary, standard-library password hashing, signed bearer tokens, and FastAPI `BackgroundTasks` instead of Redis, Celery, or a separate vector database.

```bash
python -m pip install -r requirements.txt
MONGODB_URI=your_mongodb_atlas_uri
MONGODB_DB_NAME=studyquest
GEMINI_API_KEY=your_free_tier_gemini_key
STUDYQUEST_ADMIN_KEY=change_me
STUDYQUEST_JWT_SECRET=change_me_too
python -m uvicorn studyquest_api:app --host 0.0.0.0 --port 8000
```

Use `video-quest.html` to load lessons from `/api/v1/video-lessons/{lesson_id}`, run 30-minute dungeon sprints, and submit milestone solutions to `/api/v1/quests/evaluate`.

## Cloud Sync

StudyQuest supports three sync options from Settings:

- StudyQuest API + MongoDB Atlas: set the FastAPI URL in Settings, then sign up, log in, push, and pull encrypted-password account backups through `/api/v1/auth/*` and `/api/v1/sync/*`.
- Firebase Auth + Firestore: paste the Firebase web config JSON and enable email/password auth.
- Supabase Auth + table: paste the Supabase project URL and anon key. Create a `studyquest_sync` table with `user_id`, `payload`, and `updated_at` columns.

Copy `.env.example` to `.env` for local backend configuration. Never commit real keys.

## New Study Surfaces

- `progress.html`: weekly focus graphs, task completion history, subject pressure heatmap, exam readiness, recommendations, and activity history.
- `skill-tree.html`: RPG learning path with prerequisite node IDs, XP, badges, rank points, and league progression.
- `video-quest.html`: YouTube milestone hard-pause checkpoints with terminal/scratchpad evaluation panels.

## GitHub Pages

This repo includes `.nojekyll` and a GitHub Actions Pages workflow. In the repository settings, set Pages source to GitHub Actions to use `.github/workflows/pages.yml`, or keep branch-based Pages if it is already enabled for `main`.

The backend cannot run on GitHub Pages because Pages is static hosting. Deploy `studyquest_api.py` to a free Python host, set `CORS_ORIGINS` to your Pages URL, then paste the backend URL into StudyQuest Settings.

## Tests

```bash
npm test
```

The Playwright suite checks dashboard navigation, flashcard scheduling, exam planning, progress/skill pages, Video Quest, and the AI fallback path. GitHub Actions runs JavaScript syntax checks, Python compile/import checks, dependency checks, and Playwright.
