# CICO — Cash In, Cash Out

*"Where did all my money go?" — the question this app answers.*

Oct 20, 2026 · @Romel Lartey · Updated Oct 28, 2026 (all build steps shipped; see the decisions log)

CICO ("Cash In, Cash Out") is a personal finance tracking PWA for a single user, logging income, expenses, savings and investments via natural language input parsed by an AI model (Groq first, Gemini as the fallback). It works fully offline and syncs to Supabase when online. This document is the single source of truth: any Claude Code session should read it first before making changes.

## Goals

- Let the user log a transaction in under five seconds using plain text.
- Work completely offline; sync automatically when back online.
- Be usable on both phone and laptop with a UI polished to a senior product design level.
- Let the AI answer natural language questions about spending, grounded only in real data, never hallucinated numbers.
- Keep the build achievable in a single night by a solo developer plus Claude Code.

## Non-goals for this version

- No multi-user accounts or signup flow yet.
- No bank integration or automatic transaction import.
- No row level security in Supabase, since there is only one user.
- No budgeting or forecasting features yet.

## Tech stack

- Frontend: React with Vite, set up as an installable PWA with a service worker, for example vite-plugin-pwa.
- Styling: Tailwind CSS, aiming for a clean, modern, senior-level UI/UX.
- Local storage: IndexedDB, via a wrapper such as Dexie.js, as the offline source of truth.
- Remote storage: Supabase, Postgres, for cross-device sync.
- AI: Groq (open models, OpenAI-compatible API) tried first, with the Google Gemini API as the fallback. Used for parsing natural language transaction entries and for a function-calling chat feature over the user's data. Called only from the serverless functions in `api/`; keys stay server-side.
- Hosting: Vercel or similar for the frontend; Supabase hosted backend.

## Core user flows

### Logging a transaction

1. User opens the app; it works offline.
2. User types a natural language entry, for example "received 2000 cedis salary" or "bought a hoodie for 120".
3. If online, the text goes to the AI (Groq, falling back to Gemini), which returns structured fields: amount, direction (income or expense), category, a cleaned description and, if the note says when, the date and time. It matches against existing categories or proposes a new one if nothing fits. The result is always shown for review before saving.
4. If offline, the user falls back to a manual form: amount, direction, category from the existing list, description.
5. The transaction is written immediately to IndexedDB with a synced flag set to false.
6. A background sync process pushes unsynced rows to Supabase when online, and pulls down new rows from other devices, merging into IndexedDB.

### Viewing the dashboard

Shows the available balance (spendable money), the selected month's income, expenses and net amounts moved into savings and investments, spending by category, recent transactions, cash flow over six months, and where the month's money went. Any month can be picked.

### Browsing transactions

A searchable, filterable list of all transactions, filterable by category, date range and direction.

### Chat with your data

A chat interface where the user asks plain language questions, for example "how much did I spend on subscriptions this month" or "compare this month to last month". The model uses function calling rather than answering from memory: defined functions include totals by category, totals by date range, comparing two periods, listing biggest transactions in a period, and the all-time balance. The model picks the right function, the browser runs it against real local data, and the model phrases the answer using only that returned data, in short plain text. Chat requires internet since the models are not available offline.

## Data model

### Table: categories

Fields: id (uuid, primary key), name (text), color\_or\_icon (text), is\_default (boolean), created\_at (timestamp).

Seed categories: Income, Savings, Investments, Transport, Food, Subscriptions, Gifts, Clothes, Miscellaneous. Users can add new categories at any time from within the app.

### Table: transactions

Fields: id (uuid, primary key), amount (numeric), direction (enum: income or expense), category\_id (uuid, foreign key to categories.id), description (text), occurred\_at (timestamp), synced (boolean, local-only, not stored in Supabase), created\_at (timestamp).

### Table: settings (Supabase only)

Fields: key (text, primary key), value (jsonb), updated_at (timestamp, last write wins), server_updated_at. Holds shared settings; today only `pin`, the PIN hash, so one PIN unlocks every device.

Categories and transactions are mirrored locally in IndexedDB with the same shape, minus Supabase-specific metadata, so the app can read and write entirely offline.

Sync fields (approved Oct 21, 2026), on both tables: updated_at (timestamp, bumped on every change; used for last-write-wins), deleted_at (timestamp or null; soft delete so offline deletes sync and are not pulled back), and synced (boolean, local-only) on categories as well as transactions. Seed categories use fixed UUIDs so every device creates identical rows.

## Offline and sync strategy

IndexedDB is always the first write target; the UI never waits on network for a transaction to save. Each local record tracks a synced boolean. On regaining connectivity, a sync routine pushes all unsynced local rows to Supabase and marks them synced, then pulls any Supabase rows newer than the last local sync timestamp and merges them into IndexedDB. Conflict handling stays simple for v1, last-write-wins by timestamp, since it is single-user across devices rather than concurrent multi-user editing. The PIN hash rides along on each sync run. AI features require connectivity; when offline, the app degrades gracefully to manual entry and disables chat with a clear message.

## Authentication and security

No account system in this version, and no Supabase Row Level Security since there is only one user. Access is gated by a simple PIN, four to six digits, checked client-side against a salted PBKDF2 hash. The hash is stored on the device and in the Supabase settings table, so the same PIN works on every device and in the installed app. A valid PIN entry starts a session that remains valid for three days, after which the PIN is requested again. This is meant to deter casual access by someone who finds the link, not to be cryptographically bulletproof.

## Future path: multi-user, not built now

When CICO expands to other users, add proper authentication: email plus magic link verification, where the user enters their email, receives a verification link, and clicking it confirms the email and creates or accesses their account. This avoids fake or garbage emails being stored and is a clean bolt-on to the current schema: add a user\_id column to transactions and categories, and enable Row Level Security scoped by user\_id. Do not attempt to build this now; the current schema should not be prematurely complicated for it.

