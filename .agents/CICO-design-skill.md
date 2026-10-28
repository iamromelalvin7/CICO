---
name: cico-product-design
description: Design and implement CICO, a calm, natural, offline-first personal finance PWA. Use for all UI work, visual decisions, components, screens, responsive behavior, and interaction polish.
---

# CICO Product Design Skill

## 1. Product intent

CICO means **Cash In, Cash Out**. It answers: “Where did all my money go?”

Design CICO as a quiet, trustworthy personal money companion—not a trading terminal, bank portal, gamified budgeting app, or generic SaaS dashboard. The experience should feel natural, grounded, discreet, and quick to use. Money is emotionally loaded; the interface should reduce anxiety and cognitive effort rather than create urgency.

Primary user promise:
- Capture a transaction in under five seconds.
- Understand the shape of personal finances at a glance.
- Trust that displayed totals come from saved transactions.
- Keep working offline and communicate sync status clearly.

Design principles:
1. **Calm over clever.** Use restrained color, generous spacing, and readable hierarchy.
2. **Natural language first.** Make the quick-entry prompt the easiest path, while keeping manual entry obvious and dependable.
3. **Data is the interface.** Every amount, chart, and AI response must be grounded in actual local or remote records.
4. **Quiet feedback.** Confirm saves, sync, errors, and offline state without loud celebration or alarmist UI.
5. **Progressive disclosure.** Show the important overview first; place detailed filters, metadata, and settings where they belong.
6. **One coherent product.** Mobile and desktop should feel like the same application, not separate designs.
7. **Accessible by default.** Good contrast, visible focus, keyboard support, large touch targets, and labels that do not depend on color alone.

## 2. Visual direction

Use a warm, editorial, lightly organic visual language. Pair an almost-white paper surface with deep evergreen/teal, soft mint, and occasional warm accents. A very subtle atmospheric gradient may be used in the welcome/PIN screen or a single hero surface. Do not put gradients behind every card.

Avoid:
- Generic blue-and-purple AI gradients.
- Excessive glassmorphism, neon, shadows, or floating cards.
- Every metric rendered as a different saturated color.
- Dense dashboards with too many charts.
- Giant “AI-powered” branding or chatbot-first navigation.
- Fake financial data in production UI. Use fixtures only in explicitly labelled design previews.
- Emoji as the primary icon system.
- Excessively rounded “pill everything” controls.

### Design tokens

Use CSS variables or Tailwind theme tokens. This is the final palette (decided Oct 21, 2026); it supersedes the colours in the mockup PNG, which is a visual exploration only. Tune only with a clear reason.

Colour roles:
- `#176B5B` primary owns the brand: primary buttons, links, active nav, focus rings.
- `#0F4C3A` deep green supplies depth: PIN/welcome screen, dark surfaces, strong emphasis.
- `#10B981` accent supplies energy, sparingly: positive highlights, selected chart segments, small active-state markers. Never use it everywhere.
- `#C75C52` coral represents expenses. Spending is a normal event, not a failure.
- `#EF4444` red is reserved for genuine errors and destructive actions.

Contrast (WCAG AA, checked): `#10B981`, `#C75C52` and `#EF4444` fall below 4.5:1 as small text on light surfaces. Use them for fills, icons, chart marks and large text only; for small text use the `-text` variants below (each at least 4.5:1 on bg, surface and surface-muted). Text placed on an `#10B981` fill must be `--cico-ink`, not white (white is 2.5:1).

```css
:root {
  color-scheme: light;
  --cico-bg: #F7F8F5;           /* warm paper */
  --cico-surface: #FFFFFF;
  --cico-surface-muted: #EEF2EE;
  --cico-ink: #172B27;          /* deep evergreen */
  --cico-ink-muted: #60716C;    /* darkened from #667873 to pass AA on bg */
  --cico-border: #DFE7E1;
  --cico-primary: #176B5B;      /* evergreen teal, brand */
  --cico-primary-hover: #105448;
  --cico-primary-soft: #DDF2E9;
  --cico-deep: #0F4C3A;         /* PIN screen, dark surfaces */
  --cico-accent: #10B981;       /* sparing positive/chart/active accent; not for small text */
  --cico-accent-text: #0B7C56;
  --cico-mint: #A8E3CF;         /* soft highlight on dark surfaces */
  --cico-positive: #237B58;
  --cico-positive-soft: #E3F4EA;
  --cico-expense: #C75C52;      /* restrained coral; not for small text */
  --cico-expense-text: #AA4F46;
  --cico-expense-soft: #FCEAE7;
  --cico-error: #EF4444;        /* genuine errors and destructive actions only */
  --cico-error-text: #C63838;
  --cico-amber: #B7792B;
  --cico-violet: #8171BD;       /* sparingly, for categories */
  --cico-radius-sm: 10px;
  --cico-radius-md: 16px;
  --cico-radius-lg: 22px;
  --cico-shadow-card: 0 2px 12px rgb(23 43 39 / 4%);
}
```

