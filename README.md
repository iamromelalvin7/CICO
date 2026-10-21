# CICO — Cash In, Cash Out

A personal finance tracker that answers "where did all my money go?". Log income, expenses, savings and investments in plain language, keep working offline, and sync across devices when online.

Offline-first PWA built with React, Vite, Tailwind CSS, IndexedDB, Supabase and Gemini.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in values
npm run dev
```

### Running the AI functions locally

Gemini is called only from the serverless functions in `api/` (`/api/parse` and `/api/chat`), so the API key never reaches the browser. `npm run dev` serves the app but not these functions. To run both together, use the Vercel CLI:

```bash
npx vercel login        # first time only
npx vercel link         # first time only: link this folder to the Vercel project
npx vercel dev          # app + /api functions on http://localhost:3000
```

`vercel dev` reads `GEMINI_API_KEY` from your local `.env`. For deployments, set it in the Vercel dashboard under Project Settings → Environment Variables.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

## Project docs

Product spec, build rules and design system are kept locally and not committed.
