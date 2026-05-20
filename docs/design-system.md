# Even Steven — Design System

> Read this before building any screen or component. Every visual decision should be answerable from this document. If something is not covered, default to the Revolut aesthetic: minimal, high contrast, purposeful.

---

## Design Direction

**Revolut-inspired fintech.** Minimal, dark-leaning, high contrast, premium feel. Every screen should feel like a financial product people trust with their money — not a notes app with a balance sheet bolted on.

Key principles:
- **Restraint over decoration.** If an element doesn't carry meaning, remove it.
- **Dark-first.** Design dark mode first; light mode is a first-class adaptation, not an afterthought.
- **Depth without shadows.** Hierarchy is communicated through surface color shifts, not drop shadows. No `shadow-*` utilities anywhere.
- **Motion is meaningful.** Animations confirm actions and guide attention — never decorative.
- **Numbers are the hero.** Financial figures should be the most legible thing on any screen.

---

## Color System

### Base Palette

| Token | Dark | Light | Usage |
|---|---|---|---|
| `background` | `#0b0b0b` | `#f8f8f8` | Screen backgrounds |
| `surface` | `#1a1a1a` | `#ffffff` | Cards, sheets, elevated containers |
| `surface-2` | `#242424` | `#f2f2f2` | Nested surfaces, input backgrounds |
| `border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | All borders — always 1px |
| `accent` | `#00C896` | `#00C896` | Primary actions, positive amounts, CTAs |
| `accent-dim` | `rgba(0,200,150,0.15)` | `rgba(0,200,150,0.12)` | Accent backgrounds, tinted surfaces |
| `text-primary` | `#ffffff` | `#0b0b0b` | Headings, prominent values |
| `text-secondary` | `rgba(255,255,255,0.55)` | `rgba(0,0,0,0.45)` | Labels, metadata, supporting text |
| `text-tertiary` | `rgba(255,255,255,0.30)` | `rgba(0,0,0,0.25)` | Placeholders, disabled text |
| `destructive` | `#FF4444` | `#E53535` | Destructive actions, negative amounts |
| `destructive-dim` | `rgba(255,68,68,0.15)` | `rgba(229,53,53,0.10)` | Destructive backgrounds |
| `warning` | `#F59E0B` | `#D97706` | Warnings, pending states |
| `success` | `#00C896` | `#00C896` | Use accent for success — they are the same |

### Semantic Color Rules

- **Positive Balance / money owed to you:** `accent` (`#00C896`)
- **Negative Balance / money you owe:** `destructive` (`#FF4444`)
- **Settled / zero balance:** `text-secondary`
- **Pending / invited member:** `warning`
- **Disabled state:** `text-tertiary` on `surface-2`, 40% opacity on the element

### NativeWind Implementation

Always use `dark:` variants. Never use conditional JS for theme switching.

**Token setup — CSS variables (NativeWind v4):**

Define color tokens as CSS variables in a global stylesheet. NativeWind v4 picks these up and swaps them via the `dark` class — no conditional JS needed.

