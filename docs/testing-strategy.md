# Testing Strategy

## Philosophy

Test behavior through public interfaces, not implementation details. A good test survives a complete rewrite of the function body as long as the contract holds. Tests describe WHAT the system does, not HOW.

## Good Tests

**Integration-style**: test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: Tests observable behavior
test("member can record a settlement", async () => {
  const result = await recordSettlement({ from: memberA, to: memberB, amount: 20 });
  expect(result.status).toBe("recorded");
});
```

Characteristics:
- Tests behavior callers care about
- Uses public API only
- Survives internal refactors
- One logical assertion per test

## Bad Tests

```typescript
// BAD: Tests implementation detail
test("recordSettlement calls settlementService.insert", async () => {
  const mock = vi.mock(settlementService);
  await recordSettlement({ from: memberA, to: memberB, amount: 20 });
  expect(mock.insert).toHaveBeenCalledWith({ from: memberA.id, to: memberB.id });
});
```

Red flags:
- Mocking internal collaborators
- Asserting on call counts or call order
- Test breaks on refactor without behavior change
- Test name describes HOW not WHAT

```typescript
// BAD: Bypasses interface to verify
test("expense is saved", async () => {
  await addExpense(expense);
  const row = await db.query("SELECT * FROM expenses WHERE id = ?", [expense.id]);
  expect(row).toBeDefined();
});

// GOOD: Verifies through interface
test("expense is retrievable after adding", async () => {
  const expense = await addExpense({ title: "Dinner", amount: 50 });
  const retrieved = await getExpense(expense.id);
  expect(retrieved.title).toBe("Dinner");
});
```

## When to Mock

Mock at **system boundaries** only:
- External APIs (email, push notifications, exchange rates)
- Databases — **prefer a real test DB over mocking**
- Time / randomness
- File system (sometimes)

Do NOT mock:
- Your own modules or classes
- Internal collaborators
- Anything you control

## Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

**1. Use dependency injection** — pass external dependencies in rather than creating them internally:

```typescript
// Easy to test
function getExpenses(groupId: string, client: SupabaseClient) {
  return client.from("expenses").select("*").eq("group_id", groupId);
}

// Hard to test — client created internally
function getExpenses(groupId: string) {
  return supabase.from("expenses").select("*").eq("group_id", groupId);
}
```

**2. Prefer SDK-style interfaces over generic fetchers** — create specific functions for each external operation instead of one generic function with conditional logic:

```typescript
// GOOD: each function is independently mockable
const expenseRepo = {
  getExpenses:   (groupId, client) => ...,
  addExpense:    (data, client)    => ...,
  deleteExpense: (id, client)      => ...,
};

// BAD: mocking requires conditional logic inside the mock
const repo = {
  query: (table, options, client) => ...,
};
```

The SDK approach means:
- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which operations a test exercises
- Type safety per operation

---

## Supabase Test Project Setup

**When to do this:** Before writing the first Layer 2 test. Not before.

**How to create it (using the Supabase MCP server):**

1. Call `mcp__supabase__create_project` with name `even-steven-test`, same org as production, region `eu-north-1`. Supabase free tier allows 2 projects — this is the second one.
2. Once the project is ready, call `mcp__supabase__get_project` to retrieve its URL and anon key.
3. Add to `.env`:
   ```
   SUPABASE_TEST_URL=https://<test-project-ref>.supabase.co
   SUPABASE_TEST_ANON_KEY=<test-anon-key>
   SUPABASE_TEST_SERVICE_ROLE_KEY=<test-service-role-key>
   ```
4. Apply all existing migrations to the test project via `mcp__supabase__apply_migration` for each migration file in `supabase/migrations/`.
5. From this point on: every migration applied to production is applied to the test project in the same step.

**Vitest environment config:**

```ts
// vitest.config.ts
export default {
  test: {
    globalSetup: './tests/setup/global.ts',  // creates test users once per run
    setupFiles: ['./tests/setup/env.ts'],     // loads SUPABASE_TEST_* vars
  }
}
```

```ts
// tests/setup/global.ts
import { createClient } from '@supabase/supabase-js'

