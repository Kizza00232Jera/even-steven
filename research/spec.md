# Even Steven — Product Specification

> Expense-splitting app for friends. You spend, it calculates, everyone's even.

---

## 1. Concept

A mobile app (iOS + Android) for groups of friends to track shared expenses during trips, dinners, or any shared activity. At the end, it calculates the minimum number of transactions needed for everyone to be square — no more sending 12 separate payments after a 7-day trip.

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Mobile framework | React Native + TypeScript | Cross-platform iOS & Android |
| Styling | NativeWind (Tailwind CSS for RN) | Consistent design system |
| Build tooling | Expo (managed workflow) | Handles push notifications, deep links, camera, builds — no native config |
| Backend | Supabase | PostgreSQL for relational data, built-in Realtime, Auth, Storage, Edge Functions |
| Auth | Supabase Auth — Google OAuth | Gmail sign-in, profile photo from Google account |
| Push notifications | Expo Notifications | Free, handles iOS + Android, triggered via Supabase Edge Functions |
| Exchange rates | Frankfurter API (ECB) | Free, no API key, updated daily, covers all 4 currencies |
| Transactional email | Resend | Sends invite emails to non-registered users; triggered via Supabase Edge Functions |

---

## 3. Authentication

- Sign in with Google (Gmail) only — no email/password
- Profile photo priority:
  1. **Custom photo** (set by user in Account tab) — always takes priority, never overwritten
  2. **Google profile photo** — used as default if no custom photo set; re-fetched on every app open
- Custom photo uploaded from camera or photo library, compressed to max 1MB, stored in Supabase Storage
- Used throughout the app (member avatars in expense splits, group member lists, etc.)

---

## 4. Currency System

### Supported currencies
USD, EUR, DKK, SEK

### Rules
- Each expense is logged in its **original currency** — this never changes
- The original currency is always displayed on the expense
- A **live conversion** to the user's preferred currency is shown alongside (e.g. "€50 ≈ 375 DKK")
- Exchange rates are **fetched once on app open** (from Frankfurter API) and cached for that session
- Each group has a **base currency** chosen at creation — all balances and settle-up amounts are shown in this currency
- The base currency is used for debt simplification math across mixed-currency expenses
- **Base currency is locked at creation** — cannot be changed after the group is created

---

## 5. Debt Model

**Debt simplification.**

The app tracks a running Balance per person across all expenses in a group, then computes the minimum number of Settlements needed to settle everything. Example: if B owes you €20 from dinner but you owe B €15 from the taxi, the app shows "B owes you €5" — one Settlement, not two.

### Real-time sync
When any member adds an expense, all other group members see it instantly via Supabase Realtime. No refresh needed.

### Expense visibility
If an expense only includes 3 out of 4 group members, the 4th member does not see that expense at all — it does not exist for them.

---

## 6. Group Types

| Type | Dates | Lifecycle |
|---|---|---|
| Trip | Mandatory start + end date | Expires on end date (see §8). Type locked at creation. |
| Home | None | Indefinite |
| Couple | None | Indefinite |
| Utilities | None | Indefinite |
| Family | None | Indefinite |
| Other | None | Indefinite |

---

## 7. Group Creation Flow

Multi-step wizard with a progress indicator at the top. Screens appear conditionally based on previous selections.

3-step wizard with progress indicator (①②③) at the top.

**Step 1 — Type**
Choose group type presented as a 2×3 grid of tappable cards — each with a Lucide or Phosphor SVG icon + label below. No emoji.
- Trip → plane or luggage icon
- Home → house icon
- Couple → two people icon
- Utilities → lightning bolt icon
- Family → family group icon
- Other → grid or dots icon

Locked after creation.

**Step 2 — Details**
- Group name (max 30 characters, live character counter)
- Start date + end date (Trip only, locked after creation)
- Base currency — USD, EUR, DKK, SEK (locked after creation)

**Step 3 — Members & Settings**
- Add members: type email directly or share invite link (native share sheet)
- Settlement Visibility toggle (Public default / Private) with always-visible subtitle explanation
- Both are optional — can be configured or changed later

Group is created and visible to all members immediately after Step 3.

---

## 8. Group Lifecycle (Trip only)

When the trip end date passes:
- On next app open, a **pop-up** appears: "Your trip is over. No new expenses can be added."
- Group becomes **read-only for expenses** — no new expenses can be added
- Settlement remains open — members can still record payments and settle up
- Admin can **extend the end date** in group settings → group becomes fully active again
- Once all balances are zero, the group **auto-archives** → moves to Archived tab, full history preserved

---

## 9. Invite System (Deep Links + Placeholder Members)