```css
/* global.css */
:root {
  --color-background: #f8f8f8;
  --color-surface: #ffffff;
  --color-surface-2: #f2f2f2;
  --color-text-primary: #0b0b0b;
  --color-text-secondary: rgba(0,0,0,0.45);
  --color-text-tertiary: rgba(0,0,0,0.25);
  --color-border: rgba(0,0,0,0.08);
}
.dark {
  --color-background: #0b0b0b;
  --color-surface: #1a1a1a;
  --color-surface-2: #242424;
  --color-text-primary: #ffffff;
  --color-text-secondary: rgba(255,255,255,0.55);
  --color-text-tertiary: rgba(255,255,255,0.30);
  --color-border: rgba(255,255,255,0.08);
}
```

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      background:        'var(--color-background)',
      surface:           'var(--color-surface)',
      'surface-2':       'var(--color-surface-2)',
      'text-primary':    'var(--color-text-primary)',
      'text-secondary':  'var(--color-text-secondary)',
      'text-tertiary':   'var(--color-text-tertiary)',
      border:            'var(--color-border)',
      accent:            '#00C896',
      'accent-dim':      'rgba(0,200,150,0.15)',
      destructive:       '#FF4444',
      'destructive-dim': 'rgba(255,68,68,0.15)',
      warning:           '#F59E0B',
    }
  }
}
```

Write `bg-background`, `text-primary`, `border-border` everywhere. Never hardcode hex values in component files.

---

## Typography

**Display font:** Space Grotesk (headings, large numbers, group names)
**Body font:** Inter (all other text — labels, descriptions, metadata)

Both loaded via `@expo-google-fonts`.

### Type Scale

| Name | Font | Size | Weight | Line Height | Usage |
|---|---|---|---|---|---|
| `display-xl` | Space Grotesk | 32px | 700 | 38px | Balance amounts on cards |
| `display-lg` | Space Grotesk | 24px | 700 | 30px | Screen titles, group names |
| `display-md` | Space Grotesk | 20px | 600 | 26px | Section headers, amounts |
| `display-sm` | Space Grotesk | 17px | 600 | 22px | Card titles, names |
| `body-lg` | Inter | 16px | 400 | 24px | Primary body text |
| `body-md` | Inter | 14px | 400 | 20px | Secondary body, descriptions |
| `body-sm` | Inter | 13px | 400 | 18px | Metadata, timestamps |
| `label-lg` | Inter | 14px | 500 | 18px | Button labels, tab labels |
| `label-md` | Inter | 13px | 500 | 16px | Chip labels, badges |
| `label-sm` | Inter | 11px | 500 | 14px | Micro labels, counters |
| `mono` | Space Grotesk | 14px | 500 | 20px | Currency amounts inline |

### Typography Rules

- Financial amounts always use Space Grotesk, never Inter.
- Never use font weight below 400.
- Letter spacing: `-0.3px` on display sizes, `0` on body, `+0.3px` on label-sm.
- No text-transform on anything except `label-sm` which uses uppercase for category chips.
- Truncate long names at 2 lines max on cards; single line on list rows with ellipsis.

---

## Spacing

4px base grid. Every spacing value is a multiple of 4.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Icon gaps, micro spacing |
| `space-2` | 8px | Tight internal padding |
| `space-3` | 12px | Component internal padding |
| `space-4` | 16px | Standard padding, list item padding |
| `space-5` | 20px | Section gaps |
| `space-6` | 24px | Card padding |
| `space-8` | 32px | Screen horizontal padding |
| `space-10` | 40px | Large section gaps |
| `space-12` | 48px | Bottom sheet handle area |

**Screen horizontal padding:** 16px on all screens — never let content touch the edge.
**Safe area:** Always respect `SafeAreaView` or `useSafeAreaInsets`. Bottom navigation overlaps content — add padding accordingly.

---

## Border Radius

| Context | Radius | NativeWind |
|---|---|---|
| Cards | 16px | `rounded-2xl` |
| Large cards / group header | 20px | `rounded-[20px]` |
| Buttons (pill) | 9999px | `rounded-full` |
| Input fields | 12px | `rounded-xl` |
| Chips / badges | 9999px | `rounded-full` |
| Bottom sheets | 24px top corners only | `rounded-t-3xl` |
| Avatars | 9999px | `rounded-full` |
| Toasts | 14px | `rounded-[14px]` |
| Modal overlays | 24px | `rounded-3xl` |

---

## Borders

Always `1px`. Always the `border` token (very low opacity). Never colored borders except for focus states.

- **Default border:** `border border-white/8 dark:border-white/8` (dark) / `border-black/8` (light)
- **Focus border (inputs):** `border-accent` — `#00C896` at full opacity
- **No border on buttons** — buttons use background color only
- **Dividers between list items:** use border-bottom on each row, NOT a separate `<View>` divider component

---

## Elevation & Depth

**No drop shadows anywhere.** Depth is communicated entirely through surface color.

