import { fetchGroupBalances } from '../balances';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';

// ---------------------------------------------------------------------------
// Mock client builder
// ---------------------------------------------------------------------------

type MockExpense = {
  id: string;
  payer_id: string;
  amount: number;
  base_currency_amount?: number | null;
  expense_participants: Array<{
    member_id: string;
    share_amount: number;
    base_share_amount?: number | null;
  }>;
};

type MockMember = {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  profiles: unknown;
};

type MockSettlement = {
  payer_member_id: string;
  payee_member_id: string;
  amount: number;
};

function makeClient({
  group = { base_currency: 'EUR' as string },
  expenses = [] as MockExpense[],
  members = [] as MockMember[],
  settlements = [] as MockSettlement[],
  membersError = null as unknown,
  expensesError = null as unknown,
  settlementsError = null as unknown,
  groupError = null as unknown,
} = {}) {
  // group_members chain: .select().eq('group_id').eq('status')
  const membersEqStatus = jest.fn().mockResolvedValue({ data: members, error: membersError });
  const membersEqGroup = jest.fn().mockReturnValue({ eq: membersEqStatus });
  const membersSelect = jest.fn().mockReturnValue({ eq: membersEqGroup });

  // expenses chain: .select().eq('group_id')
  const expensesEq = jest.fn().mockResolvedValue({ data: expenses, error: expensesError });
  const expensesSelect = jest.fn().mockReturnValue({ eq: expensesEq });

  // settlements chain: .select().eq('group_id').eq('is_voided')
  const settlementsEqVoided = jest.fn().mockResolvedValue({ data: settlements, error: settlementsError });
  const settlementsEqGroup = jest.fn().mockReturnValue({ eq: settlementsEqVoided });
  const settlementsSelect = jest.fn().mockReturnValue({ eq: settlementsEqGroup });

  // groups chain: .select().eq().single()
  const groupSingle = jest.fn().mockResolvedValue({ data: group, error: groupError });
  const groupEq = jest.fn().mockReturnValue({ single: groupSingle });
  const groupSelect = jest.fn().mockReturnValue({ eq: groupEq });

  const from = jest.fn((table: string) => {
    if (table === 'group_members') return { select: membersSelect };
    if (table === 'expenses') return { select: expensesSelect };
    if (table === 'settlements') return { select: settlementsSelect };
    if (table === 'groups') return { select: groupSelect };
    throw new Error(`unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient<Database>;
}

const alice: MockMember = {
  id: 'm-alice', user_id: 'u-alice', email: 'alice@x.com', display_name: 'Alice', profiles: null,
};
const bob: MockMember = {
  id: 'm-bob', user_id: 'u-bob', email: 'bob@x.com', display_name: 'Bob', profiles: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchGroupBalances', () => {
  it('returns zero balances for all members when there are no expenses', async () => {
    const client = makeClient({ members: [alice, bob] });
    const result = await fetchGroupBalances(client, 'g-1');
    expect(result.members.find((m) => m.memberId === 'm-alice')?.balance).toBe(0);
    expect(result.members.find((m) => m.memberId === 'm-bob')?.balance).toBe(0);
  });

  it('returns the group base currency', async () => {
    const client = makeClient({ group: { base_currency: 'DKK' } });
    const result = await fetchGroupBalances(client, 'g-1');
    expect(result.currency).toBe('DKK');
  });

  it('uses amount when base_currency_amount is null (backward compat)', async () => {
    const client = makeClient({
      members: [alice, bob],
      expenses: [
        {
          id: 'e-1',
          payer_id: 'm-alice',
          amount: 100,
          base_currency_amount: null,
          expense_participants: [
            { member_id: 'm-alice', share_amount: 50, base_share_amount: null },
            { member_id: 'm-bob', share_amount: 50, base_share_amount: null },
          ],
        },
      ],
    });
    const result = await fetchGroupBalances(client, 'g-1');
    // Alice paid 100, owes 50 → net +50
    expect(result.members.find((m) => m.memberId === 'm-alice')?.balance).toBe(50);
    // Bob owes 50 → net -50
    expect(result.members.find((m) => m.memberId === 'm-bob')?.balance).toBe(-50);
  });

  it('uses base_currency_amount when present instead of amount', async () => {
    // EUR expense in a DKK group: amount=52 EUR, base_currency_amount=390 DKK
    const client = makeClient({
      members: [alice, bob],
      group: { base_currency: 'DKK' },
      expenses: [
        {
          id: 'e-1',
          payer_id: 'm-alice',
          amount: 52,
          base_currency_amount: 390,
          expense_participants: [
            { member_id: 'm-alice', share_amount: 26, base_share_amount: 195 },
            { member_id: 'm-bob', share_amount: 26, base_share_amount: 195 },
          ],
        },
      ],
    });
    const result = await fetchGroupBalances(client, 'g-1');
    // Alice is credited 390 DKK, debited 195 DKK → net +195 DKK
    expect(result.members.find((m) => m.memberId === 'm-alice')?.balance).toBe(195);
    // Bob is debited 195 DKK → net -195 DKK
    expect(result.members.find((m) => m.memberId === 'm-bob')?.balance).toBe(-195);
  });

  it('applies settlement adjustments in addition to expense balances', async () => {
    const client = makeClient({
      members: [alice, bob],
      expenses: [
        {
          id: 'e-1',
          payer_id: 'm-alice',
          amount: 100,
          base_currency_amount: null,
          expense_participants: [
            { member_id: 'm-alice', share_amount: 50, base_share_amount: null },
            { member_id: 'm-bob', share_amount: 50, base_share_amount: null },
          ],
        },
      ],
      settlements: [
        { payer_member_id: 'm-bob', payee_member_id: 'm-alice', amount: 50 },
      ],
    });
    const result = await fetchGroupBalances(client, 'g-1');
    expect(result.members.find((m) => m.memberId === 'm-alice')?.balance).toBe(0);
    expect(result.members.find((m) => m.memberId === 'm-bob')?.balance).toBe(0);
  });

  it('throws when expenses query fails', async () => {
    const client = makeClient({ expensesError: { message: 'DB error' } });
    await expect(fetchGroupBalances(client, 'g-1')).rejects.toMatchObject({ message: 'DB error' });
  });

  it('throws when members query fails', async () => {
    const client = makeClient({ membersError: { message: 'Members error' } });
    await expect(fetchGroupBalances(client, 'g-1')).rejects.toMatchObject({ message: 'Members error' });
  });
});
