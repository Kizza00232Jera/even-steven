# Bug Fixes — v1 Device Test

Grilled and confirmed 2026-05-22. Fix these in one branch before the next APK build.

---

## 1. Expense save always fails (CRITICAL)

**Symptom:** "Could not save the expense. Please try again." on every save attempt. Postgres log: `new row violates row-level security policy for table "expenses"`.

**Root cause:** `is_group_member`, `is_expense_participant`, and `is_expense_payer_or_group_admin` are all marked `STABLE`. PostgreSQL's planner is allowed to evaluate STABLE functions at plan time, before the JWT claims (`auth.uid()`) are available in that context, causing membership checks to return `false` even when the user is a valid member.

**Fix:** New migration — alter all three functions from `STABLE` to `VOLATILE`.

```sql
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public
AS $$ ... $$;

-- same for is_expense_participant and is_expense_payer_or_group_admin
```

---

## 2. Activity feed always shows "Something went wrong"

**Symptom:** Activity tab shows error state immediately. API returns 400 on every feed request.

**Root cause:** `lib/repos/activity.ts` sends this PostgREST join:
```
actor:actor_id(display_name, email, actor_profile:profiles!group_members_user_id_fkey(...))
```
`activity_events.actor_id` already references `profiles.id` directly. The nested `actor_profile:profiles!group_members_user_id_fkey` tries to hop from `profiles` back to `profiles` via a FK that belongs to `group_members`, not `profiles`. PostgREST rejects it.

**Fix:** Simplify the select in `fetchActivityFeed` — pull `display_name`, `email`, and `google_name` directly from the first join; drop the nested `actor_profile` sub-join entirely.

```typescript
// Before
`actor:actor_id (display_name, email, actor_profile:profiles!group_members_user_id_fkey(display_name, google_name))`

// After
`actor:actor_id (display_name, email, google_name)`
```

Update the TypeScript type for the actor join and the `actorName` resolution logic accordingly.

---

## 3. Onboarding screen flashes for returning users

**Symptom:** After sign-in, onboarding screen appears for ~500ms then immediately redirects to groups.

**Root cause:** `NavigationGuard` in `app/_layout.tsx` exits early when `isLoading = false`, but `profile` is still `null` because the profile fetch is in flight. The guard treats `null` as "new user → redirect to onboarding" before the fetch resolves.

**Fix:** Keep `isLoading = true` in the auth store until the profile fetch completes, not just until the session resolves. Only set `isLoading = false` after the profile query has settled (either found or confirmed absent). No transition or animation needed — direct replace once state is resolved.

---

## 4. Group creation defaults to USD instead of user's preferred currency

**Symptom:** Step 3 of group creation pre-selects USD regardless of the user's account currency.

**Root cause:** `app/group/create.tsx` line 493 hardcodes `useState<Currency>('USD')`.

**Fix:** Use `profile?.preferred_currency ?? 'EUR'` as the initial state. Also fix `app/group/[id]/add-expense.tsx` which currently falls back to `'USD'` — change that fallback to `'EUR'` as well.

---

## 5. Back button in group creation wizard is invisible

**Symptom:** The ChevronLeft back button on steps 2 and 3 is white on a white background in light theme — not visible or tappable.

**Fix:**
- Use a theme-aware color token for the icon (e.g. `Colors.text` / NativeWind `text-foreground`) so it contrasts on both light and dark backgrounds.
- Add a "Back" text label next to the icon so the tap target is clear and the intent is readable.

---

## 6. Theme selector missing from Account tab + light mode contrast issues

**Symptom:** No way to switch between light, dark, and system theme in the app. Some text and icons are invisible in light mode (confirmed: back button above, likely others).

**Fix (two parts):**

**6a — Add theme toggle to Account tab.** Three options: System (default), Light, Dark. Persist the selection to AsyncStorage. Wire through the existing NativeWind `colorScheme` context.

**6b — Targeted light-mode audit.** After adding the toggle, test every screen in light mode and fix any element using a hardcoded color (white icon, dark-only text, etc.) that doesn't have a `dark:` counterpart. Do not attempt a full preemptive audit — fix what's visibly broken.

---

## 7. Date picker allows impossible dates (e.g. June 33rd)

**Symptom:** Group creation trip date fields accept free-text like "2026-06-33" — no validation on day range per month.

**Root cause:** Custom `DateField` component uses a raw `TextInput` with manual digit formatting. No calendar constraint.

**Fix:** Replace `DateField` entirely with the same `DateTimePicker` from `@react-native-community/datetimepicker` already used in the add-expense screen. Show the current date as a tappable button; tapping opens the native calendar picker. No free-text entry. Apply to both `start_date` and `end_date` fields.

---

## 8. Expense filter pills take excessive height when list is empty

**Symptom:** The "All / Unsettled / Mine / I paid" pill row stretches to fill the screen when there are no expenses.

**Root cause:** The pills container has `flex-1` (or inherits it), causing it to expand into available space when the list below it is empty.

**Fix:** Remove `flex-1` from the pills container. Add `flex-shrink-0` so it collapses to its natural content height (vertical padding + pill height, both in NativeWind spacing units — no hardcoded pixels). Height will scale naturally with screen density and font size.

---

## 9. Notification defaults are all off for new accounts

**Symptom:** All notification toggles default to off. Some should be on by default once permission is granted.

**Fix:** New migration — change column defaults in `notification_preferences`:

**Default ON:** `new_expense`, `payment_received`, `someone_joins_group`, `someone_added`

**Default OFF (unchanged):** `expense_edited`, `expense_deleted`, `payment_in_group`, `member_removed`, `trip_end_approaching`, `trip_ends_today`, `trip_expired`, `balance_reaches_zero`

Also update the `handle_new_auth_user` trigger INSERT so newly created preference rows honour these defaults. Existing users are unaffected (their row already exists).
