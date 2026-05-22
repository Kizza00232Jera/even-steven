import { fetchActivityFeed, fetchHasNewActivity, logActivityEvent } from '../activity';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EventRow = {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  group_id: string | null;
  actor: { display_name: string | null; email: string; google_name: string | null } | null;
  group: { name: string } | null;
};

function makeRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 'ev-1',
    event_type: 'expense_added',
    metadata: {},
    created_at: '2026-05-20T10:00:00Z',
    group_id: 'g-1',
    actor: { display_name: 'Alice', email: 'alice@example.com', google_name: null },
    group: { name: 'Trip to Paris' },
    ...overrides,
  };
}

function makeFeedClient({
  rows = [] as EventRow[],
  fetchError = null as unknown,
} = {}) {
  const rangeResult = jest.fn().mockResolvedValue({ data: rows, error: fetchError });
  const orderFn = jest.fn().mockReturnValue({ range: rangeResult });
  const eqGroupFn = jest.fn().mockReturnValue({ order: orderFn });
  const selectFn = jest.fn().mockReturnValue({ eq: eqGroupFn, order: orderFn });

  const from = jest.fn((table: string) => {
    if (table === 'activity_events') return { select: selectFn };
    throw new Error(`unexpected table: ${table}`);
  });

  return { from, _selectFn: selectFn, _eqGroupFn: eqGroupFn, _orderFn: orderFn, _rangeResult: rangeResult } as unknown as SupabaseClient<Database> & {
    _selectFn: jest.Mock;
    _eqGroupFn: jest.Mock;
    _orderFn: jest.Mock;
    _rangeResult: jest.Mock;
  };
}

function makeBadgeClient({
  count = 0,
  fetchError = null as unknown,
} = {}) {
  const mockResult = { count, error: fetchError };
  const resolved = Promise.resolve(mockResult);

  const gtFn = jest.fn().mockReturnValue(resolved);
  const selectResult = Object.assign(Object.create(resolved), {
    gt: gtFn,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  });
  const selectFn = jest.fn().mockReturnValue(selectResult);

  const from = jest.fn((table: string) => {
    if (table === 'activity_events') return { select: selectFn };
    throw new Error(`unexpected table: ${table}`);
  });

  return { from, _selectFn: selectFn, _gtFn: gtFn } as unknown as SupabaseClient<Database> & {
    _selectFn: jest.Mock;
    _gtFn: jest.Mock;
  };
}

function makeLogClient({
  insertError = null as unknown,
} = {}) {
  const insertFn = jest.fn().mockResolvedValue({ error: insertError });
  const from = jest.fn((table: string) => {
    if (table === 'activity_events') return { insert: insertFn };
    throw new Error(`unexpected table: ${table}`);
  });
  return { from, _insertFn: insertFn } as unknown as SupabaseClient<Database> & {
    _insertFn: jest.Mock;
  };
}

// ---------------------------------------------------------------------------
// fetchActivityFeed
// ---------------------------------------------------------------------------

describe('fetchActivityFeed', () => {
  it('returns an empty array when there are no events', async () => {
    const client = makeFeedClient({ rows: [] });
    const result = await fetchActivityFeed(client, {});
    expect(result).toEqual([]);
  });

  it('maps event fields correctly', async () => {
    const client = makeFeedClient({
      rows: [makeRow()],
    });
    const [event] = await fetchActivityFeed(client, {});
    expect(event.id).toBe('ev-1');
    expect(event.eventType).toBe('expense_added');
    expect(event.actorName).toBe('Alice');
    expect(event.groupName).toBe('Trip to Paris');
    expect(event.groupId).toBe('g-1');
    expect(event.createdAt).toBe('2026-05-20T10:00:00Z');
  });

  it('falls back to actor google_name when display_name is null', async () => {
    const client = makeFeedClient({
      rows: [makeRow({ actor: { display_name: null, email: 'carol@example.com', google_name: 'Carol Google' } })],
    });
    const [event] = await fetchActivityFeed(client, {});
    expect(event.actorName).toBe('Carol Google');
  });

  it('falls back to actor email when display_name and google_name are null', async () => {
    const client = makeFeedClient({
      rows: [makeRow({ actor: { display_name: null, email: 'bob@example.com', google_name: null } })],
    });
    const [event] = await fetchActivityFeed(client, {});
    expect(event.actorName).toBe('bob@example.com');
  });

  it('handles null actor gracefully', async () => {
    const client = makeFeedClient({
      rows: [makeRow({ actor: null })],
    });
    const [event] = await fetchActivityFeed(client, {});
    expect(event.actorName).toBe('Unknown');
  });

  it('handles null group gracefully', async () => {
    const client = makeFeedClient({
      rows: [makeRow({ group: null, group_id: null })],
    });
    const [event] = await fetchActivityFeed(client, {});
    expect(event.groupName).toBeNull();
    expect(event.groupId).toBeNull();
  });

  it('passes metadata through unchanged', async () => {
    const meta = { title: 'Dinner', amount: 45.5 };
    const client = makeFeedClient({
      rows: [makeRow({ metadata: meta })],
    });
    const [event] = await fetchActivityFeed(client, {});
    expect(event.metadata).toEqual(meta);
  });

  it('throws when the query fails', async () => {
    const client = makeFeedClient({ fetchError: { message: 'DB error' } });
    await expect(fetchActivityFeed(client, {})).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ---------------------------------------------------------------------------
// fetchHasNewActivity
// ---------------------------------------------------------------------------

describe('fetchHasNewActivity', () => {
  it('returns false when count is 0', async () => {
    const client = makeBadgeClient({ count: 0 });
    const result = await fetchHasNewActivity(client, null);
    expect(result).toBe(false);
  });

  it('returns true when count > 0 and since is null', async () => {
    const client = makeBadgeClient({ count: 3 });
    const result = await fetchHasNewActivity(client, null);
    expect(result).toBe(true);
  });

  it('returns true when count > 0 and since is a timestamp', async () => {
    const client = makeBadgeClient({ count: 1 });
    const result = await fetchHasNewActivity(client, '2026-05-20T10:00:00Z');
    expect(result).toBe(true);
  });

  it('throws when the query fails', async () => {
    const client = makeBadgeClient({ fetchError: { message: 'Badge error' } });
    await expect(fetchHasNewActivity(client, null)).rejects.toMatchObject({ message: 'Badge error' });
  });
});

// ---------------------------------------------------------------------------
// logActivityEvent
// ---------------------------------------------------------------------------

describe('logActivityEvent', () => {
  it('inserts an event with the provided fields', async () => {
    const client = makeLogClient();
    await logActivityEvent(client, {
      groupId: 'g-1',
      actorId: 'u-1',
      eventType: 'expense_added',
      metadata: { title: 'Dinner' },
    });
    expect(client._insertFn).toHaveBeenCalledWith({
      group_id: 'g-1',
      actor_id: 'u-1',
      event_type: 'expense_added',
      metadata: { title: 'Dinner' },
    });
  });

  it('defaults metadata to empty object when not provided', async () => {
    const client = makeLogClient();
    await logActivityEvent(client, {
      groupId: 'g-1',
      actorId: 'u-1',
      eventType: 'group_created',
    });
    expect(client._insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} })
    );
  });

  it('throws when the insert fails', async () => {
    const client = makeLogClient({ insertError: { message: 'Insert error' } });
    await expect(
      logActivityEvent(client, { groupId: 'g-1', actorId: 'u-1', eventType: 'expense_added' })
    ).rejects.toMatchObject({ message: 'Insert error' });
  });
});