| Layer | Background | Usage |
|---|---|---|
| Screen | `background` | The base |
| Card / Sheet | `surface` | Primary elevated containers |
| Nested input / secondary card | `surface-2` | Inputs inside cards, nested items |
| Bottom sheet | `surface` | Same as cards |
| Modal overlay scrim | `rgba(0,0,0,0.7)` | Behind modals and sheets |

A card sitting on `background` feels elevated because `#1a1a1a` > `#0b0b0b`. That contrast IS the shadow.

---

## Gradients

Used on: group header backgrounds, balance indicator cards. Nowhere else.

### Group Type Gradients

Applied as the default background for group headers and group cards. Each is a linear gradient, top-left to bottom-right.

| Type | From | To |
|---|---|---|
| Trip | `#1a3a5c` | `#0d7377` |
| Home | `#7c3500` | `#c84b00` |
| Couple | `#6b1a3a` | `#4a0080` |
| Utilities | `#1e2a4a` | `#2d3a8c` |
| Family | `#0a4a2a` | `#0d7a4a` |
| Other | `#1a1a1a` | `#2d2d2d` |

Always apply a dark overlay on top of gradients: `rgba(0,0,0,0.35)` — this ensures text remains readable regardless of the gradient.

### Balance Card Gradient

Positive balance (owed to you): `#003d2e` → `#005a42` (dark teal)
Negative balance (you owe): `#3d0000` → `#5a0000` (dark red)
Settled: `surface` (no gradient)

---

## Components

### Buttons

All buttons are pill-shaped (`rounded-full`). Three variants:

**Primary (accent)**
- Background: `accent` (`#00C896`)
- Text: `#000000` (black on teal — high contrast)
- Height: 52px
- Horizontal padding: 24px
- Font: `label-lg`, Inter 500
- Pressed state: 85% opacity + scale 0.97

**Secondary**
- Background: `surface-2`
- Text: `text-primary`
- Border: `border` token
- Same sizing as primary
- Pressed state: `surface` background

**Destructive**
- Background: `destructive-dim`
- Text: `destructive`
- Border: `destructive` at 30% opacity
- Same sizing

**Ghost**
- Background: transparent
- Text: `text-secondary`
- No border
- Used for low-emphasis actions like "Cancel", "Skip"

**Disabled state (all variants)**
- Opacity: 40%
- No press feedback

**Loading state (all variants)**
- Replace label with a small `ActivityIndicator` in the button's text color
- Maintain button dimensions — no layout shift

### Cards

**Standard card:**
- Background: `surface`
- Border radius: 16px
- Border: 1px `border` token
- Padding: 16px
- No shadow

**Group card (in Groups list):**
- Background: group gradient thumbnail with dark overlay
- Border radius: 16px
- Minimum height: 100px
- Group name in `display-sm` Space Grotesk white
- Balance in `body-md` Inter — accent if positive, destructive if negative, secondary if settled
- Member avatars overlapping, -8px margin between each
- Type badge: `label-sm` uppercase, `surface` background, `border` border, `rounded-full`, 4px 8px padding

**Expense card (in Expense list):**
- Background: `surface`
- Left edge: 3px colored bar = category color (subtle)
- Category icon: 20px, `text-secondary`
- Title: `display-sm`
- Amount: `display-sm` Space Grotesk, right-aligned
- "Paid by" + date: `body-sm` `text-secondary`
- "edited" badge: `label-sm` `text-tertiary`, italic
- Settled state: entire card at 50% opacity, all text `text-tertiary`

**Balance row card (in Balances tab):**
- Background: `surface`
- Avatar left, name + balance summary center, Settle Up button right
- Settle Up button: accent pill, height 36px, `label-md`
- Amount: `display-sm` Space Grotesk, accent or destructive

### Inputs

- Background: `surface-2`
- Border: 1px `border` token at rest; `accent` on focus
- Border radius: 12px
- Height: 52px (single line), auto (multiline)
- Padding: 14px horizontal, 14px vertical
- Font: `body-lg` Inter
- Placeholder: `text-tertiary`
- Label above input: `label-md` `text-secondary`, 8px gap below
- Character counter: `label-sm` `text-tertiary`, right-aligned below input, appears at threshold (45/60, 450/500)
- Keyboard type matched to input: `decimal-pad` for amounts, `email-address` for emails

