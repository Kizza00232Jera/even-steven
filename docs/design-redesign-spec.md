# Even Steven — UI Redesign Spec

All decisions in this document have been agreed with the product owner.
Do NOT deviate from these decisions. Do NOT ask questions — implement exactly what is specified.

---

## Design Direction

**Target aesthetic: Revolut-quality fintech.**
Bold typography, warm dark surfaces, premium feel, tight intentional layout.
Every screen must feel like a financial product people trust — not a notes app.

---

## 1. Color System

Update `constants/colors.ts` and `global.css`.

### Dark mode
| Token | Old | New |
|---|---|---|
| `background` | `#0b0b0b` | `#0f0e0d` |
| `surface` | `#1a1a1a` | `#1c1a18` |
| `surface-2` | `#242424` | `#262320` |
| `border` | `rgba(255,255,255,0.08)` | unchanged |

### Light mode
| Token | Old | New |
|---|---|---|
| `background` | `#f8f8f8` | `#f5f3f0` |
| `surface` | `#ffffff` | unchanged |
| `surface-2` | `#f2f2f2` | `#ededeb` |

All other tokens (`accent`, `destructive`, `warning`, text tokens) remain unchanged.

---

## 2. Groups Tab (`app/(tabs)/groups/index.tsx`)

### Remove
- Search bar — remove entirely
- Filter icon — remove entirely

### Header
- Title "Groups" stays (large, left-aligned, Space Grotesk bold)
- Below the title: one line summary — `"Overall, you are owed €X"` or `"Overall, you owe €X"` or `"You're all settled"` — Inter body-md, accent/destructive/text-secondary color respectively. This is the net balance across all active groups.
- Top-right: replace the bare `+` circle button with a small pill button labelled `+ New Group` — `surface-2` background, `text-primary` text, `border` border, `rounded-full`, height 36px, horizontal padding 16px.

### Group Cards (complete redesign)
Current: dark rectangle with thin colored top stripe, name, type badge, balance, small avatars bottom-right.

New: contact-list style card.

```
┌─────────────────────────────────────────────┐
│  [A][J][+1]   Juju                          │
│  (avatars)    Couple                        │
│               You owe €15.85               │
└─────────────────────────────────────────────┘
```

Specs:
- Card background: `surface`, border: 1px `border`, `rounded-2xl`, padding: 16px, no gradient
- **Left**: Avatar stack — up to 3 member avatars (40px circles, -10px overlap, `zIndex` descending). If more than 3 members, show `+N` circle in `surface-2` with `text-secondary`. Avatars use member `avatar_url` or `google_avatar_url` if set, else initials fallback (first letter, `accent-dim` background, white text, Space Grotesk 500).
- **Right** (flex-1, marginLeft 12px):
  - Line 1: Group name — Space Grotesk 600, 16px, `text-primary`
  - Line 2: Group type — Inter 400, 13px, `text-secondary`
  - Line 3: Balance — Inter 500, 14px — `accent` if positive ("You're owed €X"), `destructive` if negative ("You owe €X"), `text-secondary` if zero ("Settled")
- Minimum card height: 72px
- Gap between cards: 10px
- Horizontal padding: 16px

### FAB
- Round 56px circle, `accent` background, white `+` icon (Lucide `Plus`, 24px, strokeWidth 2.5)
- Position: bottom-right, `bottom: tabBarHeight + 16`, `right: 16`
- No text label

---

## 3. Group Detail Header (`app/(tabs)/groups/[id]/index.tsx`)

Current: gradient/photo background 200px, group name bottom-left, settings icon top-right. Large empty space.

New: same gradient/photo background, but fill the empty space.

```
← Back                          share  ⚙
                                [A][J] 2 members
Group Name
You owe €15.84
```

Specs:
- Bottom-right of header: member avatar stack (32px circles, -6px overlap, max 3) + member count label ("2 members", Inter 12px, white/70%)
- Below group name: your balance in this group — Inter 500, 14px, white (on the gradient background, so always white regardless of positive/negative — add a subtle tint: accent for positive, destructive for negative, but keep white as base). Format: "You owe €15.84" or "You're owed €X" or "Settled" if zero.
- Group name stays Space Grotesk 700, 24px, white, bottom-left

---

## 4. Expense Cards (`app/(tabs)/groups/[id]/index.tsx` — Expenses tab)

Current: title top-left, amount top-right, "Category · Payer paid · Date" grey line.