### How the invite link works
Each group has one persistent invite link. **Any group member can share this link at any time** — not just the admin. The link can be shared via the native share sheet (WhatsApp, Instagram, Messenger, Discord, Messages, Email, etc.) or copied manually. Because any member can share it and anyone with the link can request to join, the link should be treated like a semi-public URL — do not share it in public forums. The admin can **reset the invite link** at any time from group settings, which invalidates the old link and generates a new one.

**Invalid or reset links:** If someone taps an old invalidated link, they see a clear error screen: "This invite link is no longer valid. Ask a group member to share a new invite link." with an "Open Even Steven" button — takes them to the Groups tab if logged in, or login screen if not.

### What happens when someone taps the link
- **Already a member** → navigates directly to the group detail page. No acceptance screen.
- **App installed, logged in, not yet a member** → deep link opens the app directly → user sees the Invite Acceptance Screen → Accept adds them to the group immediately.
- **App installed, not logged in** → Invite Acceptance Screen is shown first (no sign-in required to view it) → tapping Accept triggers Google sign-in → after sign-in, added to group → lands on group detail page. If it's their first ever sign-in, display name + currency onboarding screens appear before the group detail page. Tapping Decline also triggers sign-in (needed to use the app), then lands on empty Groups tab.
- **App not installed** → invitee becomes a **Invited Member** (stored by email); expenses can be assigned to them immediately; when they install and sign up with the same Gmail, their account activates and all history syncs retroactively → they are then shown the Invite Acceptance Screen → after accepting, **if they already have an outstanding balance**, a one-time pop-up appears: "While you were away, you were added to some expenses. You currently owe [amount]." with a "View balances" button. If they have no balance yet, they land directly on the group detail page with no pop-up.

### Adding by email
Any member can add someone by typing their email directly in the app. Two outcomes:

- **Already registered** → they receive a push notification and see the Invite Acceptance Screen next time they open the app
- **Not registered yet** → they become a Invited Member immediately (expenses can be assigned to them right away). An automated invite email is sent via **Resend** from `invite@evenSteven.app` containing: who added them, group name and type, date range (Trip only), member count, and a smart download link. The link opens the app directly if installed, or redirects to the App Store / Play Store if not. After installing and signing up with the same Gmail, they land on the Invite Acceptance Screen for that group. The smart link is hosted at `join.evenSteven.app/invite/{token}`.

### Invite Acceptance Screen
Shown to anyone who taps an invite link or email invite (new or existing user). Contains:
- Who invited them (e.g. "Antonio invited you to join this group")
- Group name and type
- Date range (Trip groups only)
- Number of members already in the group
- **Accept** button → added to group, lands on group detail page immediately
- **Decline** button → lands on Groups tab (empty state if new user)

### First-time user onboarding
After Google sign-in, new users go through two quick screens before reaching the app:

1. **Display name** — Gmail name pre-filled in an editable field, "Continue" button. Sets their account display name (§19).
2. **Preferred currency** — choose from USD, EUR, DKK, SEK. No pre-selection. "Continue" button. Sets their default currency for expense entry and live conversions.

After both screens, they land on the Groups tab with an empty state: a clear illustration and two actions — "Create a group" and "Join a group with a link." No tutorial screens beyond these two prompts.

---

## 10. Permissions

### Admin (group creator)
- Change group name
- Extend or change end date (Trip only)
- Change group background photo
- Change settlement visibility (public ↔ private)
- Remove members (warning shown if outstanding balance exists)
- Archive group (non-Trip groups only)
- Delete the group

### All members (including admin)
- Add expenses
- Edit expense description and category on any expense they're a participant of (always allowed)
- Edit expense financial structure (split method, distribution, participants) only if they are the payer or admin; amount locked once any payment is recorded
- Invite new members by typing their email directly, or by sharing the group invite link
- Mute/unmute notifications for this specific group
- Change group background photo
- Change their own display name in this group (via tapping their avatar in the member list)
- Cannot remove other members
- Can leave the group voluntarily at any time

### Group settings screen
Accessed via gear icon (⚙️) in the top-right corner of the fixed group header. Opens a bottom sheet with two sections:

**All members:**
- **Members ([count])** — tapping opens the Members Screen (see below)
- Mute / Unmute notifications for this group
- Change background photo
- Share invite link (native share sheet)
- Leave group

**Admin only:**
- Change group name
- Extend / change end date (Trip only)
- Change settlement visibility (Public ↔ Private)
- Reset invite link (invalidates old link, generates a new one)
- Archive group (non-Trip groups only)
- Delete group (requires double confirmation if unsettled balances exist — must tap a second "Yes, delete" button; warning clearly states all history will be permanently erased)

### Members Screen
Accessible from two entry points: the "Members ([count])" row in group settings, and the "+X more" button on the group header avatar row. Full-screen view pushed onto the nav stack.