**Amount input special treatment:**
- Large: `display-xl` Space Grotesk, center-aligned
- Currency selector: pill button to the right of the field
- Live conversion: `body-sm` `text-secondary` below, appears immediately as user types

### Bottom Sheets

- Background: `surface`
- Top corners: `rounded-t-3xl` (24px)
- Drag handle: 4px × 36px, `border` color, centered, 12px from top
- Content padding: 24px horizontal, 16px top (below handle), safe area bottom
- Scrim: `rgba(0,0,0,0.7)` behind sheet
- Animation: spring — `damping: 20`, `stiffness: 200` (snappy, not bouncy)
- Dismiss: drag down or tap scrim

**Implementation:** `@gorhom/bottom-sheet`. Pass the spring config directly via its `animationConfigs` prop. Use `BottomSheetBackdrop` for the scrim. All bottom sheets in the app use this one library — no custom sheet implementations.

**Confirmation bottom sheets** (destructive actions):
- Destructive button always at bottom
- Ghost "Cancel" button above it
- Clear headline in `display-md`
- Short explanation in `body-md` `text-secondary`

### Toasts

- Position: bottom, 16px above bottom safe area
- Background: `surface-2`
- Border: 1px `border` token
- Border radius: 14px
- Padding: 12px 16px
- Max width: screen width − 32px
- Icon left of text (20px): checkmark for success, X for error, info for neutral
- Text: `body-md` Inter
- Animation: slide up from below + fade in (150ms), auto-dismiss after 3s with fade out (200ms)
- **Success toast:** left border accent color (3px)
- **Error toast:** left border destructive color (3px)

### Skeleton Loaders

No spinners anywhere. All loading states use skeleton shimmer.

- Color: `surface-2` base with shimmer sweep of `rgba(255,255,255,0.06)` (dark) / `rgba(0,0,0,0.04)` (light)
- Animation: shimmer sweeps left to right, 1.2s loop, `easing: linear`
- Shape: match the shape of the real content exactly — same border radius, same dimensions
- Group card skeleton: full card shape with gradient strip at top, two line strips below
- Expense card skeleton: icon circle + two line strips + amount strip right
- Balance row skeleton: avatar circle + two line strips + button strip right

**Implementation:** Build custom with `react-native-reanimated`. A `<Skeleton>` base component drives the shimmer via a shared interpolated `Animated.Value`; wrap any shape with it to produce a correctly-shaped loader without a library dependency.

### Empty States

- Centered vertically and horizontally in the content area
- Illustration: simple geometric SVG, accent color on `surface` background, ~120px
- Headline: `display-sm` Space Grotesk
- Subtext: `body-md` `text-secondary`, max 2 lines, centered
- CTA button(s): primary or secondary pill, 48px height, centered, 12px gap between multiple buttons
- No full-screen takeover — empty state sits within the normal scroll container

### Avatars

- Shape: circle (`rounded-full`)
- Sizes: 24px (micro), 32px (list), 40px (card), 52px (profile), 72px (detail screen)
- Fallback: initials (first letter of display name), Space Grotesk 500, white text, `accent-dim` background
- Overlapping stack (group header, card): -8px `marginLeft` on all but first, `zIndex` descending
- Online/active indicator: not used in this app

### Badges

| Type | Background | Text | Border |
|---|---|---|---|
| Group type (Trip etc.) | `surface-2` | `text-secondary` | `border` |
| Admin | `accent-dim` | `accent` | none |
| Pending | `warning` at 15% opacity | `warning` | none |
| Edited | transparent | `text-tertiary` | none |
| Suggested (category) | `accent-dim` | `accent` | none |
| Unread dot (Activity tab) | `accent` | — | none |

All badges: `rounded-full`, `label-sm`, 4px 8px padding.

### Filter Chips

- Row: horizontal `ScrollView`, no scrollbar, 16px left padding, 8px gap between chips
- Inactive chip: `surface-2` background, `text-secondary` text, `border` border, `rounded-full`
- Active chip: `accent` background, black text, no border
- Height: 32px, horizontal padding 12px
- Font: `label-md`
- Active filters below search bar show a removable chip with × icon

