import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ActivityScreen from '../index';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMarkSeen = jest.fn();
const mockFetchActivityFeed = jest.fn();
const mockFetchGroupsWithMembership = jest.fn();
const mockUseInfiniteQuery = jest.fn();
const mockUseQuery = jest.fn();

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    // Call immediately on mount (simulates focus)
    const React = require('react');
    React.useEffect(cb, []);
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('../../../../lib/repos/activity', () => ({
  fetchActivityFeed: (...args: unknown[]) => mockFetchActivityFeed(...args),
  fetchHasNewActivity: jest.fn(),
}));

jest.mock('../../../../lib/repos/groups', () => ({
  fetchGroupsWithMembership: (...args: unknown[]) => mockFetchGroupsWithMembership(...args),
}));

jest.mock('../../../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1', email: 'test@example.com' } },
  }),
}));

jest.mock('../../../../store/activity', () => ({
  useActivityStore: (selector: (s: { lastSeenAt: null; markSeen: () => void }) => unknown) =>
    selector({ lastSeenAt: null, markSeen: mockMarkSeen }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('lucide-react-native', () => {
  const mockIcon = () => null;
  return {
    Filter: mockIcon,
    X: mockIcon,
    DollarSign: mockIcon,
    Pencil: mockIcon,
    Trash2: mockIcon,
    ArrowLeftRight: mockIcon,
    RotateCcw: mockIcon,
    UserPlus: mockIcon,
    UserMinus: mockIcon,
    LogOut: mockIcon,
    Users: mockIcon,
    Archive: mockIcon,
    Link: mockIcon,
    Clock: mockIcon,
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseEvent = {
  id: 'ev-1',
  eventType: 'expense_added' as const,
  actorName: 'Alice',
  groupId: 'g-1',
  groupName: 'Paris Trip',
  metadata: {},
  createdAt: '2026-05-20T10:00:00Z',
};

const baseGroup = {
  id: 'g-1',
  name: 'Paris Trip',
  type: 'Trip',
  base_currency: 'EUR',
  admin_id: 'user-1',
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
};

function makeInfiniteQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: [] });
  mockUseInfiniteQuery.mockReturnValue(makeInfiniteQueryResult());
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityScreen', () => {
  it('shows loading skeletons while fetching', () => {
    mockUseInfiniteQuery.mockReturnValue(makeInfiniteQueryResult({ isLoading: true }));
    const { getByTestId } = render(<ActivityScreen />);
    expect(getByTestId('activity-loading')).toBeTruthy();
  });

  it('shows error state when query fails', () => {
    mockUseInfiniteQuery.mockReturnValue(makeInfiniteQueryResult({ isError: true }));
    const { getByText } = render(<ActivityScreen />);
    expect(getByText(/try again/i)).toBeTruthy();
  });

  it('shows empty state when there are no events', () => {
    mockUseInfiniteQuery.mockReturnValue(
      makeInfiniteQueryResult({ data: { pages: [[]], pageParams: [0] } })
    );
    const { getByText } = render(<ActivityScreen />);
    expect(getByText(/no activity yet/i)).toBeTruthy();
  });

  it('renders activity rows for each event', async () => {
    mockUseInfiniteQuery.mockReturnValue(
      makeInfiniteQueryResult({
        data: { pages: [[baseEvent]], pageParams: [0] },
      })
    );
    const { getByTestId } = render(<ActivityScreen />);
    await waitFor(() => expect(getByTestId('activity-row-ev-1')).toBeTruthy());
  });

  it('shows the actor name and group name in each row', async () => {
    mockUseInfiniteQuery.mockReturnValue(
      makeInfiniteQueryResult({ data: { pages: [[baseEvent]], pageParams: [0] } })
    );
    const { getByText } = render(<ActivityScreen />);
    await waitFor(() => {
      expect(getByText(/Alice/)).toBeTruthy();
      expect(getByText('Paris Trip')).toBeTruthy();
    });
  });

  it('shows the filter button', () => {
    const { getByTestId } = render(<ActivityScreen />);
    expect(getByTestId('filter-button')).toBeTruthy();
  });

  it('opens filter sheet when filter button is pressed', () => {
    mockUseQuery.mockReturnValue({ data: [baseGroup] });
    const { getByTestId, getByText } = render(<ActivityScreen />);
    fireEvent.press(getByTestId('filter-button'));
    expect(getByText('Filter by group')).toBeTruthy();
  });

  it('shows All groups and group list in filter sheet', () => {
    mockUseQuery.mockReturnValue({ data: [baseGroup] });
    const { getByTestId, getByText } = render(<ActivityScreen />);
    fireEvent.press(getByTestId('filter-button'));
    expect(getByText('All groups')).toBeTruthy();
    expect(getByText('Paris Trip')).toBeTruthy();
  });

  it('shows filter chip when a group is selected', () => {
    mockUseQuery.mockReturnValue({ data: [baseGroup] });
    const { getByTestId, queryByTestId } = render(<ActivityScreen />);
    expect(queryByTestId('filter-chip')).toBeNull();
    fireEvent.press(getByTestId('filter-button'));
    fireEvent.press(getByTestId('filter-group-g-1'));
    expect(getByTestId('filter-chip')).toBeTruthy();
  });

  it('clears filter chip when X is pressed on the chip', () => {
    mockUseQuery.mockReturnValue({ data: [baseGroup] });
    const { getByTestId, queryByTestId } = render(<ActivityScreen />);
    fireEvent.press(getByTestId('filter-button'));
    fireEvent.press(getByTestId('filter-group-g-1'));
    expect(getByTestId('filter-chip')).toBeTruthy();
    fireEvent.press(getByTestId('filter-chip'));
    expect(queryByTestId('filter-chip')).toBeNull();
  });

  it('calls markSeen when the screen is focused', () => {
    render(<ActivityScreen />);
    expect(mockMarkSeen).toHaveBeenCalled();
  });

  it('shows amount in event row when metadata contains amount and currency', async () => {
    const eventWithAmount = {
      ...baseEvent,
      metadata: { amount: 45.5, currency: 'EUR' },
    };
    mockUseInfiniteQuery.mockReturnValue(
      makeInfiniteQueryResult({ data: { pages: [[eventWithAmount]], pageParams: [0] } })
    );
    const { getByText } = render(<ActivityScreen />);
    await waitFor(() => expect(getByText(/45\.50/)).toBeTruthy());
  });
});