Contents:
- **Add member** button + **Invite via link** button at the top
- Full list of all group members — avatar, display name, email, balance in this group, admin badge
- Tapping a member opens their Member Profile Sheet
- Admin sees a **Remove** option on each member row (except their own)
- Members see their own row but cannot remove themselves from here (use "Leave group" in settings instead)

### Expired / Archived groups
- Floating "Add Expense" button remains visible but is disabled
- Tapping it shows a toast: "This trip has ended. Extend the trip in settings to add new expenses."
- All other views (expense list, balances, summary, settle up) remain fully accessible

The admin is visible to all group members.

### Admin transfer
If the admin leaves the group, the role automatically transfers to whoever joined the group first after the original creator. If the admin is the last member and leaves, the group is deleted.

### Last member leaving
If the user is the only remaining member and tries to leave, a prompt is shown: "You're the last member. Leaving will permanently delete this group and all its history." with "Delete group" and "Cancel" buttons. Confirming deletes the group immediately.

### Leaving with outstanding balance
If a member with an outstanding balance tries to leave (or is removed by admin), a warning is shown: "This person has an outstanding balance of X." The departure can still proceed — balances and expense history remain intact after they leave.

---

## 11. Expense System

### Add Expense form fields
- **Title** — short name for the expense (e.g. "Dinner at Konoba"). Max 60 characters — live counter appears at 45/60. Auto-focused when the form opens — keyboard appears immediately, cursor lands in this field.
- **Description** — optional, appears below the title. Max 500 characters. Live character counter appears at 450/500. Placeholder text: "Add more details about this expense…" — disappears on first keystroke. Helps members remember context when settling up later.
- **Date** — defaults to today, tappable to change. Past and today allowed; future dates are blocked. Expense list sorts by this date, not entry date.
- **Amount** — numeric, with currency selector (USD / EUR / DKK / SEK). Defaults to the user's preferred currency from Account settings. Live conversion shown below the field as you type (e.g. "≈ 375 DKK") based on today's cached exchange rates. Minimum: 0.01. Maximum: 999 999.99. Decimal-pad keyboard.
- **Category** — see full list in §12. Defaults to "Other." Auto-detected from the title field using a client-side keyword map (case-insensitive, partial match). A subtle "suggested" badge on the category field shows it was auto-detected. Auto-detection stops if the user manually selects a category.

  **Auto-detection keyword map:**
  | Keywords | Category |
  |---|---|
  | taxi, uber, lyft, bolt, cab | Taxi |
  | hotel, hostel, airbnb, accommodation, motel | Hotel |
  | flight, plane, airline, airport | Plane |
  | bus, tram, train, metro, subway | Bus/Train |
  | gas, fuel, petrol, diesel | Gas/Fuel |
  | parking | Parking |
  | dinner, lunch, breakfast, restaurant, cafe, bar, bistro, konoba, taverna | Dining Out |
  | grocery, groceries, supermarket, market, lidl, spar, kaufland | Groceries |
  | beer, wine, spirits, drinks, liquor, alcohol, cocktail | Liquor |
  | ticket, cinema, movie, concert, game, museum | Movies / Games |
  | rent | Rent |
  | electricity, electric, power bill | Electricity |
  | phone, internet, wifi | Phone/Internet |
  | insurance | Insurance |
  | gift, present | Gift |
  | medicine, pharmacy, doctor, hospital | Medical Expenses |
- **Receipt image** — optional, attach from camera or photo storage. Compressed to max 1MB before upload via Expo ImageManipulator. Stored in Supabase Storage. Removable at any time via ✕ button when editing. On Expense Detail Screen: shown as thumbnail, tap to view full screen with pinch-to-zoom.
- **Paid by** — defaults to "You", can select any group member. Any participant can log an expense on behalf of another payer — whoever has the phone can record it. The payer is automatically pre-selected as a participant in the split. In Unequal and Percentage modes, the payer's checkbox is locked — they cannot be removed from the split because their field holds the auto-calculated remainder. In Equal mode, the payer can be manually deselected.
- **Split method selector** — choose first: Equal · Unequal · Percentage. Switching modes clears previously entered amounts and recalculates from scratch.
- **Participant list** — shown below the split method. All group members pre-selected by default with checkboxes. "Select All" button at the top as a quick shortcut. Members shown with avatar and name. No search bar — list is always fully visible. Order: you first, then all others alphabetically by display name.
  - **Equally** — amount divided evenly among checked members
  - **Unequally** — each participant gets an amount field. The **payer's field holds the Remainder by default** — it starts at the full expense total and decreases automatically as you enter amounts for others. The payer's field is editable; if they enter a specific amount, the split must still sum to the full expense total. Save is always enabled as long as no individual share is negative. If the expense total changes after amounts are entered, all other participants' amounts are preserved and the payer's remainder recalculates automatically.
  - **By percentage** — same Remainder model: the payer's percentage starts at 100% and decreases as you assign percentages to others. The payer's percentage field is editable; the split must always sum to 100%. Save is always enabled as long as no individual percentage is negative.