## UI/UX requirements

Design quality bar: senior-level product design, clean, modern, minimal visual clutter. Fully responsive: mobile gets a vertical, card-based layout, thumb-friendly controls, and a bottom nav for switching between dashboard, add transaction, transactions list and chat; desktop gets a wider landscape layout with sidebar navigation and more information density. Core screens: Dashboard, Add Transaction, Transactions List, Chat.

## Open questions and decisions log

None open. Earlier questions (local DB library, charting, AI models) are settled in the log below: Dexie.js, hand-rolled SVG charts, and Groq with a Gemini fallback.

Decided Oct 21, 2026:

- Palette: the design skill (`CICO-design-skill.md`) is the implementation spec; the mockup PNG is a visual exploration only. Primary `#176B5B`, deep green `#0F4C3A`, accent `#10B981` (sparing), expense `#C75C52`, error `#EF4444`, background `#F7F8F5`. Darker text-safe variants exist for colours that fail AA as small text; see the skill's token block.
- Currency: always `GH₵`.
- Comparisons: show "vs last period" changes only when a valid comparison period with real data exists; otherwise omit them.
- Balance: superseded on Oct 28, 2026 by "Transfers" below.
- Navigation: follow the design skill. Desktop sidebar: Overview, Add transaction, Transactions, Ask CICO, Settings. Mobile bottom nav: Home, Add, Activity, Ask; the phone drawer uses the same mobile labels plus Settings (Oct 28, 2026). Settings scope is defined in the design skill, section F.
- Gemini models (now the fallback, see "AI providers" below): parsing uses gemini-3.5-flash-lite with minimal thinking (~1s); chat uses gemini-3.5-flash (revisit at step 8). Overridable via GEMINI_PARSE_MODEL / GEMINI_CHAT_MODEL. gemini-2.5-flash is retired for new keys.
- Repo: https://github.com/iamromelalvin7/CICO
- Charts (Oct 21, 2026): hand-rolled SVG (doughnut, balance trend area, cash-flow bars) instead of a chart library, to keep the bundle small. Doughnuts show at most five slices; smaller categories are grouped as "Other".
- Settings (Oct 21, 2026): optional display name for the greeting (device only), sync status and Sync now, category management (add, rename, recolour, delete with reassignment; Savings and Investments cannot be deleted because the dashboard relies on them), change PIN and Lock now, currency (GH₵, fixed), CSV export.
- Sidebar (Oct 21, 2026): a hamburger collapses the desktop sidebar to an icon rail (remembered per browser); on phones the hamburger opens a drawer with all screens including Settings.
- PIN recovery: "Forgot PIN?" emails a one-time code (Supabase Auth email OTP) to the owner's address (VITE_RECOVERY_EMAIL). Entering the code clears only the PIN; data is kept on the device and in Supabase. Requires internet. The new PIN replaces the old one on every device (see "Shared PIN" below).

Decided Oct 28, 2026:

- Transfers: money moved into Savings or Investments is still logged as an expense in that category, and money taken out as income in it, but these are transfers between the user's own pots, not earning or spending. Income, Expenses and the cash-flow chart leave them out. The balance is the spendable money: every income minus every expense, transfers included (= income − expenses − net moved into savings and investments). The Savings and Investments cards ("Net saved", "Net invested") show the net moved in for the period plus an all-time total; that total starts from when tracking began, so it can go negative if money saved earlier is taken out. Investment profit is not tracked separately. Chat uses the same rules. Code: `src/db/queries.ts`.
- Shared PIN: the PIN hash is stored in the Supabase `settings` table as well as on the device. A new device or installed app adopts it instead of asking for a new PIN; changes and email resets reach every device (last write wins). A device's first PIN never overwrites one already set elsewhere. The three-day session stays per device.
- Deploys: the `VITE_` variables are baked in at build time. A Vercel build without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` never syncs (this happened once). Set them in Vercel before deploying.
- AI providers: Groq first, Gemini as the fallback when Groq errors, hits its limit or returns nothing, including partway through a chat. Groq models: openai/gpt-oss-20b for parsing (low reasoning effort) and openai/gpt-oss-120b for chat; overridable via GROQ_PARSE_MODEL / GROQ_CHAT_MODEL. Groq's free tier allows 8,000 tokens per minute per model (about 10 entries or 2 chat questions a minute); short limits are waited out once before falling back. The parse prompt includes the last 14 days with weekday names so relative dates resolve correctly. Code: `api/_lib/ai.ts`, `groq.ts`, `gemini.ts`.
- Mobile audit fixes: grid tracks and cards must be able to shrink (`grid-cols-1`, `min-w-0`); a long truncated description once made the page wider than the phone. The phone drawer is min(320px, 85vw), uses the bottom bar's labels, locks page scroll and returns focus to the menu button. The balance card is "Available balance" with "Excludes money in savings and investments". Charts respond to taps (donut segments and legend rows, cash-flow months, balance-trend readout), and tapping the month opens a native month picker.

## Build priority (all done as of Oct 28, 2026)

1. Project scaffold: Vite, React, Tailwind, PWA plugin.
2. IndexedDB schema and basic CRUD for categories and transactions.
3. Add Transaction screen with a manual form first, AI parsing layered in once the base flow works.
4. Dashboard screen reading from IndexedDB.
5. Transactions list screen with filters.
6. Supabase project, tables, and the sync routine, push and pull.
7. PIN lock screen with a three-day session.
8. Chat screen with AI function calling, wired to the same query functions used by the dashboard.
9. Responsive polish pass for mobile and desktop layouts.