New layout:
```
┌──────────────────────────────────────────────┐
│ [icon]  Dinner at Konoba         €55.00      │
│         Julia · May 25          You borrowed │
│                                    €27.50    │
└──────────────────────────────────────────────┘
```

Specs:
- **Left**: Category icon circle — 36px circle, category background color at 15% opacity, category icon (Lucide, 18px) in full category color. Category colors defined in `constants/categories.ts`.
- **Center** (flex-1, marginLeft 12px):
  - Line 1: Expense title — Space Grotesk 600, 15px, `text-primary`
  - Line 2: `{PayerDisplayName} · {Date}` — Inter 400, 13px, `text-secondary`. Date format: "May 25" (no year unless prior year). Payer name = display name, NEVER email.
- **Right** (right-aligned):
  - Line 1: Total amount — Space Grotesk 600, 15px, `text-primary`
  - Line 2: Your share — Inter 500, 12px. "You paid €X" in `accent`, "You borrowed €X" in `destructive`, nothing if you're not a participant.

### Display name resolution (global rule)
Use `resolveDisplayName(profile)` from `lib/displayName.ts`. If a member has no display name set, fall back to their Google name. NEVER show a raw email address anywhere in the app except the Friends tab.

### Date formatting helper
Create or update a helper `formatExpenseDate(dateString: string): string` in `lib/dateUtils.ts`:
- Today → "Today"
- Yesterday → "Yesterday"  
- This year → "May 25"
- Prior year → "May 25, 2025"

---

## 5. Balances Tab (`app/(tabs)/groups/[id]/balances.tsx`)

### Summary header (add at top)
Surface card (`surface` bg, `border` border, `rounded-2xl`, padding 20px) — NO gradient.

Content:
- Large amount: Space Grotesk 700, 32px, `accent` if positive / `destructive` if negative / `text-secondary` if zero
- Label below: Inter 400, 14px, `text-secondary` — "you are owed total" / "you owe total" / "you're all even"

### Empty state
When all balances are zero, replace the list with:
- Centered in content area
- Checkmark circle icon (Lucide `CheckCircle2`, 48px, `accent`)
- "You're all even!" — Space Grotesk 600, 20px, `text-primary`
- "No outstanding balances in this group." — Inter 400, 14px, `text-secondary`

### Balance rows
Keep existing layout (avatar left, name + balance center, Settle Up button right). No changes to row structure.

---

## 6. Activity Tab (`app/(tabs)/activity/index.tsx`)

### Date group headers
Group events by date. Show a section header above each group:
- Same day as today → "Today"
- One day ago → "Yesterday"
- Older → "May 25" format (use `formatExpenseDate`)

Header style: Inter 500, 12px, `text-tertiary`, uppercase, letter-spacing 0.5px, 8px top padding, 4px bottom padding, 16px horizontal padding.

### Event-specific icons
Replace the generic `$` circle with event-type icons. Each icon sits in a 40px circle with `surface-2` background:

| Event type | Icon (Lucide) | Icon color |
|---|---|---|
| `expense_added` | `Receipt` | `accent` |
| `expense_edited` | `Pencil` | `warning` |
| `expense_deleted` | `Trash2` | `destructive` |
| `settlement_recorded` | `ArrowLeftRight` | `accent` |
| `settlement_undone` | `RotateCcw` | `warning` |
| `member_joined` | `UserPlus` | `accent` |
| `member_added` | `UserPlus` | `accent` |
| `member_removed` | `UserMinus` | `destructive` |
| `group_created` | `Users` | `accent` |
| `group_archived` | `Archive` | `text-secondary` |
| default | `CircleDot` | `text-secondary` |

### Event text
Keep existing text format. Ensure display names, not emails, in event descriptions.

---

## 7. Add Expense — Group Picker

### Replace native Alert with bottom sheet
When the FAB is tapped from the Groups tab (or Add Expense is tapped from Friend detail), instead of `Alert.alert("Add expense in which group?", ...)`, show a bottom sheet modal.

Bottom sheet specs:
- `surface` background, `rounded-t-3xl`, drag handle at top
- Title: "Add expense to..." — Space Grotesk 600, 18px, `text-primary`, 20px padding
- List of active groups the user is a member of:
  - Each row: avatar stack (32px, max 2 shown) + group name (Inter 500, 15px) + type badge (`label-sm`, `surface-2`, `rounded-full`) — same contact-list pattern as Groups tab but compact
  - Row height: 60px, 16px horizontal padding, `border-b border-border`
- Cancel row at bottom: "Cancel" centered, Inter 500, 15px, `destructive`

---

## 8. Add Expense Form — Amount Field

