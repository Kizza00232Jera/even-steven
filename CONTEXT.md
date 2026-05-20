# Even Steven

A mobile expense-splitting app for groups. Members log shared expenses, and the app calculates the minimum settlements needed for everyone to be square.

## Language

### Groups & Membership

**Group**:
A named container for shared expenses among a set of Members. Has a type (Trip, Home, Couple, Utilities, Family, Other) that determines its lifecycle.

**Member**:
A registered user who belongs to a Group.
_Avoid_: User, person, account

**Participant**:
A Member included in the split of a specific Expense. Every Expense has a subset of the Group's Members as Participants. Non-Participants do not see that Expense.
_Avoid_: Member (when referring to expense-level inclusion)

**Payer**:
The Member who fronted the money for an Expense. Always a Participant. Holds the Remainder by default but their share field is editable.
_Avoid_: Payee, spender

**Admin**:
The Group creator, with elevated permissions (rename, extend dates, remove Members, delete Group). Automatically transferred to the longest-standing non-creator Member if the Admin leaves.

**Group Lifecycle**:
The valid state transitions for a Group. Non-Trip Groups: Active → Archived. Trip Groups: Active → Expired → Archived. Expired is a Trip-only state; no other Group type can be Expired.
_Avoid_: Status, phase

**Invited Member**:
A person added to a Group by email who has not yet registered. Expenses can be assigned to them and they carry a Balance. When they sign up with the same email, they become a full Member with all history intact.
_Avoid_: Placeholder member, pending user

### Identity

**Group Display Name**:
A Member's name as shown within a specific Group. Highest priority in the Display Name chain — overrides all other levels within that Group.
_Avoid_: Group nickname, local name

**Account Display Name**:
A Member's name shown across all Groups unless overridden by a Group Display Name. Set in the Account tab.
_Avoid_: Username, profile name

**Gmail Name**:
The name pulled from the Member's Google account. Read-only — the app never writes to it. Used as a fallback when neither Group Display Name nor Account Display Name is set.
_Avoid_: Google name, real name

### Currency

**Base Currency**:
The currency locked to a Group at creation. All Balances and Settle Up amounts are calculated and displayed in this currency. Cannot be changed after the Group is created.
_Avoid_: Group currency, default currency

**Preferred Currency**:
A Member's personal display preference. Affects expense entry defaults and live conversion display only. Has no effect on Balance calculations.
_Avoid_: User currency, default currency

**Original Currency**:
The currency in which an Expense was logged. Never changes. Always displayed on the Expense alongside the live conversion.
_Avoid_: Expense currency

**Live Conversion**:
A real-time display of an amount in the Member's Preferred Currency, shown alongside the Original Currency. Cosmetic only — not stored, not used in calculations.
_Avoid_: Currency conversion, exchange

### Expenses & Splits

**Expense**:
A purchase shared among a subset of a Group's Members (the Participants). Belongs to exactly one Group.
_Avoid_: Transaction, charge, cost

**Category**:
The type of an Expense, chosen from a fixed list (Dining Out, Taxi, Hotel, etc.). Defaults to "Other." Can be auto-detected from the Expense Title or manually selected.

**Suggested Category**:
A Category auto-detected from keywords in the Expense Title. Shown with a "suggested" badge. Reverts to manual selection if the user overrides it.
_Avoid_: Auto-detected category, auto category

**Expense Date**:
The date the purchase actually happened. Set by the user, displayed on the Expense card, and used to sort the Expense list. Past and today are allowed; future dates are blocked.
_Avoid_: Date, created date

**Entry Date**:
The timestamp when an Expense was logged in the app. Never displayed to the user. Used internally to break ties when two Expenses share the same Expense Date.
_Avoid_: Created at, logged date

**Split**:
How an Expense's amount is divided among its Participants. Three modes: Equal, Unequal, Percentage.

**Remainder**:
The unassigned portion of an Expense's total after all Participants' shares are entered. Auto-assigned to the Payer by default; the Payer's field is editable but the split must always sum to the full Expense amount.
_Avoid_: Leftover, rounding error

