# Even Steven — Claude Context

Expense-splitting mobile app (iOS + Android). Members log shared expenses; the app computes the minimum settlements to get everyone to zero.

Read this file fully before doing anything. It tells you what to build, where to build it, and how to push it.

**Goal:** Build as much as possible with minimal human interaction. Every decision and credential needed has been pre-resolved below. Do not stop and ask unless something is genuinely missing from this file and the spec.

---

## Pre-Build Checklist (all resolved before first build session)

These are completed by the human before handing off to you. Do not re-do them. Do not ask about them.

| # | Step | Status |
|---|------|--------|
| 1 | Supabase project created (eu-north-1) | ✅ Done |
| 2 | Google Cloud OAuth — Web + iOS client IDs created | ✅ Done |
| 3 | Google OAuth credentials pasted into Supabase Auth → Providers → Google | ✅ Done — verified 2026-05-20 |
| 4 | iOS client ID added to `.env` | ✅ Done |
| 5 | Resend account created + API key in `.env` | ✅ Done |
| 6 | `eas login` run in terminal (Expo account: antonio.jera10@gmail.com) | ✅ Done |
| 7 | Android OAuth client deferred — add after first EAS Android build provides SHA-1 | ⏳ Deferred — not a blocker |
| 8 | Custom domain `evensteven.app` — deferred until pre-launch | ⏳ Deferred — not a blocker |
| 9 | App Store / Play Store accounts — deferred until ready to ship | ⏳ Deferred — not a blocker |

**When you start building:** All secrets are in `.env`. Read them. Do not ask for credentials.

---

## Key Docs (read before building any feature)

| File | What it contains |
|------|-----------------|
| `research/spec.md` | Full product specification §1–41 — every feature, rule, and edge case |
| `CONTEXT.md` | Canonical domain language — use these terms exactly in code, UI, and comments |
| `docs/design-system.md` | **Read before building any screen or component.** Colors, typography, spacing, every component pattern, motion, states, DO/DON'T rules |
| `docs/testing-strategy.md` | **Read before writing any test.** Four-layer testing strategy, Supabase test DB setup, what to test and what not to |

If the spec and this file conflict, the spec wins.

---

## Architecture

This is **not** a standard web project. Two separate repos, two separate deployments:

| Layer | Technology | Repo | Where deployed |
|-------|-----------|------|----------------|
| Mobile app | React Native + Expo (TypeScript) | `Kizza00232Jera/even-steven` (this repo) | App Store + Play Store via EAS |
| Web (invite links, legal pages) | Next.js (lightweight) | `Kizza00232Jera/even-steven-web` (separate repo) | Vercel — `even-steven.vercel.app` |
| Backend | Supabase | — | eu-north-1 (Stockholm) |

**This repo is the mobile app only.** Do not add web code here.

The web repo (`even-steven-web`) only handles:
- `/invite/{token}` — smart deep link redirect (opens app or redirects to store)
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service

**All business logic lives in the mobile app and Supabase. The web layer is a redirect + static pages layer with no shared code.**

---

## Supabase

| Field | Value |
|-------|-------|
| Project name | even-steven |
| Project ID / ref | `mavlkmwwpcogtwbxtmpr` |
| Region | eu-north-1 (Stockholm) |
| API URL | `https://mavlkmwwpcogtwbxtmpr.supabase.co` |
| Anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdmxrbXd3cGNvZ3R3Ynh0bXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNzM0MDksImV4cCI6MjA5NDg0OTQwOX0.jIxFYubuTSV5HN8nW7TXNKu9FyCeud-p4ZzdpvHcB2c` |
| Publishable key | `sb_publishable_26Ql2zYbzt9qqG0_cZIsUA_w7q7DExw` |
| Dashboard | https://supabase.com/dashboard/project/mavlkmwwpcogtwbxtmpr |

DB password is in `.env` (never commit it).

**Dev environment:** Develop directly against this production project. The DB is empty — no local Supabase instance needed. Apply migrations via `mcp__supabase__apply_migration` or the Supabase CLI. After every migration, run `mcp__supabase__generate_typescript_types` and save output to `lib/database.types.ts`.

**Supabase MCP is connected.** Use `mcp__supabase__*` tools to:
- Apply migrations (`apply_migration`)
- Run queries (`execute_sql`)
- Generate TypeScript types (`generate_typescript_types`)
- Check logs (`get_logs`)

Always `list_tables` before writing schema changes. Always `generate_typescript_types` after a migration and save the output to `lib/database.types.ts`.

---

## Vercel

| Field | Value |
|-------|-------|
| Team | kizza00232jera (personal) |
| Project | even-steven |
| Production URL | `even-steven.vercel.app` |
| GitHub repo | `Kizza00232Jera/even-steven-web` (web layer — separate repo) |
| Production branch | `master` |

**Vercel MCP is connected.** Use `mcp__vercel__*` tools to check deployments and logs.

Pushing to `master` of `even-steven-web` triggers automatic Vercel deployment of the web layer.

**Note:** The Vercel project must be re-linked from `Kizza00232Jera/even-steven` to `Kizza00232Jera/even-steven-web` in the Vercel dashboard — this is a one-time manual step.

---

## GitHub / Git

| Field | Value |
|-------|-------|
| Remote | `https://github.com/Kizza00232Jera/even-steven.git` |
| Production branch | `main` (protected — never commit directly) |

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<short-description>` | `feature/auth-google-signin` |
| Bug fix | `fix/<short-description>` | `fix/remainder-recalculation` |
| Schema / DB | `db/<short-description>` | `db/initial-schema` |
| Chore | `chore/<short-description>` | `chore/expo-scaffold` |

### Workflow for every change

1. Branch off `main`: `git checkout -b feature/xxx`
2. Commit incrementally as work progresses — small, focused commits
3. Push branch: `git push -u origin feature/xxx`
4. Open a PR with: a clear title + bullet summary of what changed and why
5. Merge into `main` (squash merge to keep history clean)
6. Delete the feature branch after merge

### Commit style

Present tense, specific, focused on what and why. No vague messages.

```
Add debt simplification algorithm for minimum settlement calculation
Fix payer remainder not recalculating when expense total changes
Implement equal/unequal/percentage split modes on expense form
```

**Never add Co-Authored-By lines. Never mention Claude or AI in commits or PR descriptions.**

### PR description format

```
## What
- Bullet list of what was built/changed