### Tab Bars (in-page, not navigation)

Used inside Group Detail (Expenses / Balances / Summary).

- Background: `background` (not surface — blends with screen)
- Indicator: 2px bottom border in `accent`, animates with spring between tabs
- Active tab text: `text-primary` `label-lg`
- Inactive tab text: `text-tertiary` `label-lg`
- Height: 44px
- Full width, tabs equally spaced

### Navigation Headers

- Background: `background` with blur (`BlurView` on iOS, `background` solid on Android)
- Title: `display-sm` Space Grotesk, centered
- Back button: chevron-left icon, `text-primary`, 44px tap target
- Right actions: icon buttons, 44px tap target, `text-primary`
- Border-bottom: 1px `border` token
- Large title variant (Groups tab): `display-lg` left-aligned, shown when list is at top, collapses to centered `display-sm` on scroll. **Implementation:** use `headerLargeTitle: true` on iOS via Expo Router's `Stack.Screen` options — native and free. On Android, implement a custom animated header; Android has no native large-title equivalent.

---

## Icons

Use **Lucide React Native** exclusively. Consistent stroke-based, clean geometric icons.

| Size | Usage |
|---|---|
| 16px | Inline icons in text, micro badges |
| 20px | List item icons, chip icons |
| 24px | Navigation icons, card action icons |
| 28px | Header actions |
| 32px | Feature icons, empty state accent icons |

Stroke width: `1.5` on all icons — never `2` (too heavy), never `1` (too thin).
Color: inherit from parent text color (`currentColor`) wherever possible.

---

## Motion & Animation

**Philosophy:** motion confirms actions, not decorates them. Every animation should answer "what just happened?" — not "isn't this pretty?"

### Spring Config (default for most animations)
```
damping: 20
stiffness: 200
mass: 1
```
Produces a quick, snappy feel with minimal overshoot. Use for: bottom sheets, modals, chip transitions, tab indicators.

### Transitions
- Screen push/pop: Expo Router default (horizontal slide on iOS, vertical modal on Android)
- Bottom sheet appear: spring up + fade in (150ms fade)
- Toast: slide up 12px + fade in 150ms
- New expense slide-in (Realtime): translate from top 20px + fade in 250ms
- Settled expense dim: opacity 1.0 → 0.5, 300ms ease-out
- Skeleton shimmer: 1.2s linear loop, left-to-right sweep

### What NOT to animate
- List scrolling (never intercept scroll with animation)
- Tab switching (instant, just indicator moves)
- Text changes (balance updates just snap to new value)
- Anything on the critical financial confirmation path — keep it snappy and clear

---

## States

### Loading
Skeleton shimmer. Always. No spinners, no activity indicators on full screens. `ActivityIndicator` only inside buttons during async actions.

### Empty
Centered illustration + headline + subtext + optional CTA. See Empty States section above.

### Error (inline)
`body-md` `text-destructive` below the failing element. For full section failure: "Something went wrong" + "Try again" button, replacing the content area only — never full screen takeover.

### Success
Green toast (`accent` left border), auto-dismisses in 3s. No separate confirmation screen for any action.

### Offline
Small banner at top of screen (below navigation header): `warning` background, `body-sm` black text, "You're offline — showing last known data." All write actions (buttons, form submits) are disabled with 40% opacity.

### Disabled
40% opacity on the element. No other visual change. Never change layout for disabled state.

### Destructive confirmation
Double-confirmation pattern: first tap shows bottom sheet with warning, second tap (explicit "Yes, delete" button) confirms. The confirmation button is always `destructive` variant, never `accent`.

---

## Forms

### Layout
- Full-screen or large bottom sheet, never inline modals
- Fields stack vertically with 16px gaps
- Section dividers: `body-sm` `text-tertiary` uppercase label, 24px top margin, 8px bottom margin
- Keyboard: form scrolls to keep active field visible (`KeyboardAwareScrollView` or equivalent)
- Submit button: sticky at bottom, above keyboard, `SafeAreaView` aware