### Cancelling the expense form
If the user taps the back/close button and the form has any data entered, show a confirmation dialog: "Discard this expense?" with "Discard" and "Keep editing" buttons. If the form is completely untouched, close silently with no prompt.

### Expense rules
- Non-participants (members not included in the split) do not see the expense
- Expenses can be **deleted only if zero Settlements** have been recorded against them. Any participant in the expense (or the group admin) can delete it.
- **Anyone in the split** can edit the expense description and category at any time.
- **Payer or group admin only** can edit the financial structure — amount (if no Settlements recorded), split method, split distribution, and participant list. When the split structure is edited, all balances recalculate automatically. If someone overpaid due to an edit, the difference shows as a debt owed back to them.
- Expense **total amount is locked** once any Settlement is recorded; split structure remains editable by payer/admin even after Settlements.
- Edited expenses show a small **"edited" badge** on the expense card so members know the expense changed
- Settled expenses remain visible to participants but are **visually dimmed** — reduced opacity and muted text/icon. Same card layout, just quieter. Unsettled expenses appear at full opacity above them.

### Settlement Correction
A member can undo and re-record their own payments only. They cannot touch payment records made by other members.

---

## 12. Expense Categories

General: Games, Movies, Music, Sports, Other

Food & Drink: Dining Out, Groceries, Liquor

Home: Furniture, Household Supplies, Mortgage, Pets, Rent, Services, Cleaning, Electricity, Heat, Trash, TV, Phone/Internet, Water

Life: Child Care, Clothing, Education, Gift, Insurance, Medical Expenses, Taxes

Transport: Bicycle, Bus/Train, Car, Gas/Fuel, Hotel, Parking, Plane, Taxi

Electronics: Other Electronics

---

## 13. Group Detail Page

**Fixed Header (always visible regardless of active tab):**
- Group title
- Background — defaults to a unique gradient per group type (loads instantly, no network request):
  - Trip → deep blue to teal
  - Home → warm amber to orange
  - Couple → rose to purple
  - Utilities → slate to indigo
  - Family → green to emerald
  - Other → neutral grey to charcoal
- Admin can replace gradient with a custom photo from their camera roll at any time (stored in Supabase Storage). Custom photo fully replaces the gradient.
- Dark overlay applied to all backgrounds so title and info text remain readable
- Date range (Trip only)
- Member count
- Up to 5 member avatars in a horizontal row, same priority order as group cards: (1) you, (2) admin (if not you), (3) your friends by join order, (4) non-friends by join order. Tapping any avatar opens their Member Profile Sheet. "+X more" button opens the Members Screen.

**In-page tabs (below the fixed header): Expenses · Balances · Summary**

### Tab 1 — Expenses
- Flat list, most recent first (by expense date, not entry date)
- Quick filter chips above the list: **All · Unsettled · Mine · I paid**
- Each expense card shows: description, category icon, amount in original currency, who paid, date, "edited" badge if applicable
- New expenses added by other members appear via a subtle slide-in animation at the top of the list (Supabase Realtime)
- Muted groups show a small bell-with-slash icon on the group card in the Groups list
- Tapping an expense opens a full **Expense Detail Screen** showing: description, amount in original currency, category, who paid, full split breakdown per person, receipt image (if attached), and a **settlement status per participant** — derived from each person's group balance (e.g. "Luka — Settled ✓", "Ana — Unsettled", "Marko — Partially settled"). Not a per-expense payment log — settlement is tracked at the group level. Pencil icon in the top-right opens the pre-filled expense form for editing. Delete option also available (subject to deletion rules in §11).

### Tab 2 — Balances
- Updates in real time via Supabase Realtime — balances recalculate live when any expense or payment changes
- Shows the simplified debt list (public or private, per group setting)
- "You are owed €X" or "You owe €X to [person]"
- Only members with non-zero balances shown
- Each balance row has its own **"Settle Up" button** — tapping it opens the settlement window for that person. The button should be visually polished: pill-shaped, accent color (`#00C896`), with the person's name or amount visible on the row to give context. The row itself should feel premium — avatar, name, balance amount, and the Settle Up button all in a well-spaced card layout.
- **Settlement window:**
  - Opens settlement window
  - Amount shown in group base currency with currency toggle (display only — any of the 4 currencies)
  - Enter amount (full or partial); full Settlement clears Balance, partial reduces it
  - Works in both directions (you owe / you are owed)
  - **Either party can record the Settlement** — the creditor can record an incoming Settlement on behalf of the debtor (e.g. Luka hands you cash, you record it yourself). The debtor can also initiate from their own device.
  - On success: green "Settlement recorded" toast at the bottom, auto-dismisses. No separate confirmation screen. Balances tab updates in real time.

