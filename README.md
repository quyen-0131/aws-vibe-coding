# French conversations

A study app for busy learners: read a real French conversation, rebuild its lines, then reply in your own words and get feedback. You can practise our weekend conversation or paste your own French.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer and a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a file called `.env.local` in this folder containing your key:
   ```
   GEMINI_API_KEY=your-key-here
   ```
   `.env.local` is git-ignored, so the key is never committed.
3. Start the server and open http://localhost:8777:
   ```bash
   npm start
   ```

Open the app through `http://localhost:8777`, not by double-clicking `app.html`, because browsers block the modules it needs on `file://` pages.

## Deploy to Vercel

The repo is ready for Vercel: the static files are served as-is, and `api/match.js` and `api/phrases.js` run as serverless functions (both use `lib/gemini.js`, like the local server).

1. On [vercel.com/new](https://vercel.com/new), import this GitHub repo. Leave the framework as "Other" and the build settings empty.
2. Under **Environment Variables**, add `GEMINI_API_KEY` with your key.
3. Deploy. Every push to `main` redeploys automatically.

## What uses Gemini

- **Answer checking** on the Say it step (`POST /api/match`).
- **Key phrases and English translations** for pasted text, only when the learner ticks the Gemini box (`POST /api/phrases`).

Without a key the app still works: answers show as "not checked" and phrases come from the built-in picker. The free tier allows about 5 requests a minute.

Optional settings in `.env.local`:

```
GEMINI_MATCH_MODEL=gemini-3.5-flash-lite
GEMINI_PHRASE_MODEL=gemini-3.5-flash-lite
```

## Tests

```bash
npm test
```

## Project layout

- `app.html` is the app.
- `server.js` is the local server; `api/` holds the Vercel functions.
- `lib/gemini.js` is the only code that uses the Gemini key.
- `src/content-to-exercise/` turns pasted French into exercises.
- `reminders/` holds the goal-linked reminders.
- `PRD.md`, `CONTEXT.md` and `.kiro/specs/` describe the product and its requirements.