export async function setup() {
  const admin = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  // Create persistent test users — idempotent, safe to re-run
  await admin.auth.admin.createUser({ email: 'test-a@evensteven.test', password: 'test-password', email_confirm: true })
  await admin.auth.admin.createUser({ email: 'test-b@evensteven.test', password: 'test-password', email_confirm: true })
}
```

```ts
// tests/helpers/createTestClient.ts
export async function createTestClient(email: string) {
  const client = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY!)
  await client.auth.signInWithPassword({ email, password: 'test-password' })
  return client
}
```

Every Layer 2 test calls `createTestClient('test-a@evensteven.test')` to get a fully-authenticated client. RLS is exercised on every assertion.

---

## Four Testing Layers (Even Steven)

### Layer 1 — Pure business logic (`lib/`)

- **Tool**: Vitest
- **Mocking**: none — pure functions, zero side effects
- **Modules**: `debt.ts`, `splits.ts`, `currency.ts`, `categories.ts`
- **Approach**: full behavioral coverage through each module's public function signature, TDD red→green→refactor one behavior at a time

### Layer 2 — Repository layer (data access)

- **Tool**: Vitest
- **DB**: dedicated Supabase test project — created automatically via `mcp__supabase__create_project` before the first Layer 2 test run. Store its URL and anon key as `SUPABASE_TEST_URL` and `SUPABASE_TEST_ANON_KEY` in `.env`. All migrations are applied to it via `mcp__supabase__apply_migration` at the same time they are applied to production. Fall back to the production Supabase project only if the test project cannot be created.
- **Auth**: test users are created in a global `vitest.setup.ts` via the service role key — never hardcode JWTs (they expire). A `createTestClient(email, password)` helper signs in and returns an authenticated `SupabaseClient`. RLS policies are exercised on every run because all assertions run through that authenticated client.
- **Isolation**: each test self-seeds exactly the data it needs and cleans up after itself — no shared state, safe to run in parallel
- **Service role**: only used in seed/teardown helpers, never in the assertion path
- **What to test**: actual queries, RLS visibility rules (non-Participant expense invisibility, Private Settlement invisibility), constraint enforcement

### Layer 3 — Components and hooks with logic

- **Tool**: React Native Testing Library (RNTL)
- **Mocking**: repository functions mocked at the boundary — components never import the Supabase client directly
- **What to test**: components with meaningful behavior (expense form split modes, Remainder recalculation, invite acceptance states, balance display)
- **What NOT to test**: purely presentational components (avatars, icons, gradient cards) — no logic, tests would just lock in markup

### Layer 4 — External APIs

- **Tool**: Vitest + HTTP mock
- **Mock**: Frankfurter API, Resend, Expo Push API, Google OAuth
- **Test**: correct response shape handling and graceful error paths

## Architectural Requirement

Components never import the Supabase client directly. A thin repository layer (one module per domain, in `lib/repos/`) accepts the Supabase client as a parameter. This makes the repo layer independently testable and keeps components free of DB concerns.

**Wiring with TanStack Query:** repository functions live in `lib/repos/`. TanStack Query hooks live in `hooks/` and import both the repo function and the singleton `supabase` client from `lib/supabase.ts` — the hook wires the two together. In component tests, the hook's repo dependency is replaced with a fake that returns fixture data directly.

```
lib/repos/expenses.ts        ← accepts SupabaseClient, tested in Layer 2
hooks/useExpenses.ts         ← imports repo fn + supabase singleton, tested in Layer 3 with fake repo
components/ExpenseList.tsx   ← imports hook only, never supabase
```

## What NOT to Test

- Navigation flows — verified on device
- Realtime subscription wiring — verified on device
- Purely presentational components — no logic to assert on
- Supabase client configuration — trust the SDK
