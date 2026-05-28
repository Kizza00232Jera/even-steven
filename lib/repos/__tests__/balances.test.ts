import { fetchGroupBalances } from '../balances';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';

// ---------------------------------------------------------------------------
// Mock client builder
// ---------------------------------------------------------------------------

type MockMember = {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  balance: number;
  profiles: unknown;
};

function makeClient({
  group = { base_currency: 'EUR' as string },
  members = [] as MockMember[],
  membersError = null as unknown,
  groupError = null as unknown,
} = {}) {
  // group_members chain: .select().eq('group_id').eq('status')
  const membersEqStatus = jest.fn().mockResolvedValue({ data: members, error: membersError });
  const membersEqGroup = jest.fn().mockReturnValue({ eq: membersEqStatus });
  const membersSelect = jest.fn().mockReturnValue({ eq: membersEqGroup });

  // groups chain: .select().eq().single()
  const groupSingle = jest.fn().mockResolvedValue({ data: group, error: groupError });
  const groupEq = jest.fn().mockReturnValue({ single: groupSingle });
  const groupSelect = jest.fn().mockReturnValue({ eq: groupEq });

  const from = jest.fn((table: string) => {
    if (table === 'group_members') return { select: membersSelect };
    if (table === 'groups') return { select: groupSelect };
    throw new Error(`unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient<Database>;
}

const alice: MockMember = {
  id: 'm-alice', user_id: 'u-alice', email: 'alice@x.com', display_name: 'Alice',
  balance: 0, profiles: null,
};
const bob: MockMember = {
  id: 'm-bob', user_id: 'u-bob', email: 'bob@x.com', display_name: 'Bob',
  balance: 0, profiles: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchGroupBalances', () => {
  it('returns balances read directly from group_members', async () => {
    const client = makeClient({
      members: [
        { ...alice, balance: 50 },
        { ...bob, balance: -50 },
      ],
    });
    const result = await fetchGroupBalances(client, 'g-1');
    expect(result.members.find((m) => m.memberId === 'm-alice')?.balance).toBe(50);
    expect(result.members.find((m) => m.memberId === 'm-bob')?.balance).toBe(-50);
  });

  it('returns zero balances when stored balance is 0', async () => {
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

  it('returns the correct groupId', async () => {
    const client = makeClient();
    const result = await fetchGroupBalances(client, 'g-42');
    expect(result.groupId).toBe('g-42');
  });

  it('resolves member name from display_name', async () => {
    const client = makeClient({ members: [alice] });
    const result = await fetchGroupBalances(client, 'g-1');
    expect(result.members[0].name).toBe('Alice');
  });

  it('falls back to email when display_name is null and no profile', async () => {
    const client = makeClient({
      members: [{ ...alice, display_name: null, profiles: null }],
    });
    const result = await fetchGroupBalances(client, 'g-1');
    expect(result.members[0].name).toBe('alice@x.com');
  });

  it('throws when members query fails', async () => {
    const client = makeClient({ membersError: { message: 'Members error' } });
    await expect(fetchGroupBalances(client, 'g-1')).rejects.toMatchObject({ message: 'Members error' });
  });

  it('throws when groups query fails', async () => {
    const client = makeClient({ groupError: { message: 'Group error' } });
    await expect(fetchGroupBalances(client, 'g-1')).rejects.toMatchObject({ message: 'Group error' });
  });

  it('returns an empty members array when no active members', async () => {
    const client = makeClient({ members: [] });
    const result = await fetchGroupBalances(client, 'g-1');
    expect(result.members).toHaveLength(0);
  });
});