Dark surfaces may be used for the PIN/welcome experience, with a deep evergreen background and soft mint highlights. Do not force a full dark mode into v1 unless requested.

### Typography

- Use **Inter**, **Geist**, or a similar neutral, highly legible sans-serif for the product UI.
- A restrained editorial serif may appear in the CICO wordmark or one welcome-screen headline, but not for data tables or dense controls.
- Use tabular numerals for financial values where supported (`font-variant-numeric: tabular-nums`).
- Suggested scale: page title 28–32px desktop / 24–28px mobile; section title 16–18px; body 14–16px; helper/caption 12–13px.
- Avoid overly light font weights for balances and small labels.

## 3. Layout and spacing

Use a consistent 4px spacing base. Common values: 4, 8, 12, 16, 20, 24, 32, 40, 48.

- Page background: `--cico-bg`.
- Cards: white surface, 1px subtle border, 16–22px radius, minimal shadow.
- Keep a readable content width around 1200–1360px on large displays.
- Desktop: fixed or sticky left sidebar around 220–248px; main content with comfortable 24–32px padding.
- Mobile: single-column flow, bottom navigation, safe-area-aware padding, and sticky quick-entry affordance where useful.
- Avoid nesting cards inside cards unless the hierarchy genuinely needs it.
- Do not let every section compete for attention. Establish one clear primary action per screen.

## 4. Navigation and responsive behavior

### Desktop
Sidebar navigation:
- Overview
- Add transaction
- Transactions
- Ask CICO
- Settings (lower priority)

Show a compact CICO wordmark at the top and a quiet online/offline sync indicator near the bottom. Use labels with icons, not icons alone.

### Mobile
Use a bottom navigation bar for:
- Home
- Add (visually emphasized but not oversized)
- Activity
- Ask

Keep controls thumb-friendly; aim for 44px minimum hit targets. Respect device safe areas. The add action should be reachable without scrolling. Every bottom-bar icon sits in the same 40px box so the labels line up.

The hamburger opens a drawer (a modal dialog) listing Home, Add, Activity, Ask and Settings: the same names as the bottom bar, so each screen has one name per device. Drawer width `min(320px, 85vw)`, neutral `rgba(0, 0, 0, 0.35)` backdrop covering the page and bottom bar, page scroll locked while open, Escape or a tap outside closes it, and focus returns to the menu button.

### Responsive rules
- Dashboard cards: 4-column summary row on wide screens, 2 columns on small screens, then one column only on very narrow widths.
- Charts and transaction tables must transform rather than simply shrink. On mobile, use transaction rows/cards with description, category, date, and amount; do not force a wide desktop table into the viewport.
- Filters can wrap or move into a bottom sheet on mobile.
- Preserve hierarchy and the primary action at all widths.
- Nothing may widen the page. Grid tracks use `minmax(0, 1fr)` (Tailwind `grid-cols-1`) and cards carry `min-w-0`, so truncated text cannot push a row past the screen. A phone lays out the whole page wider and zooms out if any element overflows.
- Verify at 320, 375, 390 and 430px, and at larger system text, before shipping layout changes.
- Charts must work by touch, not only hover: tap to select (a second tap clears), and keep vertical swipes scrolling the page.

## 5. Core screen specifications

### A. PIN / welcome screen
Purpose: create a discreet, composed entry point.
- Deep evergreen background with a subtle radial or horizon-like gradient; no loud illustration required.
- Wordmark “CICO” and the descriptor “Cash In, Cash Out.”
- Short line: “Your money, in one place.”
- Four-to-six-digit PIN input with clear focus and error states.
- Keep the screen minimal and centered. Do not imply the PIN is strong account security; it is a casual-access lock.
- Provide a clear recovery/reset path appropriate to the local-only model.

### B. Dashboard
Purpose: answer “How am I doing?” at a glance.

