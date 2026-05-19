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

---

## 3. Authentication

- Sign in with Google (Gmail) only — no email/password
- Profile photo pulled from Gmail account automatically
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

---

## 5. Debt Model

**Net balance with debt simplification (Splitwise model).**

The app tracks a running net balance per person across all expenses in a group, then computes the minimum number of transactions needed to settle everything. Example: if B owes you €20 from dinner but you owe B €15 from the taxi, the app shows "B owes you €5" — one transaction, not two.

### Real-time sync
When any member adds an expense, all other group members see it instantly via Supabase Realtime. No refresh needed.

### Expense visibility
If an expense only includes 3 out of 4 group members, the 4th member does not see that expense at all — it does not exist for them.

---

## 6. Group Types

| Type | Dates | Lifecycle |
|---|---|---|
| Trip | Mandatory start + end date | Expires on end date (see §8) |
| Home | None | Indefinite |
| Couple | None | Indefinite |
| Utilities | None | Indefinite |
| Family | None | Indefinite |
| Other | None | Indefinite |

---

## 7. Group Creation Flow

1. Choose group type
2. Enter group name
3. **If Trip**: pick start date and end date; pick base currency
4. **All other types**: pick base currency only
5. Add members — two methods:
   - Type their email directly
   - Share invite link (native share sheet: WhatsApp, Instagram, Messenger, Discord, Messages, Email, etc.)
6. Group is created and visible to all members immediately

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

- Invite link opens the app directly if installed → user is prompted to register/join
- If the app is not installed → invitee becomes a **placeholder member** (stored by email)
- Expenses can be assigned to placeholder members before they register
- When they install the app and sign up with the same Gmail → account activates and all history syncs retroactively

---

## 10. Permissions

### Admin (group creator)
- Change group name
- Extend or change end date
- Remove members
- Delete the group

### All members (including admin)
- Add expenses
- Edit any expense (description, category — amount locked once any payment is recorded)
- Cannot remove other members
- Can leave the group voluntarily at any time

The admin is visible to all group members.

### Admin transfer
If the admin leaves the group, the role automatically transfers to whoever joined the group first after the original creator. If the admin is the last member and leaves, the group is deleted.

### Leaving with outstanding balance
If a member with an outstanding balance tries to leave (or is removed by admin), a warning is shown: "This person has an outstanding balance of X." The departure can still proceed — balances and expense history remain intact after they leave.

---

## 11. Expense System

### Add Expense form fields
- **Description** — free text
- **Amount** — numeric, with currency selector (USD / EUR / DKK / SEK)
- **Category** — see full list in §12
- **Receipt image** — optional photo attach
- **Paid by** — defaults to "You", can select any group member
- **Split options:**
  - **Equally** — divided evenly among selected members
  - **Unequally** — each selected member shown with name + avatar + amount field
  - **By percentage** — each selected member assigned a percentage

### Expense rules
- Non-participants (members not included in the split) do not see the expense
- Expenses can be **deleted only if zero payments** have been recorded against them
- Expense **amount is locked** once any payment is recorded; description and category remain editable
- Settled expenses remain visible to participants but are **visually distinguished** (different card color)

### Resettlement
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

**Header:**
- Group title
- Background image (type-based or custom)
- Date range (Trip only)
- Member count

**Balance overview:**
- "You are owed €X" or "You owe €X to [person]"
- Only shows members with non-zero balances — zero-balance members are hidden from this view

**Settle Up button:**
- Opens settlement window
- Enter amount being sent (full or partial)
- Record payment
- Full payment → clears balance
- Partial payment → shows remaining balance
- Works in both directions (you owe / you are owed)

---

## 14. Navigation (Bottom Tabs)

| Tab | Content |
|---|---|
| Groups | List of all active groups. Floating "Add Expense" button always visible. |
| Friends | Friends list. Add by email (unidirectional — no approval needed). |
| Activity | Personal activity feed (see §15) |
| Account | Profile (Gmail photo + email), notification toggles |

**Floating "Add Expense" button behavior:**
- Visible from Groups tab (not inside a group) → first step is group picker
- Visible from inside a group → goes directly to expense form for that group

---

## 15. Activity Feed

Each entry shows:
- Icon (action type)
- Group name
- Action description (added expense, settled up, joined group, recorded payment, etc.)
- Date and time
- Amount (where applicable)

---

## 16. Friends System

- Add friends by email — unidirectional, no approval needed
- Friends from groups: once two users share a group they appear in each other's friends list
- Friends tab is a shortcut for quickly adding known people to future groups without searching by email

---

## 17. Push Notifications

Managed via Expo Notifications. Notification icons/logos are customized to match the app design. Android supports full icon + color customization; iOS uses the app icon.

### Default ON
- Trip group has expired (trip is over)

### Default OFF — togglable in Account tab
- Someone joins your group
- Someone added to a group you're in
- Member removed from a group you're in
- Trip end date approaching
- New expense added to your group
- Expense edited in your group
- Expense deleted from your group
- Someone records a payment to you
- Someone records a payment in your group
- Your balance in a group reaches zero

---

## 18. Account Tab

- Profile photo (from Gmail)
- Email address
- Notification preference toggles (see §17)
- (Future: currency preference, theme, etc.)

---

## Open Questions (not yet decided)

- Group header background image — auto-generated by group type or user-uploaded?
- Non-Trip group manual archival — does the admin get a "Close Group" button?
- Onboarding flow — what does a brand new user see before they have any groups?
- App icon and visual identity / color palette
