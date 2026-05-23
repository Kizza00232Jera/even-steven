import {
  sortGroups,
  filterGroups,
  type GroupWithMembership,
  type GroupFilters,
} from '../groupFilters';

function makeGroup(overrides: Partial<GroupWithMembership>): GroupWithMembership {
  return {
    id: 'g1',
    name: 'Test Group',
    type: 'Home',
    base_currency: 'EUR',
    admin_id: 'u1',
    status: 'active',
    start_date: null,
    end_date: null,
    settlement_visibility: 'public',
    background_image_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    member_id: 'm1',
    is_pinned: false,
    is_muted: false,
    role: 'member',
    balance: 0,
    ...overrides,
  };
}

describe('sortGroups', () => {
  it('puts pinned groups before unpinned groups', () => {
    const unpinned = makeGroup({ id: 'g1', is_pinned: false, updated_at: '2026-01-10T00:00:00Z' });
    const pinned = makeGroup({ id: 'g2', is_pinned: true, updated_at: '2026-01-01T00:00:00Z' });
    const result = sortGroups([unpinned, pinned]);
    expect(result[0].id).toBe('g2');
    expect(result[1].id).toBe('g1');
  });

  it('sorts unpinned groups by updated_at descending', () => {
    const older = makeGroup({ id: 'g1', updated_at: '2026-01-01T00:00:00Z' });
    const newer = makeGroup({ id: 'g2', updated_at: '2026-01-10T00:00:00Z' });
    const result = sortGroups([older, newer]);
    expect(result[0].id).toBe('g2');
    expect(result[1].id).toBe('g1');
  });

  it('sorts pinned groups by updated_at descending among themselves', () => {
    const olderPinned = makeGroup({ id: 'g1', is_pinned: true, updated_at: '2026-01-01T00:00:00Z' });
    const newerPinned = makeGroup({ id: 'g2', is_pinned: true, updated_at: '2026-01-10T00:00:00Z' });
    const result = sortGroups([olderPinned, newerPinned]);
    expect(result[0].id).toBe('g2');
    expect(result[1].id).toBe('g1');
  });

  it('returns empty array unchanged', () => {
    expect(sortGroups([])).toEqual([]);
  });
});

describe('filterGroups', () => {
  const active = makeGroup({ id: 'g1', status: 'active', type: 'Home', balance: 0 });
  const archived = makeGroup({ id: 'g2', status: 'archived', type: 'Trip', balance: 0 });
  const trip = makeGroup({
    id: 'g3',
    status: 'active',
    type: 'Trip',
    balance: -20,
    start_date: '2026-06-01',
    end_date: '2026-06-10',
  });
  const positiveBalance = makeGroup({ id: 'g4', status: 'active', type: 'Family', balance: 50 });
  const negativeBalance = makeGroup({ id: 'g5', status: 'active', type: 'Couple', balance: -30 });

  const allGroups = [active, archived, trip, positiveBalance, negativeBalance];

  const noFilters: GroupFilters = {
    status: null,
    types: [],
    balance: null,
    tripTiming: null,
  };

  it('returns all groups when no filters are active', () => {
    expect(filterGroups(allGroups, noFilters)).toHaveLength(allGroups.length);
  });

  it('filters by status: active', () => {
    const result = filterGroups(allGroups, { ...noFilters, status: 'active' });
    expect(result.every((g) => g.status === 'active')).toBe(true);
    expect(result.find((g) => g.id === 'g2')).toBeUndefined();
  });

  it('filters by status: archived', () => {
    const result = filterGroups(allGroups, { ...noFilters, status: 'archived' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g2');
  });

  it('filters by group type', () => {
    const result = filterGroups(allGroups, { ...noFilters, types: ['Trip'] });
    expect(result.every((g) => g.type === 'Trip')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('filters by multiple types', () => {
    const result = filterGroups(allGroups, { ...noFilters, types: ['Trip', 'Home'] });
    expect(result).toHaveLength(3);
  });

  it('filters balance: you owe', () => {
    const result = filterGroups(allGroups, { ...noFilters, balance: 'owe' });
    expect(result.every((g) => g.balance < 0)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('filters balance: you are owed', () => {
    const result = filterGroups(allGroups, { ...noFilters, balance: 'owed' });
    expect(result.every((g) => g.balance > 0)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('filters balance: settled', () => {
    const result = filterGroups(allGroups, { ...noFilters, balance: 'settled' });
    expect(result.every((g) => g.balance === 0)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('combines status and type filters', () => {
    const result = filterGroups(allGroups, { ...noFilters, status: 'active', types: ['Trip'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g3');
  });

  it('trip timing: upcoming (start_date in future)', () => {
    const today = '2026-05-21';
    const upcomingTrip = makeGroup({
      id: 'upcoming',
      type: 'Trip',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    const ongoingTrip = makeGroup({
      id: 'ongoing',
      type: 'Trip',
      start_date: '2026-05-15',
      end_date: '2026-05-30',
    });
    const pastTrip = makeGroup({
      id: 'past',
      type: 'Trip',
      start_date: '2026-01-01',
      end_date: '2026-01-10',
    });
    const result = filterGroups([upcomingTrip, ongoingTrip, pastTrip], {
      ...noFilters,
      tripTiming: 'upcoming',
      today,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('upcoming');
  });

  it('trip timing: ongoing (today between start and end)', () => {
    const today = '2026-05-21';
    const upcomingTrip = makeGroup({
      id: 'upcoming',
      type: 'Trip',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    const ongoingTrip = makeGroup({
      id: 'ongoing',
      type: 'Trip',
      start_date: '2026-05-15',
      end_date: '2026-05-30',
    });
    const pastTrip = makeGroup({
      id: 'past',
      type: 'Trip',
      start_date: '2026-01-01',
      end_date: '2026-01-10',
    });
    const result = filterGroups([upcomingTrip, ongoingTrip, pastTrip], {
      ...noFilters,
      tripTiming: 'ongoing',
      today,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ongoing');
  });

  it('trip timing: past (end_date in past)', () => {
    const today = '2026-05-21';
    const upcomingTrip = makeGroup({
      id: 'upcoming',
      type: 'Trip',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    const pastTrip = makeGroup({
      id: 'past',
      type: 'Trip',
      start_date: '2026-01-01',
      end_date: '2026-01-10',
    });
    const result = filterGroups([upcomingTrip, pastTrip], {
      ...noFilters,
      tripTiming: 'past',
      today,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('past');
  });
});