Suggested order:
1. Greeting and selected period (e.g. “October overview”), with an unobtrusive sync/offline state.
2. **Available balance** as the dominant card, with "Excludes money in savings and investments" beneath it, and a small, truthful period comparison only when sufficient data exists.
3. Compact totals for income, expenses, net saved and net invested (the last two also show the all-time total).
4. Spending by category, using a simple donut or horizontal bar chart and a readable legend.
5. Recent transactions, with a “View all” link.
6. A small natural-language prompt (“Ask about your spending”) may lead to chat, but must not dominate the page.

Rules:
- Do not imply savings and investments are cash available unless the balance calculation explicitly treats them that way.
- Balance formula (decided Oct 28, 2026): money moved into Savings or Investments is logged as an expense in that category, and money taken out as income in it, but both are **transfers**, not earning or spending. Income, Expenses and cash flow leave them out. **Available balance = every income − every expense, transfers included** (= income − expenses − net moved into savings and investments). The Net saved / Net invested cards show the net moved in for the period plus an all-time total. Keep this consistent across the dashboard and chat.
- Currency (decided): display amounts as `GH₵` everywhere (e.g. `GH₵ 1,250.00`), never a bare `₵` or mixed `GHS`. Use `Intl.NumberFormat` with the configured locale/currency.
- Never show a growth arrow or percentage without a valid comparison period and real underlying data.
- If there is no data, use a useful empty state with one clear action: “Add your first transaction.”

### C. Add transaction
This is the most important interaction. Optimize for speed and confidence.

Default quick-entry mode:
- A prominent natural-language field with an example such as “bought lunch for 45 cedis” or “received 2,000 salary.”
- Primary action: “Parse entry” / “Review transaction” (choose one consistent label).
- Parsing must never silently commit a transaction. Show a compact review step before saving, especially if the amount, direction, or category is uncertain.
- Parsed preview includes amount, income/expense, category, description, and date/time.
- Make correction easy: every parsed field is editable.
- On successful save, confirm quietly and keep the user oriented. Avoid unnecessary success modals.

Manual mode:
- Amount
- Direction: Expense / Income
- Category
- Description (optional)
- Date and time
- Save transaction

Offline behavior:
- Natural-language parsing is unavailable when the AI service cannot be reached. Explain this inline and keep manual entry available immediately.
- Do not erase typed text when connectivity changes.
- Write locally first. The UI should confirm local save without waiting for Supabase.
- Clearly distinguish “Saved on this device” from “Synced.”

### D. Transactions / activity
- Search field at top.
- Filters: date range, category, direction.
- Display the active filters and make clearing them easy.
- Newest-first by default; sort behavior must be clear.
- Each row shows date, description, category, and signed amount.
- Income and expense must be distinguishable by sign and restrained color, not color alone.
- Provide useful loading, empty, no-results, and error states.
- On mobile, use well-spaced rows with a clear amount alignment. On desktop, a table is acceptable.
- Editing/deleting transactions should use clear confirmation and preserve sync correctness.

### E. Ask CICO / chat
Purpose: help the user interrogate their own financial records.

- Calm conversational layout, not a generic AI assistant landing page.
- Suggested prompts: “How much did I spend on food this month?”, “Compare this month with last month”, “What were my five largest expenses?”
- Responses should be concise and show the period and currency used.
- When helpful, show a small “Based on 18 transactions · October 1–20” provenance note, generated from real query results.
- If no data matches, say so plainly; never fabricate an estimate.
- The model selects from approved query functions. Application code runs those functions against actual local/remote data, and the model only phrases the returned result.
- Chat requires internet. Offline state should disable sending with a clear explanation, while preserving the draft.
- Avoid presenting financial advice as certainty. This feature is a descriptive data assistant, not a financial adviser.

### F. Category management and settings
- Category names should be readable and editable.
- Use small, restrained color dots or a consistent icon set; never rely on color alone.
- Warn before deleting a category that has linked transactions. Prefer reassignment over orphaning data.
- Settings should expose sync status, last sync time, currency, PIN/session behavior, and local data reset/export if implemented.
- Be honest about what is stored locally versus remotely.

## 6. Component rules

Create reusable components rather than screen-specific one-offs:
- `AppShell`, `SidebarNav`, `MobileBottomNav`
- `PageHeader`, `SyncStatus`
- `BalanceCard`, `MetricCard`
- `TransactionRow`, `TransactionTable`, `TransactionFilters`
- `QuickEntryComposer`, `ManualTransactionForm`, `ParsedTransactionReview`
- `CategoryBadge`, `CategoryPicker`
- `EmptyState`, `InlineNotice`, `Toast`
- `ChatMessage`, `SuggestedPrompt`, `DataProvenance`
- `ConfirmDialog`, `Skeleton`

