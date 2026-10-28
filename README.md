# CICO — Cash In, Cash Out

A personal finance tracker that answers "where did all my money go?". Log income, expenses, savings and investments in plain language, keep working offline, and sync across devices when online.

Offline-first PWA built with React, Vite, Tailwind CSS, IndexedDB, Supabase, Groq and Gemini.

## How money is counted

- **Income** and **Expenses** are what you earn and spend.
- Moving money into **Savings** or **Investments** is logged as Cash out in that category; taking it back out is Cash in in the same category. These are transfers between your own pots, so Income and Expenses leave them out.
- **Available balance** is your spendable money: everything in minus everything out, transfers included. Money sitting in savings or investments is not part of it.
- The **Net saved** and **Net invested** cards show what moved in during the month, plus an all-time total counted from when you started tracking.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in values
npm run dev
```

### Setting up sync

Data is always saved to IndexedDB first and synced to Supabase in the background. To create the tables, open your Supabase project's SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql) (safe to re-run). Then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. Without them the app still works, on this device only.

The PIN is shared the same way: its salted hash is kept in the `settings` table, so one PIN unlocks every device and the installed app. The three-day unlock lasts per device.

For deployments, set the same `VITE_` variables (plus `VITE_RECOVERY_EMAIL`) in the Vercel dashboard under Project Settings → Environment Variables, then redeploy. They are baked in at build time, so a build made without them never syncs, and the PIN stays per device.

### Running the AI functions locally

The AI models are called only from the serverless functions in `api/` (`/api/parse` and `/api/chat`), so the API keys never reach the browser. Groq (open models) is tried first when `GROQ_API_KEY` is set; Gemini takes over if Groq fails or hits its limit. Set either key or both. `npm run dev` serves the app but not these functions. To run both together, use the Vercel CLI:

```bash
npx vercel login        # first time only
npx vercel link         # first time only: link this folder to the Vercel project
npx vercel dev          # app + /api functions on http://localhost:3000
```

`vercel dev` reads `GROQ_API_KEY` and `GEMINI_API_KEY` from your local `.env`. For deployments, set them in the Vercel dashboard under Project Settings → Environment Variables.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

## Project docs

- [`.agents/CLAUDE.md`](.agents/CLAUDE.md): product spec and decisions log
- [`.agents/CICO-design-skill.md`](.agents/CICO-design-skill.md): design system
- [`.agents/CICO-Rules.md`](.agents/CICO-Rules.md): build rules
- [`CICO Mobile Audit.md`](CICO%20Mobile%20Audit.md): mobile UI audit (fixed Oct 28, 2026)
