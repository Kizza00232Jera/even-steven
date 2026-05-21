import { fetchGroupSummary } from '../summary';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';

// ---------------------------------------------------------------------------
// Mock client builder
// ---------------------------------------------------------------------------

function makeClient({
  group = { base_currency: 'EUR' as 'EUR' | 'USD' | 'DKK' | 'SEK' },
  expenses = [] as Array<{ payer_id: string; amount: number; currency: string; category: string }>,
  members = [] as Array<{ id: string; display_name: string | null; profiles: unknown }>,
  groupError = null as unknown,
  expensesError = null as unknown,
  membersError = null as unknown,
} = {}) {
  const groupSingle = jest.fn().mockResolvedValue({ data: group, error: groupError });
  const groupEq = jest.fn().mockReturnValue({ single: groupSingle });
  const groupSelect = jest.fn().mockReturnValue({ eq: groupEq });

  const expensesEq = jest.fn().mockResolvedValue({ data: expenses, error: expensesError });
  const expensesSelect = jest.fn().mockReturnValue({ eq: expensesEq });

  const membersEqStatus = jest.fn().mockResolvedValue({ data: members, error: membersError });
  const membersEqGroup = jest.fn().mockReturnValue({ eq: membersEqStatus });
  const membersSelect = jest.fn().mockReturnValue({ eq: membersEqGroup });

  const from = jest.fn((table: string) => {
    if (table === 'groups') return { select: groupSelect };
    if (table === 'expenses') return { select: expensesSelect };
    if (table === 'group_members') return { select: membersSelect };
    throw new Error(`unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchGroupSummary', () => {
  it('returns zero totalSpending when there are no expenses', async () => {
    const client = makeClient({ expenses: [] });
    const result = await fetchGroupSummary(client, 'g-1');
    expect(result.totalSpending).toBe(0);
  });

  it('sums all expense amounts for totalSpending', async () => {
    const client = makeClient({
      expenses: [
        { payer_id: 'm-alice', amount: 30, currency: 'EUR', category: 'Dining Out' },
        { payer_id: 'm-bob', amount: 20, currency: 'EUR', category: 'Hotel' },
      ],
    });
    const result = await fetchGroupSummary(client, 'g-1');
    expect(result.totalSpending).toBe(50);
  });

  it('returns the group base currency', async () => {
    const client = makeClient({ group: { base_currency: 'SEK' as const } });
    const result = await fetchGroupSummary(client, 'g-1');
    expect(result.currency).toBe('SEK');
  });

  it('computes per-member payer contributions grouped by payer', async () => {
    const client = makeClient({
      expenses: [
        { payer_id: 'm-alice', amount: 30, currency: 'EUR', category: 'Dining Out' },
        { payer_id: 'm-alice', amount: 20, currency: 'EUR', category: 'Hotel' },
        { payer_id: 'm-bob', amount: 10, currency: 'EUR', category: 'Taxi' },
      ],
      members: [
        { id: 'm-alice', display_name: 'Alice', profiles: null },
        { id: 'm-bob', display_name: 'Bob', profiles: null },
      ],
    });
    const result = await fetchGroupSummary(client, 'g-1');
    const alice = result.memberContributions.find((c) => c.memberId === 'm-alice');
    const bob = result.memberContributions.find((c) => c.memberId === 'm-bob');
    expect(alice?.amount).toBe(50);
    expect(bob?.amount).toBe(10);
  });

  it('resolves member name from display_name', async () => {
    const client = makeClient({
      expenses: [{ payer_id: 'm-alice', amount: 10, currency: 'EUR', category: 'Other' }],
      members: [{ id: 'm-alice', display_name: 'Alice', profiles: null }],
    });
    const result = await fetchGroupSummary(client, 'g-1');
    expect(result.memberContributions[0].name).toBe('Alice');
  });

  it('falls back to profile display_name when member display_name is null', async () => {
    const client = makeClient({
      expenses: [{ payer_id: 'm-alice', amount: 10, currency: 'EUR', category: 'Other' }],
      members: [{ id: 'm-alice', display_name: null, profiles: { display_name: 'Alice Profile', avatar_url: null, google_avatar_url: null } }],
    });
    const result = await fetchGroupSummary(client, 'g-1');
    expect(result.memberContributions[0].name).toBe('Alice Profile');
  });

  it('sorts member contributions descending by amount', async () => {
    const client = makeClient({
      expenses: [
        { payer_id: 'm-bob', amount: 10, currency: 'EUR', category: 'Other' },
        { payer_id: 'm-alice', amount: 50, currency: 'EUR', category: 'Other' },
      ],
      members: [
        { id: 'm-alice', display_name: 'Alice', profiles: null },
        { id: 'm-bob', display_name: 'Bob', profiles: null },
      ],
    });
    const result = await fetchGroupSummary(client, 'g-1');
    expect(result.memberContributions[0].memberId).toBe('m-alice');
    expect(result.memberContributions[1].memberId).toBe('m-bob');
  });

  it('computes category breakdown with amounts grouped by category', async () => {
    const client = makeClient({
      expenses: [
        { payer_id: 'm-alice', amount: 40, currency: 'EUR', category: 'Dining Out' },
        { payer_id: 'm-alice', amount: 20, currency: 'EUR', category: 'Dining Out' },
        { payer_id: 'm-bob', amount: 40, currency: 'EUR', category: 'Hotel' },
      ],
    });
    const result = await fetchGroupSummary(client, 'g-1');
    const dining = result.categoryBreakdown.find((c) => c.category === 'Dining Out');
    const hotel = result.categoryBreakdown.find((c) => c.category === 'Hotel');
    expect(dining?.amount).toBe(60);
    expect(hotel?.amount).toBe(40);
  });

  it('computes category percentages that sum to 100', async () => {
    const client = makeClient({
      expenses: [
        { payer_id: 'm-alice', amount: 40, currency: 'EUR', category: 'Dining Out' },
        { payer_id: 'm-alice', amount: 35, currency: 'EUR', category: 'Hotel' },
        { payer_id: 'm-bob', amount: 25, currency: 'EUR', category: 'Taxi' },
      ],
    });
    const result = await fetchGroupSummary(client, 'g-1');
    const total = result.categoryBreakdown.reduce((sum, c) => sum + c.percentage, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it('returns zero percentages when there are no expenses', async () => {
    const client = makeClient({ expenses: [] });
    const result = await fetchGroupSummary(client, 'g-1');
    expect(result.categoryBreakdown).toHaveLength(0);
  });

  it('sorts category breakdown descending by amount', async () => {
    const client = makeClient({
      expenses: [
        { payer_id: 'm-alice', amount: 10, currency: 'EUR', category: 'Taxi' },
        { payer_id: 'm-alice', amount: 50, currency: 'EUR', category: 'Dining Out' },
        { payer_id: 'm-alice', amount: 30, currency: 'EUR', category: 'Hotel' },
      ],
    });
    const result = await fetchGroupSummary(client, 'g-1');
    expect(result.categoryBreakdown[0].category).toBe('Dining Out');
    expect(result.categoryBreakdown[1].category).toBe('Hotel');
    expect(result.categoryBreakdown[2].category).toBe('Taxi');
  });

  it('throws when the groups query fails', async () => {
    const client = makeClient({ groupError: { message: 'DB error' } });
    await expect(fetchGroupSummary(client, 'g-1')).rejects.toMatchObject({ message: 'DB error' });
  });

  it('throws when the expenses query fails', async () => {
    const client = makeClient({ expensesError: { message: 'DB error' } });
    await expect(fetchGroupSummary(client, 'g-1')).rejects.toMatchObject({ message: 'DB error' });
  });
});