### Tab 3 — Summary
- Total group spending (in base currency)
- Per-person contribution — how much each member paid out of pocket
- Category breakdown chart — spending split by category (e.g. 40% dining, 35% transport, 25% hotel)

> **⚠️ Chart library decision pending review:** Default choice is **Victory Native XL** (Expo-compatible, built on React Native Skia, actively maintained). Before building this tab, evaluate **Gifted Charts** and any other options available at that time — try a quick prototype of each and pick the one that looks best and integrates most smoothly. If working autonomously, proceed with Victory Native XL and leave a comment in the code noting alternatives were not evaluated.

---

## 14. Navigation (Bottom Tabs)

| Tab | Content |
|---|---|
| Groups | List of all active groups. Floating "Add Expense" button always visible. "+" icon in top-right header opens group creation flow. |
| Friends | Friends list. Add by email (unidirectional — no approval needed). |
| Activity | Personal activity feed (see §15). Shows a dot badge when there is new unread activity — clears when the tab is opened. |
| Account | Profile (Gmail photo + email), notification toggles |

**Floating "Add Expense" button behavior:**
- Visible on Groups tab and inside group detail screens only — not on Friends, Activity, or Account tabs
- Visible from Groups tab (not inside a group) → bottom sheet slides up with a compact list of active groups (name + type badge + your balance); tap one to open the expense form for that group. If no active groups exist, the sheet shows an empty state: "No active groups. Create a group to start adding expenses." with a "Create a group" button.
- Visible from inside a group → goes directly to expense form for that group
- Visible but disabled inside expired/archived groups → toast message explains why and points to settings

### Group Card (each item in the Groups list)
- Background thumbnail — small version of the group's background image with dark overlay
- Group name — prominent, overlaid on the image. Wraps to 2 lines max on the card, then truncates with ellipsis. Full name shown in group detail header and settings.
- Group type badge — small label (Trip / Home / Couple / etc.)
- Your balance — "You owe €23" in red, "You're owed €47" in green, "Settled" in grey. Updates in real time via Supabase Realtime.
- Member avatars — up to 4 small overlapping circles, priority order: (1) you, (2) admin (if not you), (3) your friends by join order, (4) non-friends by join order. "+X" label if more members exist beyond the 4 shown.
- Date range — Trip groups only, shown small
- Muted bell icon — if group is muted
- Pin icon — if group is pinned to top

### Groups Tab — Sorting & Filtering

**Sort order:** Most recently active first (last expense added, payment recorded, or member joined). Users can manually **pin** any group to the top — pinned groups always appear above the rest regardless of activity. Multiple pinned groups are ordered by pin time (first pinned = top).

**Pinning & muting a group:**
- **⋯ icon** on every group card — always visible, opens context menu
- **Long press** on the card — same context menu (power user shortcut)
- Context menu options: Pin to top / Unpin (toggle) + Mute / Unmute (toggle)
- Pinned cards show a small pin icon. Muted cards show a bell-with-slash icon.

**Filters:** Filter icon in the top-right opens a bottom sheet. Multiple filters can be combined. Active filters appear as removable chips below the search bar.

| Filter category | Options |
|---|---|
| Status | Active, Archived |
| Group type | Trip, Home, Couple, Utilities, Family, Other |
| Balance | You owe money, You are owed money, Fully settled |
| Time (Trip only) | Upcoming, Ongoing, Past |

### Friends Tab — Filtering

Same filter pattern (bottom sheet, chips). Filters apply to the **Friends** section only: Friends who owe you, Friends you owe, Fully settled. The **Pending** section is always visible regardless of active filters — pending contacts have no balance data and are not affected by financial filters.

---

## 15. Activity Feed

Personal feed showing actions across all groups (including archived). Loads 10 items on open, 10 more per scroll — infinite scroll, unlimited history.

Each entry shows:
- Icon (action type)
- Group name
- Action description (added expense, settled up, joined group, recorded payment, etc.)
- Date and time
- Amount (where applicable)

### Filtering
Filter icon in the top-right header opens a bottom sheet with a single filter: **Group** — pick one group to show only its activity. "All groups" is the default. Active filter appears as a removable chip below the header. Same bottom sheet + chip pattern as the Groups tab.

---

## 16. Friends System

- Add friends by email — explicit and unidirectional, no approval needed. The person who adds sees the other in their Friends tab; the other does not automatically see them back.
- Sharing a Group does NOT create a Friendship. Members must explicitly add each other via the "Add Friend" button on the Member Profile Sheet.
- Friends tab is a shortcut for quickly adding known people to future groups without searching by email