## Why
- Brief context if not obvious from the spec

## Notes
- Any edge cases, deferred items, or known limitations
```

---

## Environment Variables

All secrets live in `.env` (gitignored). `EXPO_PUBLIC_` prefix = accessible in the JS bundle. No prefix = server-side only (Edge Functions, migrations — never in the app bundle).

| Variable | Where used |
|----------|-----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase client init |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase client init |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase client init (prefer this over anon key for new code) |
| `SUPABASE_DB_PASSWORD` | Migrations only — never in app |
| `GOOGLE_WEB_CLIENT_ID` | Supabase Auth config — not in app bundle |
| `GOOGLE_WEB_CLIENT_SECRET` | Supabase Auth config — never in app bundle |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | `app.json` → `expo.ios.googleServicesFile` / Google Sign-In config |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Not yet — add after first EAS Android build |
| `RESEND_API_KEY` | Supabase Edge Functions only — never in app |

### app.json wiring (when scaffolding Expo)

When creating `app.json`, wire in the iOS client ID exactly here:

```json
{
  "expo": {
    "name": "Even Steven",
    "slug": "even-steven",
    "bundleIdentifier": "com.evensteven.app",
    "android": { "package": "com.evensteven.app" },
    "plugins": [
      ["expo-router"],
      ["@react-native-google-signin/google-signin", {
        "iosUrlScheme": "com.googleusercontent.apps.1083529094883-sumv5pdh22335cub7lt74t82ht3d8b6v"
      }]
    ]
  }
}
```

The `iosUrlScheme` is the iOS client ID reversed (required for Google Sign-In URL scheme handling on iOS).

### Supabase Auth — manual step required before first login works

Go to Supabase Dashboard → Authentication → Providers → Google and paste:
- Client ID: value of `GOOGLE_WEB_CLIENT_ID` from `.env`
- Client Secret: value of `GOOGLE_WEB_CLIENT_SECRET` from `.env`

This cannot be done via MCP. Without it, Google sign-in returns an error at runtime.

---

## Project Structure (target)

```
even-steven/                # Mobile app only — no web code here
├── app/                    # Expo Router screens
│   ├── (auth)/             # Login / onboarding
│   ├── (tabs)/             # Main tab navigator
│   │   ├── groups/
│   │   ├── friends/
│   │   ├── activity/
│   │   └── account/
│   └── group/[id]/         # Group detail + nested tabs
├── components/             # Shared UI components
├── lib/
│   ├── supabase.ts         # Supabase client init
│   ├── database.types.ts   # Auto-generated from Supabase
│   └── debt.ts             # Debt simplification algorithm
├── hooks/                  # Custom React hooks
├── constants/              # Colors, fonts, category maps
├── supabase/
│   └── migrations/         # SQL migration files
├── research/
│   └── spec.md
├── CONTEXT.md
├── CLAUDE.md               # This file
├── .env                    # Secrets (gitignored)
└── .gitignore
```

---

## Tech Stack Detail

| Concern | Choice | Notes |
|---------|--------|-------|
| Server state + caching | TanStack Query (React Query) | Handles loading/error/refetch for all Supabase data fetching |
| Local / UI state | Zustand | Modal state, selected group, form context, session data |
| Mobile framework | React Native + TypeScript | Expo managed workflow |
| Styling | NativeWind (Tailwind for RN) | Use `dark:` variants — both themes are first-class |
| Routing | Expo Router (file-based) | Same mental model as Next.js App Router |
| Auth | Supabase Auth + Google OAuth | Gmail only — no email/password |
| Realtime | Supabase Realtime (Postgres Changes) | Expenses + balances update live for all members |
| Storage | Supabase Storage | Receipt images + custom profile/group photos |
| Edge Functions | Supabase Edge Functions (Deno) | Push notifications via Expo, invite emails via Resend |
| Push notifications | Expo Notifications | Expo push token stored per user in DB |
| Exchange rates | Frankfurter API | Fetch once on app open, cache in memory for session |
| Invite emails | Resend | From `invite@evenSteven.app` |
| Web / invite redirects | Next.js on Vercel | Thin layer — no business logic |
| Charts (Summary tab) | Victory Native XL (default) | Evaluate Gifted Charts before building §13 — see spec note |
| Haptics | `expo-haptics` | Financial confirmations and destructive actions only — see §33 |
| OTA updates | `expo-updates` | Minor JS fixes without App Store submission |

---

## Design System

| Token | Value |
|-------|-------|
| Dark bg | `#0b0b0b` |
| Light bg | `#f8f8f8` |
| Dark surface | `#1a1a1a` |
| Light surface | `#ffffff` |
| Accent | `#00C896` |
| Border | 1px, very low opacity |
| Display font | Space Grotesk (Expo Google Fonts) |
| Body font | Inter (Expo Google Fonts) |
| Buttons | Pill-shaped |
| Cards | `border-radius: 16–20px` |
| Spacing | 4px grid |