File: `app/(tabs)/groups/[id]/add-expense.tsx`

### Amount field redesign
The amount is the hero of the form. Move it to the top of the form, full-width, centered.

```
        EUR ▾
      0.00
  ≈ 0.00 DKK (live conversion)
```

Specs:
- Currency pill: `surface-2` background, `rounded-full`, Inter 500, 14px, `text-primary`, centered above the amount, tappable to change currency
- Amount: Space Grotesk 700, 48px, `text-primary`, center-aligned, tappable (opens numeric keyboard)
- Placeholder: "0.00" in `text-tertiary`
- Live conversion: Inter 400, 13px, `text-secondary`, centered below, appears as user types
- Divider below amount section: 1px `border`
- Remaining form fields (title, date, category, paid by, receipt, split) scroll below

---

## 9. Friends Tab (`app/(tabs)/friends/index.tsx`)

### Friend list rows
Add net balance to each friend row:

```
[Avatar]  Toni                    You owe €15.85
          antoniojerkovic91@...   (destructive)
```

Specs:
- Friend row: avatar (40px) left, display name (Inter 500, 15px, `text-primary`) + email (Inter 400, 12px, `text-secondary`) center, net balance right (Inter 500, 14px, `accent`/`destructive`/hidden if zero)
- This is the ONE place where email is shown alongside display name

### Friend detail page (`app/friends/[id]/index.tsx`)
- Show display name as title, email as subtitle — this is correct, keep it
- "You owe" / "You're owed" badge: use `destructive-dim`/`accent-dim` backgrounds with correct text colors (not just a red pill)

### Group picker for "Add Expense" from Friend detail
Same bottom sheet pattern as §7 above. Replace the `Alert.alert("Add expense in which group?")` native dialog.

---

## 10. Account Tab (`app/(tabs)/account/index.tsx`)

### Notification toggles — show ONLY these three:
1. `new_expense` — "New expense"
2. `payment_received` — "Payment received"
3. `trip_ends_today` — "Trip ends today"

Remove all other toggles from the UI. The DB preferences for hidden toggles remain untouched — just don't render them.

---

## 11. Global: Display Names (all screens)

**Rule**: Never show a raw email address as a person's name anywhere in the app, except in the Friends tab (§9).

Screens to audit and fix:
- Expense cards: payer name
- Expense detail: payer name, participant names
- Balances tab: member names in balance rows
- Settle Up sheet: member name
- Activity feed: actor names in event text
- Group members screen: member names
- Add Expense form: "Paid by" dropdown options, participant list

**Resolution order** (highest priority first):
1. Group display name (if set for this group)
2. Account display name
3. Google name (`user_metadata.full_name`)
4. Email (last resort — only acceptable in Friends tab)

Use the existing `resolveDisplayName` / `resolveAvatarUrl` helpers in `lib/displayName.ts`. Extend them if needed.

---

## 12. Build Order & Status

Implement in this order. Update status as each task completes. After compaction, read this file and resume from the first ⬜ task.

| # | Task | Files | Status |
|---|------|-------|--------|
| 1 | Color tokens | `constants/colors.ts`, `global.css` | ✅ Done |
| 2 | Date formatting helper | `lib/dateUtils.ts` | ✅ Done |
| 3 | Display name audit — fix emails globally | All screens | ✅ Done |
| 4 | Groups tab redesign | `app/(tabs)/groups/index.tsx` | ✅ Done |
| 5 | Group detail header | `app/(tabs)/groups/[id]/index.tsx` | ✅ Done |
| 6 | Expense cards | `app/(tabs)/groups/[id]/index.tsx` | ✅ Done |
| 7 | Balances tab | `app/(tabs)/groups/[id]/balances.tsx` | ✅ Done |
| 8 | Activity tab | `app/(tabs)/activity/index.tsx` | ✅ Done |
| 9 | Add Expense group picker bottom sheet | `app/(tabs)/groups/index.tsx`, `app/friends/[id]/index.tsx` | ✅ Done |
| 10 | Add Expense form — amount hero | `app/(tabs)/groups/[id]/add-expense.tsx` | ✅ Done |
| 11 | Friends tab | `app/(tabs)/friends/index.tsx`, `app/friends/[id]/index.tsx` | ✅ Done |
| 12 | Account tab | `app/(tabs)/account/index.tsx` | ✅ Done |

**After all 12 done:** commit everything on one branch, push, OTA to preview.

### Status legend
- ⬜ Todo
- 🔨 In progress
- ✅ Done