### Friends Tab — Adding a Friend
"+" icon in the top-right header opens a small sheet with an email input field and an Add button. Friend is added immediately (unidirectional, no approval). If the email isn't registered yet, they appear as a pending contact until they sign up.

### Friends Tab
**Search bar** — persistent, always visible at the top of the tab. Searches by name or email across both Friends and Pending sections. Results update as you type.

Two sections below the search bar: **Friends** (registered users) and **Pending** (added by email, not yet registered). Pending contacts show the email address, a "Pending" badge, and a ⋯ menu with a "Remove" option. Removing a pending contact only severs the friend connection — any placeholder expenses already assigned to them remain intact. When they register with that email, they automatically move to the Friends section with no action required.

Each active friend card shows:
- Profile photo and name
- Total balance summary across all shared groups ("Owes you €47 across 2 groups" / "You owe them €12" / "All settled")

Tapping a friend opens a **Friend Detail Screen** showing:
- Their photo and name
- ⋯ menu in the top-right → "Remove friend" option. Removes them from your friends list only (unidirectional — does not affect shared groups, expense history, or their own friends list).
- Total balance across all shared groups
- List of shared groups with balance per group
- **Add to Group** shortcut — opens a group picker bottom sheet listing active groups. Tap one to send them an invite to that group (same flow as adding by email from within the group).
- **Settle Up** button (shown only if a non-zero Balance exists)
- **Add Expense** button — opens a group picker bottom sheet first (same active groups list). After picking a group, the expense form opens pre-filled with you and this friend as participants. The selected group name is displayed prominently in the form header so it's clear which group the expense belongs to. "Paid by" defaults to "You" — changeable with one tap.

### Member Profile Sheet (inside a group)
Tapping any member's avatar opens a bottom sheet showing:
- Their name and profile photo
- Their current balance in this group ("Owes you €23" / "You owe them €15" / "Settled")
- **Settle Up with [name]** button — only shown if a non-zero Balance exists between you and this Member. Jumps directly into the settlement flow for this person.
- **Add Friend** button — only shown if they are not already in your friends list

---

## 17. Push Notifications

Managed via Expo Notifications. Notification icons/logos are customized to match the app design. Android supports full icon + color customization; iOS uses the app icon.

### Default ON
- Trip group has expired (trip is over)

### Default OFF — togglable in Account tab
- Someone joins your group
- Someone added to a group you're in
- Member removed from a group you're in
- Trip end date approaching (fires 3 days before the end date)
- Trip ends today (fires on the end date itself)
- New expense added to your group
- Expense edited in your group
- Expense deleted from your group
- Someone records a payment to you
- Someone records a payment in your group
- Your balance in a group reaches zero

---

## 18. Account Tab

- Profile photo — tap to change (camera or photo library). Custom photo overrides Gmail photo permanently. Compressed to 1MB, stored in Supabase Storage.
- Email address
- **Account display name** — editable field, overrides Gmail name everywhere in the app
- **Preferred currency** — which of the 4 currencies (USD, EUR, DKK, SEK) to show as the live conversion default throughout the app
- Notification preference toggles (see §17)
- **Sign out** button
- **Delete account** button (triggers the two-step deletion flow — see §22)
- App version number (small, bottom of screen)
- Privacy Policy link → `even-steven.vercel.app/privacy`
- Terms of Service link → `even-steven.vercel.app/terms`

## 19. Display Names

Three-level priority chain (highest wins):

| Level | Where set | Scope |
|---|---|---|
| Group display name | Tap your own avatar in the group member list → bottom sheet | That group only |
| Account display name | Account tab | All groups (unless overridden at group level) |
| Gmail name | Pulled from Google account, not editable | Fallback if no display name set |

All expense splits, balance screens, and member lists show the highest-priority name available for each person.

---

## 20. Group Archival (Non-Trip groups)

Home, Couple, Utilities, Family, and Other groups have no end date and no automatic expiry. The admin manually archives the group via a "Archive Group" option in group settings. On archive:
- A confirmation prompt is shown: "This will archive the group. All history is preserved."
- Group moves to the Archived tab
- Can be unarchived by the admin at any time

---

## 21. Theming

- App follows the device system setting — dark mode or light mode automatically
- Built with NativeWind `dark:` variant classes — no manual toggle in the app
- Both themes are designed and maintained as first-class experiences

---

## 22. Account Deletion

Two-step deletion to balance GDPR compliance with group financial integrity:

1. **Personal data anonymised** — name becomes "Deleted User", profile photo removed, email wiped. Expense records (amounts, splits, payment history) remain intact for other members.
2. **Removed from all groups** — if outstanding balances exist, a warning is shown before deletion: "You have unsettled balances in X groups. Other members will still see them."
3. **Account data fully deleted** — Gmail connection, display name, notification settings, friends list all permanently removed.

