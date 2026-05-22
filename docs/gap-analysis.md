# Even Steven — Gap Analysis & Second-Pass PRD

Compiled 2026-05-22. Based on a full audit of all 32 GitHub issues, every issue comment, and the current codebase.

**Status:** ~29 of 32 issues are closed. Three areas block a working app:
1. Infrastructure never connected (Supabase migrations, Edge Functions, Resend, Vercel)
2. One open feature (Push Notifications, issue #29)
3. Scattered deferred items left explicit in issue comments

---

## 1. Supabase — Migrations Not Applied

All 7 migration files exist on disk but multiple were written in agent sessions where the Supabase MCP was unavailable. We need to verify which have actually been applied to the production project (`mavlkmwwpcogtwbxtmpr`) and apply any that haven't.

### Migrations to verify/apply

| File | What it creates | Issue | Status |
|------|----------------|-------|--------|
| `20260521000000_initial_schema.sql` | All 11 core tables, triggers, indexes | #3 | Likely applied — app has been used |
| `20260521000001_rls_policies.sql` | RLS on all 11 tables | #3 | Likely applied |
| `20260521000002_app_config.sql` | `app_config` table (version gate) | #12 | Uncertain |
| `20260521000003_fix_groups_select_rls.sql` | Fix for groups SELECT policy | #3 follow-up | Uncertain |
| `20260521000004_invite_helpers.sql` | `resolve_invite_token()` SECURITY DEFINER fn + `show_balance_nudge` column + `activate_invited_members` trigger | #18 | ✅ Already applied |
| `20260521000005_account_deletion.sql` | `get_groups_with_outstanding_balances()` fn | #31 | ✅ Already applied |
| `20260521000006_receipts_storage.sql` | `receipts` Storage bucket + RLS policies | #22 | ✅ Applied 2026-05-22 |

### After applying all migrations

Regenerate TypeScript types and save to `lib/database.types.ts`:
```bash
# Via Supabase MCP:
mcp__supabase__generate_typescript_types
# Or via CLI:
npx supabase gen types typescript --linked > lib/database.types.ts
```

The current `lib/database.types.ts` was hand-written at project start and may not reflect the invite helpers, account deletion function, or receipts bucket columns.

---

## 2. Supabase Edge Functions — Not Deployed

Two Edge Functions are written on disk but have never been deployed to the Supabase project.

### `supabase/functions/send-invite-email/index.ts`
- ✅ Deployed 2026-05-22
- Sends from `onboarding@resend.dev` until custom domain purchased pre-launch
- `RESEND_API_KEY` set as Supabase secret

### `supabase/functions/delete-account/index.ts`
- ✅ Deployed 2026-05-22

### `send-push-notification` — ✅ Done 2026-05-22
- Built and deployed. Handles 12 event types, checks notification preferences, is_muted, and Expo push token per recipient.

---

## 3. Resend — Email Not Connected

The invite email flow exists end-to-end in code but is not working in production.

### What needs to happen

1. **`RESEND_API_KEY` must be set as a Supabase Edge Function secret:**
   ```bash
   npx supabase secrets set RESEND_API_KEY=<value-from-.env>
   ```
   The key is in `.env` locally but Edge Functions need it as a Supabase secret, not a local env var.

2. **Deploy the Edge Function** (see section 2 above)

3. **Sender address:** Updated to `onboarding@resend.dev` (Resend shared domain) until `evensteven.app` is purchased and verified pre-launch. Edge function updated 2026-05-22.

4. ~~**Wire the call in `addInvitedMember`:**~~ Done 2026-05-22. `addInvitedMember` now accepts `inviterMemberId?` and fires `send-invite-email` (fire-and-forget) when the invitee email is not yet registered.

---

## ~~4. Vercel — Web Layer Not Auto-Deploying~~ — Done 2026-05-22

Production URL: `even-steven-five.vercel.app`. Auto-deploys on push to `master` of `even-steven-web`. App Store/Play Store URLs still placeholders.

## ~~4. Vercel — Original note~~

Issue #32 comment is explicit: the Vercel project is still linked to `Kizza00232Jera/even-steven` (mobile repo). It needs to be re-linked to `Kizza00232Jera/even-steven-web` in the Vercel dashboard.

### What needs to happen

1. **Go to:** Vercel Dashboard → even-steven project → Settings → Git → disconnect and reconnect to `Kizza00232Jera/even-steven-web`
2. **Verify:** push a trivial commit to `master` of `even-steven-web` and confirm Vercel triggers a deploy

### Placeholders in the web layer (deferred until apps ship)

In `even-steven-web/src/app/invite/[token]/page.tsx`:
- `APP_STORE_URL` — placeholder, update when iOS app is live on App Store
- `PLAY_STORE_URL` — placeholder, update when Android app is on Play Store

---

## ~~5. Push Notifications (#29)~~ — Done 2026-05-22

Issue #29 is the only fully OPEN issue. Nothing has been built. The `push_tokens` and `notification_preferences` tables already exist in the schema (created in migration #0).

### How to build

**A. Permission prompt + token registration**

- Show permission prompt at the end of onboarding, after the currency screen, just before landing on Groups tab. Use `expo-notifications` `requestPermissionsAsync()`.
- If denied: in Account tab, show a "Enable notifications" row. Tapping it calls `Linking.openSettings()` to open the iOS/Android system settings so the user can enable manually.
- On grant: call `getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra.eas.projectId })` and store the token in `push_tokens` table via `lib/repos/pushTokens.ts` → `upsertPushToken(client, userId, token)`.
- Re-register on every app open (tokens can rotate) — call upsert in `app/_layout.tsx` after session is confirmed.

**B. Notification types — defaults per spec §17**

| Type | DB key | Default |
|---|---|---|
| Trip expired | `trip_expired` | **ON** |
| Member joined/added/removed | `member_change` | off |
| Trip end approaching (3 days before) | `trip_expiry_warning` | off |
| Trip ends today | `trip_ends_today` | off |
| New expense | `new_expense` | off |
| Expense edited | `expense_edited` | off |
| Expense deleted | `expense_deleted` | off |
| Payment received (to you) | `payment_received` | off |
| Payment in group | `payment_in_group` | off |
| Balance reaches zero | `balance_zero` | off |

Seed defaults into `notification_preferences` on first sign-in (upsert with defaults, only `trip_expired = true`).

**C. Edge Function `send-push-notification`**

New file: `supabase/functions/send-push-notification/index.ts`

Called directly from the repo mutation functions (not via DB webhook — simpler, more reliable). Each mutation that produces a notifiable event calls it after the DB write succeeds.

Function logic:
1. Receives `{ eventType, groupId, actorMemberId, recipientUserIds[], metadata }` in POST body
2. For each recipient: look up their push token from `push_tokens`, check `notification_preferences` for this event type, check `group_members.is_muted` for this group
3. Skip if: no token, preference off, or group muted
4. Send to Expo Push API: `POST https://exp.host/--/api/v2/push/send` with `{ to: token, title, body, data: { screen, params } }`

**D. Where to call the edge function (repo layer)**

| Event | Called from |
|---|---|
| New expense | `lib/repos/expenses.ts` → `createExpense()` |
| Expense edited | `lib/repos/expenses.ts` → `updateExpenseMetadata()` + `updateExpenseFinancial()` |
| Expense deleted | `lib/repos/expenses.ts` → `deleteExpense()` |
| Settlement recorded | `lib/repos/settlements.ts` → `recordSettlement()` — also check if balance reaches zero here |
| Member joined/added | `lib/repos/invites.ts` → `acceptInvite()` |
| Member removed | `lib/repos/groups.ts` → `removeMember()` |

**E. Trip expiry notifications (scheduled)**

Use Supabase pg_cron (available on free tier). Two daily jobs at 08:00 UTC:

```sql
-- Trip ends today
SELECT cron.schedule('trip-ends-today', '0 8 * * *',
  $$SELECT net.http_post(url := 'https://mavlkmwwpcogtwbxtmpr.supabase.co/functions/v1/send-push-notification', ...)$$
);

-- Trip expiry warning (3 days out)
SELECT cron.schedule('trip-expiry-warning', '0 8 * * *', ...);
```

The edge function queries `groups` where `end_date = TODAY` (or `end_date = TODAY + 3`) and sends to all active members.

**F. Per-type preference toggles (Account tab)**

In `app/(tabs)/account/index.tsx`, add a "Notifications" section with a toggle row per type. Read/write `notification_preferences` table via `lib/repos/pushTokens.ts` → `getNotificationPreferences` / `updateNotificationPreference`.

**G. Deep link routing on notification tap**

In `app/_layout.tsx`, add `addNotificationResponseReceivedListener`. Each notification's `data` field carries `{ screen, params }`:

| Event type | Route |
|---|---|
| `new_expense` / `expense_edited` / `expense_deleted` | `group/[groupId]/` (Expenses tab) |
| `payment_received` / `payment_in_group` / `balance_zero` | `group/[groupId]/balances` |
| `member_change` | `group/[groupId]/members` |
| `trip_expired` / `trip_expiry_warning` / `trip_ends_today` | `group/[groupId]/` |

**H. Badge count**

- On notification received (foreground or background): `setBadgeCountAsync(currentCount + 1)`
- On app foreground (`AppState` change to `active`): `setBadgeCountAsync(0)`
- Both in `app/_layout.tsx`.

---

## 6. Deferred Items from Closed Issues

These were explicitly left incomplete inside issues that are otherwise closed. They need follow-up.

### ~~6a. Expense Edit — Financial Structure (issue #23)~~ — Done 2026-05-22

The edit expense form (`app/group/[id]/edit-expense.tsx`) only handles metadata edits (title, description, category). The financial structure (amount, split mode, participants) is read-only.

**How to build:**

- When `hasGroupSettlements` is false (no non-voided settlements in the group), unlock the full financial fields: amount, currency, payer picker, participant multi-select, split mode segmented control (Equal / Unequal / Percentage), and split inputs
- Pre-fill all financial fields from the existing expense data
- Reuse the same split logic as `add-expense.tsx`: `calculateEqualSplit`, `calculateUnequalSplit`, `calculatePercentageSplit` from `lib/splits.ts`; payer remainder auto-hold; mode-switch clears amounts
- On save: call a new repo function `updateExpenseFinancial(client, expenseId, { amount, currency, payerId, participants, splitMode })` that:
  1. Updates `expenses` row (amount, currency, payer_id, is_edited = true)
  2. Deletes existing `expense_participants` rows for this expense
  3. Inserts new `expense_participants` rows from the split result
- Gate: if `hasGroupSettlements` is true, show the current read-only notice ("Financial details are locked once a settlement has been recorded"). No change to this path.
- Existing `updateExpenseMetadata` function handles the metadata fields unchanged — only the financial section is new.
- Add `updateExpenseFinancial` to `lib/repos/expenses.ts` (already has `updateExpenseMetadata`).

### ~~6b. Realtime "Edited by [Name]" Toast (issue #25)~~ — Done 2026-05-22 (migration pending apply)

Currently shows *"This expense was just edited."* — spec requires *"This expense was just edited by [name]."*

**How to build:**

1. **Migration** — add column to `expenses`:
   ```sql
   ALTER TABLE expenses ADD COLUMN last_edited_by uuid REFERENCES group_members(id);
   ```

2. **Set on every edit** — in `lib/repos/expenses.ts`, update both `updateExpenseMetadata` and the new `updateExpenseFinancial` (from 6a) to include `last_edited_by: currentMemberId` in their UPDATE payloads.

3. **Read in realtime handler** — in `app/group/[id]/edit-expense.tsx`, the Supabase Realtime UPDATE payload includes the new column value. Read `payload.new.last_edited_by` (a `group_members.id`). Cross-reference against the already-loaded members list to get the display name, then show: `"This expense was just edited by [name]."`. Skip the toast if `last_edited_by === currentMemberId` (the current user's own save).

4. **Regenerate types** after applying the migration.

### ~~6c. Settings Screen — Invite Link Reset Not Wired~~ — Fixed 2026-05-22

`handleShareInvite` and `handleResetInvite` wired in `app/group/[id]/settings.tsx`. Uses `getOrCreateInviteToken` / `resetInviteToken` from `lib/repos/invites.ts`. Native share sheet opens on share; confirmation alert guards reset.

### 6c-followup. TypeScript enum type errors (exposed by type regeneration)

Regenerating `lib/database.types.ts` exposed mismatches where the Supabase CLI emits `string` for enum columns (`Currency`, `role`, `status`, `settlement_visibility`) but app code expects specific union types. Affects `lib/repos/groups.ts`, `lib/repos/balances.ts`, `lib/repos/summary.ts`, and two screen files. Fix: add type assertions in repo functions or patch the generated types file. Does not affect runtime — TypeScript-only.

### ~~6c-original. Settings Screen — Invite Link Reset Not Wired~~ — Fixed

Issue #15 comment: *"Invite link sharing/reset rows are present in settings but not wired (invite system deferred)"*

Now that the invite system (issue #18) is built, the invite link share and reset buttons in `app/group/[id]/settings.tsx` need to be wired to `lib/repos/invites.ts#getOrCreateInviteToken` and `resetInviteToken`.

### ~~6d. Members Screen — Add Member by Email Not Wired (issue #16)~~ — Done 2026-05-22

Issue #16 comment: *"Add member / Invite via link in Members screen deferred (invite system)."*

The Members screen (`app/group/[id]/members.tsx`) has an add/invite button that was deferred. Now that invites are built, it should open the invite flow (email input → calls `addInvitedMember`).

### ~~6e. Balance Warning on Member Remove — Uses Real Balances (issue #15)~~ — Done 2026-05-22

### ~~6f. Balance on Group Cards — Seeded at Zero (issue #16)~~ — Done 2026-05-22 (migration pending apply)

Decision: **Option B — denormalized `balance` column on `group_members`**, updated by a DB trigger after any change to `expenses`, `expense_participants`, or `settlements`. Avoids N round-trips on Groups tab load.

**Needs:**
1. Migration: add `balance DECIMAL(12,2) DEFAULT 0` to `group_members` + trigger function that recomputes balance after expense/settlement changes
2. Update `fetchGroupsWithMembership` in `lib/repos/groups.ts` to use stored `balance` column instead of hardcoded `0`

### ~~6g. Display Name Priority Enforcement (issue #30)~~ — Done 2026-05-22

Priority chain: **Group Display Name → Account Display Name → Gmail Name → Email**

**Critical gap found:** `profiles` table has no `google_name` column. The profile creation trigger stores `id`, `email`, and `google_avatar_url` but discards the Gmail name. Currently the third tier silently falls through to email. Gmail Name must be stored at signup.

**How to build:**

**Step 1 — Migration**
```sql
ALTER TABLE profiles ADD COLUMN google_name TEXT;

-- Store Gmail name on profile creation (update existing trigger)
CREATE OR REPLACE FUNCTION handle_new_user() ...
  INSERT INTO public.profiles (id, email, google_avatar_url, google_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'full_name'   -- add this line
  )
  ON CONFLICT (id) DO UPDATE SET
    email             = EXCLUDED.email,
    google_avatar_url = EXCLUDED.google_avatar_url,
    google_name       = EXCLUDED.google_name;   -- add this line
```
`google_name` is write-once from the trigger — the app never updates it directly.

**Step 2 — Helper function in `lib/displayName.ts`**

Create (or update) a shared pure function:
```ts
export function resolveDisplayName(
  groupDisplayName: string | null,
  accountDisplayName: string | null,
  googleName: string | null,
  email: string,
): string {
  return groupDisplayName ?? accountDisplayName ?? googleName ?? email;
}
```

**Step 3 — Use it everywhere consistently**

Surfaces that need fixing (all currently use `display_name ?? profile?.display_name ?? email`, missing `google_name`):
- `lib/repos/balances.ts` — member name in debt rows
- `lib/repos/activity.ts` — actor name in activity feed events
- `lib/repos/friends.ts` — friend card name
- `lib/repos/summary.ts` — member contribution names
- `app/group/[id]/members.tsx` — member row names
- `app/group/[id]/balances.tsx` — "A owes B" labels

Each of these joins `profiles` — add `google_name` to the SELECT and pass it to `resolveDisplayName`.

**Step 4 — Regenerate types** after migration.

### ~~6h. Pending Friend Auto-Upgrade~~ — Already done

`activate_invited_members` trigger (migration #4, lines 44–49) already upgrades pending friendships when a new profile registers. Not a gap.

---

## ~~7. Uncommitted Change~~ — Reverted 2026-05-22

There is a single uncommitted change in `app/group/[id]/add-expense.tsx` (visible in `git diff`):

```diff
-    } catch {
-      Alert.alert('Error', 'Could not save the expense. Please try again.');
+    } catch (err: unknown) {
+      const msg = err instanceof Error ? err.message : JSON.stringify(err);
+      Alert.alert('Error', msg);
```

This exposes raw Supabase error messages (including RLS details) directly to the user. This was likely a debugging change. **Revert it** — the original user-facing message is correct. If you need error visibility for debugging, use `console.error(err)` before the `Alert`.

---

## 8. App Store / Play Store — Pre-launch Only

Deferred until app is validated and ready to publish. No code changes needed — EAS config and app.json are already correct.

**When ready:**
1. **iOS** — Join Apple Developer Program ($99/year) → `eas build --platform ios --profile production` → `eas submit --platform ios`. EAS handles certificates automatically.
2. **Android** — Register Google Play Console ($25 one-time) → `eas build --platform android --profile production` → grab SHA-1 from build output → add to Google Cloud OAuth client → add `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` to `.env`.
3. **Google OAuth on device** — verify with `eas build --platform ios --profile development` on a physical device before App Store submission.
4. **Web layer** — update `APP_STORE_URL` and `PLAY_STORE_URL` in `even-steven-web/src/app/invite/[token]/page.tsx` once store listings are live.

---

## ~~9. `lib/database.types.ts`~~ — Done 2026-05-22

Regenerated via `npx supabase gen types typescript --linked` after all migrations applied. Reflects:
- `show_balance_nudge` column on `profiles` (from migration #4)
- `get_groups_with_outstanding_balances` function (from migration #5)
- `receipts` storage bucket policies (from migration #6)
- Any future columns added (e.g. `last_edited_by` if added for section 6b)

---

## 10. App Store / Play Store — Placeholder URLs

In `even-steven-web` (web layer):
- `APP_STORE_URL = "https://apps.apple.com/app/even-steven/..."` — placeholder
- `PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=..."` — placeholder

These can only be filled after apps are submitted and approved. They affect the fallback redirect path in `/invite/[token]` when the app is not installed.

---

## Priority Order for This Iteration

1. **Apply all pending Supabase migrations** — nothing works correctly without these
2. **Regenerate TypeScript types** — keep types in sync with schema
3. **Deploy Edge Functions** (`send-invite-email`, `delete-account`) — unblock invite emails and account deletion
4. **Set Resend secret + wire email call** — complete the invite email flow
5. **Re-link Vercel** to `even-steven-web` repo — one manual step, 2 minutes
6. **Revert uncommitted change** in `add-expense.tsx`
7. **Wire invite link reset/share in Settings** (deferred from #15)
8. **Wire add-member in Members screen** (deferred from #16)
9. **Wire real balance on group cards** (deferred from #16)
10. **Wire real balance check on member remove** (deferred from #15)
11. **Expense edit — financial structure** (deferred from #23)
12. **`last_edited_by` migration + toast** (deferred from #25)
13. **Push Notifications (#29)** — full feature, largest remaining item
14. **Display name priority audit** — verify consistency across all surfaces
15. **Pending friend auto-upgrade** — verify trigger covers friendships
