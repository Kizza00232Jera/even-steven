import { isTripExpired, shouldAutoArchive } from './tripLifecycle';
import type { Database } from './database.types';

type Group = Database['public']['Tables']['groups']['Row'];

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'Test Trip',
    type: 'Trip',
    base_currency: 'USD',
    admin_id: 'u1',
    status: 'active',
    start_date: '2025-01-01',
    end_date: '2025-12-31',
    settlement_visibility: 'public',
    background_image_url: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('isTripExpired', () => {
  it('returns true for an active Trip whose end date has passed', () => {
    const group = makeGroup({ type: 'Trip', status: 'active', end_date: '2025-05-01' });
    expect(isTripExpired(group, '2026-05-21')).toBe(true);
  });

  it('returns false when end_date equals today', () => {
    const group = makeGroup({ type: 'Trip', status: 'active', end_date: '2026-05-21' });
    expect(isTripExpired(group, '2026-05-21')).toBe(false);
  });

  it('returns false when end_date is in the future', () => {
    const group = makeGroup({ type: 'Trip', status: 'active', end_date: '2027-01-01' });
    expect(isTripExpired(group, '2026-05-21')).toBe(false);
  });

  it('returns false for a non-Trip group even if dates have passed', () => {
    const group = makeGroup({ type: 'Home', status: 'active', end_date: '2025-01-01' });
    expect(isTripExpired(group, '2026-05-21')).toBe(false);
  });

  it('returns false for an already-expired Trip (status is not active)', () => {
    const group = makeGroup({ type: 'Trip', status: 'expired', end_date: '2025-01-01' });
    expect(isTripExpired(group, '2026-05-21')).toBe(false);
  });

  it('returns false for an archived Trip', () => {
    const group = makeGroup({ type: 'Trip', status: 'archived', end_date: '2025-01-01' });
    expect(isTripExpired(group, '2026-05-21')).toBe(false);
  });

  it('returns false when end_date is null', () => {
    const group = makeGroup({ type: 'Trip', status: 'active', end_date: null });
    expect(isTripExpired(group, '2026-05-21')).toBe(false);
  });
});

describe('shouldAutoArchive', () => {
  it('returns true for an expired group when all balances are zero', () => {
    const group = makeGroup({ status: 'expired' });
    expect(shouldAutoArchive(group, true)).toBe(true);
  });

  it('returns false for an expired group when balances are not all zero', () => {
    const group = makeGroup({ status: 'expired' });
    expect(shouldAutoArchive(group, false)).toBe(false);
  });

  it('returns false for an active group even when all balances are zero', () => {
    const group = makeGroup({ status: 'active' });
    expect(shouldAutoArchive(group, true)).toBe(false);
  });

  it('returns false for an archived group', () => {
    const group = makeGroup({ status: 'archived' });
    expect(shouldAutoArchive(group, true)).toBe(false);
  });
});