---

## 23. Group Member Limit

No maximum. In practice groups will rarely exceed 20 members, but no artificial cap is imposed. Member pickers and unequal split screens include a search bar to stay usable at any size.

---

## 24. Rounding Rule

When splitting equally results in a repeating decimal (e.g. €10 ÷ 3 = €3.333...), all shares are rounded down to 2 decimal places. The payer silently absorbs the remainder. No UI indication — the difference is always sub-cent and negligible.

---

## 25. Archived Groups

Archived groups are not shown in the main Groups list by default. To access them, open the filter sheet on the Groups tab and select **Status: Archived**. Archived groups are fully viewable — expense list, summary, balances, and settle-up all remain accessible. No new expenses can be added. Admin can unarchive at any time from group settings.

---

## 26. Visual Identity

**Design direction:** Revolut-inspired — minimal, dark-leaning, high contrast, premium fintech feel.

| Element | Value |
|---|---|
| Dark mode background | `#0b0b0b` (near-black, slightly warm) |
| Light mode background | `#f8f8f8` (off-white) |
| Dark mode surface (cards) | `#1a1a1a` |
| Light mode surface (cards) | `#ffffff` |
| Primary accent | `#00C896` (emerald-teal — signals money, fairness, distinctive) |
| Borders | 1px, very low opacity white (dark) / black (light) |
| Depth | No drop shadows — depth via surface color shifts |
| Display font | **Space Grotesk** (free, geometric, premium feel — Expo Google Fonts) |
| Body font | **Inter** (free, same font Revolut uses — Expo Google Fonts) |
| Buttons | Pill-shaped (fully rounded) |
| Cards | `border-radius: 16–20px` |
| Spacing base unit | 4px grid |
| Gradients | Used on key UI elements (group headers, balance cards) |

**Implementation:** NativeWind with custom Tailwind color tokens and Expo Google Fonts (Inter + Space Grotesk). Both dark and light themes are first-class using NativeWind `dark:` variants.

---

## 27. Empty States

Each screen with no content shows a centered illustration + short message instead of a blank screen. Consistent visual pattern throughout the app.

| Screen | Message | Action button |
|---|---|---|
| Groups tab (no groups) | "No groups yet" | "Create a group" + "Join with a link" |
| Friends tab (no friends) | "No friends yet" | "Add a friend" |
| Activity tab (no activity) | "No activity yet. Start by creating a group." | — |
| Group expense list (no expenses) | "No expenses yet. Add the first one!" | — |
| Group balances tab (all settled) | "You're all even! Nothing to settle." | — |
| Search / filter (no results) | "No groups match your search" | — |

---

## 28. Removed From Group State

If a user tries to open a group they've been removed from (via stale notification, old deep link, etc.): full-screen message "You're no longer a member of this group." with a "Back to Groups" button. No group data is shown. Auto-navigates to Groups tab after 3 seconds if the button isn't tapped.

If a user taps a deep link to a group that has been deleted: full-screen message "This group no longer exists." with a "Back to Groups" button. Same auto-navigate behavior.

---

## 29. Error Handling & Offline States

**Saving fails (expense, payment, edit):** Red toast at the bottom — "Couldn't save. Check your connection and try again." Form stays open with data intact. No auto-retry.

**Loading fails (group list, expense list):** "Something went wrong" message with a "Try again" button replacing the content area. Not a full-screen takeover.

**App opens with no connection:** Shows last data from Supabase local cache with a small banner: "You're offline — showing last known data." Write actions disabled until connection returns.

**Expense edited while viewing:** If a user is on the Expense Detail Screen when another member edits that expense, the data refreshes automatically via Realtime and a brief toast appears: "This expense was just edited by [name]." No manual refresh needed.

---

## 30. Sign Out Behaviour

On sign out: Supabase auth session is cleared and all locally cached data (groups, expenses, exchange rates) is wiped from the device. No data visible after sign out. Next login fetches fresh data from Supabase.

---

## 31. Cold Start Behaviour

App always opens to the Groups tab on cold start regardless of where the user last was. Navigation state is not persisted across sessions.

**Loading states:** All data-fetching screens use skeleton screens — placeholder cards shaped like real content with a shimmer animation — while Supabase data is loading. No spinners. Applies to: Groups list, Friends list, Activity feed, Group expense list, Balances tab, Summary tab.

---

## 32. Splash Screen

Static Expo splash screen — app icon centered on the primary accent color (`#00C896`). Configured in `app.json`. Shown by the OS while the app initialises. No custom animation in v1.

---

## 33. Haptic Feedback

