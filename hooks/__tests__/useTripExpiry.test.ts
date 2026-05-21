import { checkAndAutoArchive } from '../useTripExpiry';
import { markGroupArchived } from '../../lib/repos/groups';

jest.mock('../../lib/repos/groups', () => ({
  markGroupArchived: jest.fn(),
  markGroupExpired: jest.fn(),
}));

jest.mock('../../lib/supabase', () => ({ supabase: {} }));

const mockMarkGroupArchived = markGroupArchived as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('checkAndAutoArchive', () => {
  it('archives an expired group when all balances are zero', async () => {
    await checkAndAutoArchive('g1', 'expired', true);
    expect(mockMarkGroupArchived).toHaveBeenCalledWith({}, 'g1');
  });

  it('does not archive an expired group when balances are not all zero', async () => {
    await checkAndAutoArchive('g1', 'expired', false);
    expect(mockMarkGroupArchived).not.toHaveBeenCalled();
  });

  it('does not archive an active group even when all balances are zero', async () => {
    await checkAndAutoArchive('g1', 'active', true);
    expect(mockMarkGroupArchived).not.toHaveBeenCalled();
  });
});
