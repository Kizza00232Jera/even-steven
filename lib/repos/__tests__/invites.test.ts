import {
  lookupInviteToken,
  getOrCreateInviteToken,
  resetInviteToken,
  acceptInvite,
  type InviteTokenDetails,
} from '../invites';

// ---------------------------------------------------------------------------
// Helpers to build typed mock Supabase client chains
// ---------------------------------------------------------------------------

function makeRpcMock(returnValue: unknown) {
  return jest.fn().mockResolvedValue({ data: returnValue, error: null });
}

function makeRpcMockError(message: string) {
  return jest.fn().mockResolvedValue({ data: null, error: { message } });
}

function makeSelectChain(rows: unknown[] | null, error: unknown = null) {
  const single = jest.fn().mockResolvedValue({ data: rows?.[0] ?? null, error });
  const limit  = jest.fn().mockReturnValue({ single });
  const eqStatus = jest.fn().mockReturnValue({ limit });
  const eqGroup  = jest.fn().mockReturnValue({ eqStatus, single, limit });
  const isNull   = jest.fn().mockReturnValue({ single });
  const order    = jest.fn().mockReturnValue({ limit, single, eqStatus });
  const select   = jest.fn().mockReturnValue({ eq: eqGroup, order, single, limit, isNull });
  return { select, eqGroup, eqStatus, limit, single };
}

function makeInsertChain(row: unknown, error: unknown = null) {
  const single = jest.fn().mockResolvedValue({ data: row, error });
  const select = jest.fn().mockReturnValue({ single });
  return { insert: jest.fn().mockReturnValue({ select }), select, single };
}

function makeUpdateChain(error: unknown = null) {
  const eqFn = jest.fn().mockResolvedValue({ data: null, error });
  return { update: jest.fn().mockReturnValue({ eq: eqFn }), eq: eqFn };
}

// ---------------------------------------------------------------------------
// lookupInviteToken
// ---------------------------------------------------------------------------

describe('lookupInviteToken', () => {
  it('returns token details for a valid token', async () => {
    const details: InviteTokenDetails = {
      valid: true,
      group_id: 'group-1',
      group_name: 'Weekend Trip',
      group_type: 'Trip',
      start_date: '2026-06-01',
      end_date: '2026-06-07',
      member_count: 4,
      inviter_name: 'Antonio',
    };
    const client = { rpc: makeRpcMock(details) } as unknown as Parameters<typeof lookupInviteToken>[0];
    const result = await lookupInviteToken(client, 'abc123');
    expect(result).toEqual(details);
    expect(client.rpc).toHaveBeenCalledWith('resolve_invite_token', { p_token: 'abc123' });
  });

  it('returns null for an invalidated token', async () => {
    const client = { rpc: makeRpcMock({ valid: false, error: 'invalidated' }) } as unknown as Parameters<typeof lookupInviteToken>[0];
    const result = await lookupInviteToken(client, 'old-token');
    expect(result).toBeNull();
  });

  it('returns null for a token that does not exist', async () => {
    const client = { rpc: makeRpcMock({ valid: false, error: 'not_found' }) } as unknown as Parameters<typeof lookupInviteToken>[0];
    const result = await lookupInviteToken(client, 'nope');
    expect(result).toBeNull();
  });

  it('throws when the RPC call fails', async () => {
    const client = { rpc: makeRpcMockError('network error') } as unknown as Parameters<typeof lookupInviteToken>[0];
    await expect(lookupInviteToken(client, 'tok')).rejects.toMatchObject({ message: 'network error' });
  });
});

// ---------------------------------------------------------------------------
// getOrCreateInviteToken
// ---------------------------------------------------------------------------

