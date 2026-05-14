# StudyQuest

StudyQuest is a static study planner PWA with tasks, notes, focus sessions, timetable planning, OCR, spaced-repetition flashcards, exam mode, cloud sync hooks, and an optional server-side AI endpoint.

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

## Cloud Sync

StudyQuest supports two browser-side account sync options from Settings:

- Firebase Auth + Firestore: paste the Firebase web config JSON and enable email/password auth.
- Supabase Auth + table: paste the Supabase project URL and anon key. Create a `studyquest_sync` table with `user_id`, `payload`, and `updated_at` columns.

## GitHub Pages

This repo includes `.nojekyll` and a GitHub Actions Pages workflow. In the repository settings, set Pages source to GitHub Actions to use `.github/workflows/pages.yml`, or keep branch-based Pages if it is already enabled for `main`.

## Tests

```bash
npm test
```

The Playwright suite checks dashboard navigation, flashcard scheduling, exam planning, and the AI fallback path.