### Balances & Settlements

**Debt Simplification**:
The algorithm that computes the minimum number of Settlements needed to bring all Members' Balances to zero. Internal term — not user-facing.
_Avoid_: Net settlement, balance calculation

**Settle Up**:
The user-facing action of recording a Settlement. What the member taps in the UI.
_Avoid_: Pay back, clear debt

**Balance**:
A Member's net financial position within a Group, expressed in the Group's base currency. Positive means the Member is owed money; negative means the Member owes money.
_Avoid_: Outstanding balance, net balance

**Settlement**:
A recorded transaction between two Members that reduces their Balances.
_Avoid_: Payment (when referring to debt clearance between members)

**Settlement Correction**:
A Member undoing and re-recording a Settlement they previously recorded. Members can only correct their own Settlements — not those recorded by other Members.
_Avoid_: Resettlement, undo payment

**Settlement Visibility**:
A Group-level setting controlling who can see Settlements. Public: all Members see all Settlements. Private: a Settlement is invisible to anyone who is not one of the two parties involved — the entire record is hidden, not just the amount.

**Payment**:
The act of a Payer fronting money for an Expense.
_Avoid_: Settlement (when referring to who paid for an expense)

### Summary Tab

**Total Group Spending**:
The sum of all Expenses in a Group, converted to the Base Currency. Shown in the Summary tab.

**Per-Person Contribution**:
How much each Member paid as Payer across all Expenses in a Group — money fronted, not money owed. Distinct from Balance, which reflects net position after splits.
_Avoid_: Per-person share, per-person cost

**Category Breakdown**:
A chart in the Summary tab showing the percentage of Total Group Spending attributable to each Expense Category.

### Friends

**Friendship**:
An explicit, unidirectional connection between two Members. The Member who adds sees the other in their Friends tab; the other does not automatically see them back. Sharing a Group never creates a Friendship — it must always be initiated deliberately.
_Avoid_: Contact, connection

**Pending Contact**:
A person added by email who has not yet registered. Appears in the Friends tab with a Pending badge until they sign up, at which point they move to the Friends section automatically.
_Avoid_: Invited friend, unregistered friend

### Notifications

**Muted Group**:
A Group for which a Member has disabled push notifications. Activity Events for that Group still appear in the Activity Feed — only push notifications are suppressed.
_Avoid_: Silenced group, disabled group

### Activity

**Activity Event**:
A single immutable record in the Activity Feed representing something that happened — an Expense added, a Settlement recorded, a Member joined, etc. Never edited; only accumulated.
_Avoid_: Entry, notification, log item

---

## Example Dialogue

> "So when Ana records that she paid Luka back, what do we call that?"
> "That's a **Settlement** — it reduces both their **Balances**."
> "And when Luka originally paid for dinner?"
> "That makes him the **Payer** of that **Expense**. Different thing entirely."
> "What if we invite someone who isn't on the app yet?"
> "They become an **Invited Member**. We can assign them **Expenses** and they'll have a **Balance** before they even log in."
> "And the bit of the split that goes to whoever paid?"
> "The **Remainder**. Goes to the **Payer** by default, but they can override it — the split just has to sum to the full Expense amount."
> "We're on a trip group. The trip ended — can people still settle up?"
> "Yes. Once the end date passes the group is **Expired** — no new Expenses, but **Settlements** stay open. It only becomes **Archived** once all **Balances** are zero."
> "Ana wants to correct a Settlement she recorded by mistake."
> "That's a **Settlement Correction** — she can only touch her own records."
> "The group has 20 people. I only want 4 of them in my Friends tab."
> "Right — **Friendships** are explicit. Sharing a Group doesn't create one. Tap 'Add Friend' on the four you want to keep."
> "Why does the Expense show €50 and also ≈375 DKK?"
> "€50 is the **Original Currency** — locked forever. The DKK figure is a **Live Conversion** to your **Preferred Currency**. Cosmetic only; all **Balances** run in the group's **Base Currency**."