Implemented via `expo-haptics`. Minimal — only on meaningful financial actions and destructive operations. Never on navigation, scrolling, or passive interactions.

| Action | Haptic type | Reason |
|---|---|---|
| Expense saved successfully | `impactAsync(Medium)` | Confirms real financial action landed |
| Payment recorded / settled up | `impactAsync(Medium)` | Same — money moved |
| Expense deleted | `notificationAsync(Warning)` | Destructive action — warning vibration |
| Group deleted | `notificationAsync(Warning)` | Destructive action |
| Long press to pin a group | `impactAsync(Light)` | Confirms pin registered |
| Toggle switch (mute, settlement visibility) | `selectionAsync()` | Light click on state change |

---

## 34. App Updates

**Over-the-air (OTA) updates:** Minor JS/UI fixes are pushed via `expo-updates` without requiring an App Store submission. Users get fixes automatically on next app launch.

**Forced update screen:** When the app detects it's running below the minimum required version (stored as a config value in Supabase), a full-screen block appears: "A new version of Even Steven is available. Update to continue." with a button that opens the App Store. The app is unusable until updated. Only triggered for breaking changes — not routine releases.

---

## 35. App Store Metadata

- **Name:** Even Steven
- **Subtitle / Tagline:** "Fair splits for every trip." (28 characters)
- **Support email:** hello@evenSteven.app
- **Invite email sender:** noreply@resend.dev (or custom domain later)
- **Invite link base URL:** `even-steven.vercel.app/invite/{token}`
- **Terms of Service:** `even-steven.vercel.app/terms`
- **Privacy Policy:** `even-steven.vercel.app/privacy`
- **Hosting:** Vercel free tier

---

## 36. App Icon

Placeholder: "ES" initials in Space Grotesk Bold, white text on `#00C896` teal background. Works at all sizes from notification icon to App Store listing. To be replaced with a professionally designed icon before public launch.

---

## 37. Push Notification Deep Links

Tapping a notification opens the most relevant screen directly:

| Notification | Destination |
|---|---|
| Trip expired | Group detail screen |
| Trip end date approaching | Group detail screen |
| Trip ends today | Group detail screen |
| Someone joins your group | Group detail screen → Members Screen |
| Someone added to a group you're in | Group detail screen → Members Screen |
| Member removed from a group you're in | Group detail screen → Members Screen |
| New expense added | Group detail screen → Expenses tab → that expense |
| Expense edited | Group detail screen → Expenses tab → that expense |
| Expense deleted | Group detail screen → Expenses tab |
| Someone pays you | Group detail screen → Balances tab |
| Payment recorded in your group | Group detail screen → Balances tab |
| Balance reaches zero | Group detail screen → Balances tab |

---

## 38. Device Permissions

All permissions requested at the moment of need — never on first launch.

| Permission | Trigger | Reason string shown to user |
|---|---|---|
| Camera | First tap of receipt image button on expense form | "Even Steven uses your camera to attach receipt photos to expenses." |
| Photo library | First tap of receipt image button (choose from storage) | "Even Steven needs photo library access to attach receipt images to expenses." |
| Push notifications | After user creates or joins their first group | "Get notified when group members add expenses or settle up." |

---

## 39. Number Formatting

Fixed format for all currencies, all users, all locales:
- Period as decimal separator
- Space as thousands separator (European/Scandinavian standard)
- Currency symbol or code as appropriate

Examples: `$45.00` · `€50.00` · `1 234.56 DKK` · `1 234.56 SEK`

Currency display rules:
- USD: `$` symbol before amount
- EUR: `€` symbol before amount
- DKK: code after amount (`1 234.56 DKK`)
- SEK: code after amount (`1 234.56 SEK`)

---

## 40. App Icon Badge

Shows unread notification count. Increments when a new push notification is received. Clears when the app is opened. Standard iOS/Android behaviour via Expo Notifications.

---

## 41. Language

English only for v1. Localization (Croatian, Danish, Swedish) deferred to a future version if adoption warrants it.

---

## Open Questions (not yet decided)

- **Personal expense tracking (future):** Allow a Member to log an Expense where they are the only Participant — no one owes anyone anything. Useful for tracking personal spending alongside shared group expenses in the Summary tab. Deferred to a future version; not in v1.
- ~~Offline behavior~~ — **online only**. App requires internet connection to add or edit anything. Clear error message shown when offline.
- ~~Group list sorting~~ — **most recently active first, user-controlled pinning, filters via bottom sheet**
- ~~Search~~ — **Groups tab: search by group name. Friends tab: search by name or email. No global search.**
- ~~Display name~~ — **two-level name system. See §19.**
- ~~Placeholder members~~ — **stay indefinitely. Admin can remove manually. No auto-expiry.**
