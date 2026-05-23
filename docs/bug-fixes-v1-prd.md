## Problem Statement

After building the first production APK and installing it on an Android device, several bugs were found through real-device testing. The most critical blocks all expense testing: every attempt to save an expense fails silently with an RLS error. Additional issues affect the activity feed (always errors), onboarding flow (flashes for returning users), group creation UX (invisible back button, bad date picker, wrong currency default), the expense list layout, and notification defaults.

## Solution

Apply a targeted set of fixes across the database, repositories, and UI layers to make the app fully testable and production-ready for a second device build.

## User Stories

1. As a user, I want to save an expense so that the group's balances update correctly.
2. As a user, I want the expense save to succeed on the first attempt without any error message.
3. As a user, I want the Activity tab to show my activity feed, not an error state.
4. As a user, I want the Activity tab to show a friendly empty state when there is no activity yet.
5. As a returning user, I want sign-in to take me directly to my groups without flashing the onboarding screen.
6. As a new user, I still want to see the onboarding screen so I can set my display name.
7. As a user creating a group, I want the currency selector to pre-select my preferred currency so I do not have to change it manually.
8. As a user whose preferred currency is not set, I want EUR as the default currency (not USD).
9. As a user on the add-expense screen, I want the currency to also default to EUR when no preference is set.
10. As a user creating a group, I want to go back to the previous step if I make a mistake on the current step.
11. As a user on a light theme, I want all buttons and icons to be visible so I can navigate the app.
12. As a user on a dark theme, I want all buttons and icons to remain visible so nothing disappears.
13. As a user, I want a theme selector (System / Light / Dark) in my Account settings so I can override the system default.
14. As a user setting trip dates during group creation, I want a calendar picker so I cannot accidentally enter an impossible date like June 33rd.
15. As a user looking at an empty expense list, I want the filter pills to be compact and not stretch across the full screen height.
16. As a user granting notification permission for the first time, I want the most important notifications (new expense, payment received, new member) to be on by default.
17. As a user, I want less important notifications (expense edited, member removed, etc.) to stay off by default so I am not overwhelmed.
18. As a user who created an account after the notification system was introduced, I want my notification preferences to be correctly initialised on sign-up.

## Implementation Decisions

### 1. Database: Fix RLS function volatility (migration required)

The three RLS helper functions — is_group_member, is_expense_participant, is_expense_payer_or_group_admin — are currently marked STABLE. PostgreSQL's planner is permitted to cache STABLE function results at plan time, before the JWT claims (auth.uid()) are populated. This causes all three functions to silently return false during expense inserts, blocking every save attempt. Changing all three to VOLATILE prevents result caching and ensures auth.uid() is evaluated at execution time with the correct JWT context.

### 2. Database: Notification preference defaults (migration required)

The notification_preferences table currently defaults all columns to false. The following four columns should default to true: new_expense, payment_received, someone_joins_group, someone_added. The remaining eight columns stay false by default. The handle_new_auth_user trigger INSERT must also be updated to honour these new defaults so that newly registered users get the correct initial state. Existing users are unaffected (their row already exists).

### 3. Activity feed repository: Fix invalid PostgREST join

activity_events.actor_id is a foreign key to profiles.id. The current query includes a nested sub-join actor_profile:profiles!group_members_user_id_fkey(...) which tries to traverse from profiles back to profiles via a foreign key that belongs to group_members, not profiles. PostgREST rejects this with a 400. The fix is to select display_name, email, and google_name directly from the first join (actor:actor_id(...)), removing the nested sub-join entirely. The TypeScript actor type and actorName resolution logic must be updated to match the flattened shape.

### 4. Auth store: Eliminate onboarding flash for returning users

The isLoading flag in the auth store currently becomes false as soon as the session resolves, before the profile fetch completes. The NavigationGuard then sees profile === null (fetch still in flight) and incorrectly redirects to onboarding. isLoading must remain true until the profile query has settled — either returning a row or confirming the user has no profile. No animation is needed on redirect; direct replace is correct.

### 5. Group creation wizard: Currency default

The currency state in the group creation wizard is hardcoded to USD. It should initialise from profile.preferred_currency, falling back to EUR (not USD) when no preference is set. The same EUR fallback should also be applied in the add-expense screen, which currently falls back to USD.

### 6. Group creation wizard: Back button visibility

The ChevronLeft back button on steps 2 and 3 is rendered with a white colour, making it invisible against a light background. The fix is two parts: (a) use a theme-aware foreground colour token so the icon contrasts on both light and dark backgrounds, and (b) add a "Back" text label alongside the icon for clarity and a larger tap target.

### 7. Group creation wizard: Native date picker

The custom DateField text input for trip start/end dates allows free-text entry with no day-range validation, permitting impossible dates. Replace both date fields with the native DateTimePicker component (already a dependency, already used in the add-expense screen). The field should display the current value as a tappable button; tapping opens the native calendar overlay. No free-text entry.

### 8. Expense list: Filter pill container height

The filter pill row stretches to fill available vertical space when the expense list is empty because its container has flex-1. The container should be flex-shrink-0 with content-driven height (vertical padding + pill height, in NativeWind spacing units). No hardcoded pixel values — height must scale naturally with screen density and base font size.

### 9. Account tab: Theme selector and light-mode audit

Add a theme selector (System / Light / Dark) to the Account settings tab. Persist the selection to AsyncStorage. Wire through the existing NativeWind colorScheme context. After adding the selector, test every screen in light mode and fix any element that uses a hardcoded colour without a dark: counterpart. Scope of the audit: fix what is visibly broken in light mode — not a full preemptive pass.

## Testing Decisions

Good tests assert observable external behaviour — what the function returns or what the component renders — not how it achieves it. Do not test internal state, intermediate variables, or implementation details.

No new automated tests are required for this batch. All nine fixes are either database migrations, query corrections, UI layout changes, or UX defaults. None introduce new business logic that warrants a unit test under the project's four-layer testing strategy. The acceptance criterion for every fix in this batch is on-device verification in the next APK build.

## Out of Scope

- Adding new features or screens not mentioned above.
- A full preemptive theme audit of every screen — only fix visibly broken elements found during light-mode testing.
- Changing notification preferences for existing users — only new sign-ups are affected by the defaults change.
- Android OAuth client setup (deferred per spec until first EAS Android build provides SHA-1).
- Any change to the web layer (even-steven-web).

## Further Notes

- Fix 1 (RLS volatility) is the critical path — it blocks all expense and balance testing. Implement and verify it first before the other fixes.
- The preferred_currency fallback change affects two screens: group creation and add-expense. Both must be updated in the same PR.
- The theme selector should be implemented before the light-mode audit pass, since the audit requires the toggle to exist to test systematically.
- All fixes should ship in a single branch and PR to keep the next APK build self-contained.