No drop shadows. Depth via surface color shifts only. Gradients on group headers and balance cards.

**Group type gradients** (default backgrounds, no network request):
- Trip → deep blue to teal
- Home → warm amber to orange
- Couple → rose to purple
- Utilities → slate to indigo
- Family → green to emerald
- Other → neutral grey to charcoal

---

## Core Business Rules

- **Currencies:** USD, EUR, DKK, SEK only. Base currency locked at group creation.
- **Debt simplification:** Compute minimum settlements across net balances — never raw pairwise debts.
- **Expense visibility:** Non-participants never see an expense — it does not exist for them.
- **Payer remainder:** In Unequal and Percentage splits, payer's field auto-holds remainder. Payer field is editable but total must always sum to 100% / full amount.
- **Rounding:** Round down to 2dp on equal splits. Payer silently absorbs remainder. No UI indication.
- **Future dates:** Blocked on expense entry. Past and today only.
- **Realtime:** All balance and expense changes propagate live via Supabase Realtime.
- **Offline:** Online-only for writes. Show last cached data + banner when offline.
- **Settlement visibility:** Group-level toggle. Private = settlement invisible to anyone not a party.
- **Settlement correction:** Members can only undo their own settlements.

## Package Manager

**npm** — use exclusively. No yarn, no bun.

To scaffold the project, run this once at the repo root:
```
npx create-expo-app@latest . --template blank-typescript
```
Then install dependencies with `npm install`. Use `npx expo install <package>` for Expo-managed packages (ensures version compatibility).

---

## README — Keep It Current

`README.md` must stay in sync with the code. Update it as part of the same PR that implements the feature — never leave it behind.

### What to update and when

| Trigger | What to update in README |
|---------|--------------------------|
| New feature shipped | Add it to the **Features** section with a one-line description |
| First screen of a tab built | Add a screenshot placeholder row to the screenshots section |
| Screenshots available | Replace placeholder with actual image |
| New env var added | Add it to the **Environment Variables** section with a description |
| Setup step changes | Update the **Setup** or **Prerequisites** section immediately |
| Feature removed or renamed | Remove or update it — stale README is worse than no README |

### Features section format

List only what is fully working. No "coming soon", no partial features.

```markdown
## Features

- **Expense splitting** — equal, unequal, and percentage splits with automatic remainder assignment
- **Debt simplification** — minimum settlement calculation across all group members
- **Real-time sync** — expenses and balances update live for all group members
```

Add each line when the feature is complete and tested on device, not when it's coded.

---

## Testing Strategy

**TDD for all logic in `lib/`** — write tests first, implement to green, refactor.

Use the `/tdd` skill for these modules:
- `lib/debt.ts` — debt simplification algorithm
- `lib/splits.ts` — equal/unequal/percentage calculations, remainder logic, rounding (§24)
- `lib/currency.ts` — number formatting (§39), live conversion
- `lib/categories.ts` — keyword-to-category auto-detection map (§11)

**UI components with logic** (expense form split modes, Remainder recalculation, balance display, invite states) — test these with React Native Testing Library in Layer 3 of `docs/testing-strategy.md`. **Purely presentational components** (avatars, gradient cards, icons) — skip tests, no logic to assert on.

**Never write automated tests for:** navigation flows, Realtime subscription wiring, or Supabase client configuration — verify these on device. See `docs/testing-strategy.md` for the full four-layer strategy.

---

## What to Build First (suggested order)

1. Supabase schema + RLS policies
2. Supabase TypeScript types (`generate_typescript_types`)
3. Auth flow (Google OAuth, onboarding screens)
4. Group creation wizard (§7)
5. Expense system (§11, §12)
6. Debt simplification algorithm (`lib/debt.ts`)
7. Balances tab + Settle Up flow (§13)
8. Realtime subscriptions
9. Invite system + deep links (§9)
10. Push notifications (§17)
11. Friends system (§16)
12. Activity feed (§15)
13. Summary tab + charts (§13)
14. Web layer on Vercel (invite redirects, privacy, terms)