### Validation
- Validate on blur, not on every keystroke (except live counters)
- Error message: `body-sm` `destructive` below the field, fades in
- Field border: `destructive` on error state
- Never disable the Save button due to incomplete fields unless the spec explicitly requires it (see splits rule: Save always enabled if no negative shares)

### Split Mode Selector
Three segments: Equal · Unequal · Percentage
- Segmented control style: `surface` background, `surface-2` active segment, `rounded-xl` container, `rounded-lg` active indicator
- Switching modes: clears entered amounts with a brief fade (100ms)

---

## Group Type Visual Identity

Each group type has a gradient, an icon, and a color accent used in charts and category highlights.

| Type | Icon (Lucide) | Gradient | Accent |
|---|---|---|---|
| Trip | `Plane` | deep blue → teal | `#0d7377` |
| Home | `Home` | amber → orange | `#c84b00` |
| Couple | `Heart` | rose → purple | `#7c3abd` |
| Utilities | `Zap` | slate → indigo | `#4a5568` → `#2d3a8c` |
| Family | `Users` | green → emerald | `#0d7a4a` |
| Other | `Grid` | neutral → charcoal | `#2d2d2d` |

---

## Expense Category Colors

Used for the 3px left-edge bar on Expense cards and category icons. Define in `constants/categories.ts` alongside the keyword-to-category map.

| Category | Color |
|---|---|
| Dining Out | `#F59E0B` |
| Transport | `#3B82F6` |
| Hotel | `#8B5CF6` |
| Entertainment | `#EC4899` |
| Shopping | `#F97316` |
| Utilities | `#6366F1` |
| Health | `#10B981` |
| Groceries | `#84CC16` |
| Other | `#6B7280` |

---

## Screen-Level Patterns

### Groups Tab
- Large title header, collapses on scroll
- Group cards in a flat `FlatList`, 12px gap, 16px horizontal padding
- Floating Add Expense FAB: bottom-right, 56px diameter, `accent` background, `+` icon in black, spring scale on press. **Positioning:** use `useBottomTabBarHeight()` from React Navigation to get the tab bar height at runtime; set `bottom: tabBarHeight + 16` so the FAB always clears the tab bar on every device. Never use a hardcoded bottom offset.

### Group Detail Header (fixed)
- Full-bleed gradient or photo background, 200px tall
- Dark overlay `rgba(0,0,0,0.35)`
- Group name in `display-lg` white, bottom-left of header
- Avatar row and member count at bottom-right
- Gear icon top-right (white)
- In-page tab bar directly below header, sticky

### Expense Form
- Opens as a modal stack (full screen push on iOS)
- Auto-focus title field on open — keyboard appears immediately
- Amount field: centered, large `display-xl`, currency pill to the right
- Live conversion: `body-sm` `text-secondary` centered below amount, animates in as user types
- "Save" button: sticky at bottom, primary accent, disabled visual when amount is 0

### Balances Tab
- Short summary header: "You owe X" or "You're owed X" in `display-lg` with appropriate color
- List of balance rows below, each a card
- If all settled: empty state illustration, "You're all even!"

### Settle Up Sheet
- Opens as bottom sheet, not full screen
- Amount field pre-filled, editable
- Currency toggle (display only): four small pill buttons in a row
- "Record Settlement" button: primary accent, full width, sticky bottom

---

## DO / DON'T

| DO | DON'T |
|---|---|
| Use surface color shifts for depth | Use drop shadows |
| Pill buttons everywhere | Square or slightly-rounded buttons |
| Space Grotesk for numbers and titles | Inter for financial amounts |
| Skeleton shimmer for loading | Spinners or blank screens |
| Spring animations | Ease-in-out tweens on UI elements |
| `text-secondary` for metadata | Full-opacity grey for secondary text |
| Accent color for primary CTAs only | Accent on decorative elements |
| 44px minimum tap targets | Touch targets smaller than 44px |
| Consistent 16px horizontal screen padding | Inconsistent edge spacing |
| Single toast for success | Modal confirmation dialogs for success |