describe('getOrCreateInviteToken', () => {
  it('returns the existing active token when one exists', async () => {
    const existing = {
      id: 'tok-id-1',
      group_id: 'group-1',
      token: 'existing-token-value',
      created_by: 'member-1',
      invalidated_at: null,
      created_at: '2026-05-21T00:00:00Z',
    };

    // select chain: .from → .select → .eq(group_id) → .is(invalidated_at, null) → .order → .limit → single
    const single = jest.fn().mockResolvedValue({ data: existing, error: null });
    const limit  = jest.fn().mockReturnValue({ single });
    const order  = jest.fn().mockReturnValue({ limit });
    const isNull = jest.fn().mockReturnValue({ order });
    const eqFn   = jest.fn().mockReturnValue({ is: isNull });
    const select = jest.fn().mockReturnValue({ eq: eqFn });
    const from   = jest.fn().mockReturnValue({ select });

    const client = { from } as unknown as Parameters<typeof getOrCreateInviteToken>[0];
    const token = await getOrCreateInviteToken(client, 'group-1', 'member-1');

    expect(token).toBe('existing-token-value');
    expect(from).toHaveBeenCalledWith('invite_tokens');
  });

  it('creates and returns a new token when none exists', async () => {
    const newRow = {
      id: 'tok-id-2',
      group_id: 'group-1',
      token: 'brand-new-token',
      created_by: 'member-1',
      invalidated_at: null,
      created_at: '2026-05-21T00:00:00Z',
    };

    // select chain returns no existing token
    const single1 = jest.fn().mockResolvedValue({ data: null, error: null });
    const limit   = jest.fn().mockReturnValue({ single: single1 });
    const order   = jest.fn().mockReturnValue({ limit });
    const isNull  = jest.fn().mockReturnValue({ order });
    const eqFn    = jest.fn().mockReturnValue({ is: isNull });
    const select1 = jest.fn().mockReturnValue({ eq: eqFn });

    // insert chain returns new token
    const single2 = jest.fn().mockResolvedValue({ data: newRow, error: null });
    const select2 = jest.fn().mockReturnValue({ single: single2 });
    const insert  = jest.fn().mockReturnValue({ select: select2 });

    const from = jest.fn()
      .mockReturnValueOnce({ select: select1 }) // first call: select existing
      .mockReturnValueOnce({ insert });          // second call: insert new

    const client = { from } as unknown as Parameters<typeof getOrCreateInviteToken>[0];
    const token = await getOrCreateInviteToken(client, 'group-1', 'member-1');

    expect(token).toBe('brand-new-token');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'group-1', created_by: 'member-1' })
    );
  });
});

// ---------------------------------------------------------------------------
// resetInviteToken
// ---------------------------------------------------------------------------

describe('resetInviteToken', () => {
  it('invalidates the old token and returns a new token value', async () => {
    // First from() call: update (invalidate old tokens)
    const eqUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
    const update   = jest.fn().mockReturnValue({ eq: eqUpdate });

    // Second from() call: insert new token
    const newRow = { token: 'fresh-token' };
    const single = jest.fn().mockResolvedValue({ data: newRow, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });

    const from = jest.fn()
      .mockReturnValueOnce({ update })
      .mockReturnValueOnce({ insert });

    const client = { from } as unknown as Parameters<typeof resetInviteToken>[0];
    const token = await resetInviteToken(client, 'group-1', 'member-1');

    expect(token).toBe('fresh-token');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ invalidated_at: expect.any(String) }));
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'group-1', created_by: 'member-1' })
    );
  });

  it('throws when the invalidation update fails', async () => {
    const eqUpdate = jest.fn().mockResolvedValue({ data: null, error: { message: 'not admin' } });
    const update   = jest.fn().mockReturnValue({ eq: eqUpdate });
    const from     = jest.fn().mockReturnValue({ update });

    const client = { from } as unknown as Parameters<typeof resetInviteToken>[0];
    await expect(resetInviteToken(client, 'group-1', 'member-1')).rejects.toMatchObject({ message: 'not admin' });
  });
});

// ---------------------------------------------------------------------------
// acceptInvite
// ---------------------------------------------------------------------------

describe('acceptInvite', () => {
  it('inserts an active group_members row and returns the group_id', async () => {
    const newMember = {
      id: 'gm-new',
      group_id: 'group-1',
      user_id: 'user-1',
      email: 'alice@example.com',
      status: 'active',
    };

    const single = jest.fn().mockResolvedValue({ data: newMember, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from   = jest.fn().mockReturnValue({ insert });

    const client = { from } as unknown as Parameters<typeof acceptInvite>[0];
    const groupId = await acceptInvite(client, 'group-1', 'user-1', 'alice@example.com');

    expect(groupId).toBe('group-1');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'group-1',
        user_id: 'user-1',
        email: 'alice@example.com',
        status: 'active',
        role: 'member',
      })
    );
  });

  it('handles duplicate (upsert) without throwing when user is already a member', async () => {
    // 23505 = unique_violation in Postgres — treated as "already a member"
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from   = jest.fn().mockReturnValue({ insert });

    const client = { from } as unknown as Parameters<typeof acceptInvite>[0];
    const groupId = await acceptInvite(client, 'group-1', 'user-1', 'alice@example.com');
    expect(groupId).toBe('group-1');
  });

  it('throws on unexpected insert errors', async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from   = jest.fn().mockReturnValue({ insert });

    const client = { from } as unknown as Parameters<typeof acceptInvite>[0];
    await expect(acceptInvite(client, 'group-1', 'user-1', 'alice@example.com')).rejects.toMatchObject({ message: 'permission denied' });
  });
});