Buttons:
- Primary: evergreen fill, white text, clear hover/focus/disabled states.
- Secondary: quiet surface or outlined border.
- Destructive: restrained red, only for destructive actions.
- Use verb-led labels (“Save transaction”, “Clear filters”), not vague labels (“Submit”, “Okay”) when possible.

Inputs:
- Persistent labels; placeholders are examples, not labels.
- Show validation beside the relevant field.
- Preserve values after errors and offline/online transitions.
- Use visible keyboard focus rings.

Motion:
- Use small, purposeful transitions (150–220ms) for hover, selection, expansion, and save feedback.
- Honor `prefers-reduced-motion`.
- No parallax, spring-heavy movement, or animation that delays a financial action.

## 7. Accessibility and content

- Meet WCAG AA contrast for text and controls.
- Ensure keyboard access and semantic HTML.
- Charts need a textual summary or data table alternative.
- Provide accessible names for icon buttons.
- Statuses must include text, not just color or an icon.
- Use plain, human language: “Offline — saved on this device” beats “Sync failure.”
- Keep money values, dates, and periods explicit.
- Do not shame spending or use manipulative copy such as “You overspent again.”
- Avoid unnecessary exclamation marks.

## 8. Data integrity and trust rules

These are design requirements as much as engineering requirements:
- Never fabricate balances, categories, trends, transaction counts, or chat answers.
- Clearly label demo/sample data and remove it from production.
- Use one shared calculation/query layer for dashboard totals and chat functions.
- Distinguish zero from unavailable or not-yet-loaded.
- Handle empty, partial, stale, and offline data honestly.
- Explain that locally saved entries may not yet be synced.
- Do not show a transaction as synced until the server confirms the write.
- Use stable IDs and timestamps for sync state; do not rely on array order.
- Treat AI model output as untrusted suggestions. Validate amount, direction, category, date, and description before allowing a save.

## 9. Offline and sync states

Design explicit states:
- **Online · Synced** — subtle green indicator.
- **Syncing…** — neutral indicator with progress only if meaningful.
- **Offline · Saved on this device** — calm amber/neutral inline notice.
- **Sync needs attention** — explain what the user can do; do not hide local data.
- **AI unavailable offline** — keep manual entry usable.

Do not use a scary full-screen error for normal offline operation. Offline is a supported mode, not a failure.

## 10. Implementation guidance for Claude Code / coding agents

Before changing the UI:
1. Read the project structure and existing components.
2. Read the CICO product specification and this design skill.
3. Inspect existing behavior before replacing components.
4. Preserve offline-first storage and sync semantics.
5. Make the smallest coherent implementation that achieves the design.
6. Run available lint, typecheck, tests, and production build. Report failures honestly.

Implementation expectations:
- Use React + Vite + Tailwind, with semantic HTML.
- Prefer existing project conventions; do not introduce a second styling system.
- Use Lucide or the project's existing icon set consistently.
- Use CSS variables for the core palette and shared tokens.
- Keep data logic out of presentation components.
- Use real query results for every financial metric.
- Build mobile layouts deliberately; verify narrow and wide viewports.
- Add loading, empty, error, offline, and success states—not just the ideal state.
- Avoid adding libraries unless they solve a real need. Keep charting lightweight.
- Do not implement multi-user auth, bank integrations, budgeting, or forecasting unless explicitly requested.

### Suggested design acceptance checklist

- [ ] A new transaction can be entered quickly and reviewed before commit.
- [ ] Manual entry works offline.
- [ ] A local save is immediate and visibly distinct from a remote sync.
- [ ] Dashboard metrics are derived from real transaction data.
- [ ] The app has useful empty, loading, error, and offline states.
- [ ] Mobile navigation is thumb-friendly and never obscures content.
- [ ] Desktop layout uses space well without excessive density.
- [ ] Keyboard focus and text contrast are clear.
- [ ] No fabricated financial figures or unsupported trend indicators.
- [ ] Visuals feel calm, natural, coherent, and recognizably CICO—not a generic admin template.

## 11. North-star test

Before shipping any screen, ask:

**Does this make it easier to understand or record my money, while making me feel more in control and not more judged?**

If the answer is no, simplify it.
