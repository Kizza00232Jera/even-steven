import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import GroupsScreen from '../index';

const mockPush = jest.fn();
const mockFetchGroups = jest.fn();
const mockPinGroup = jest.fn();
const mockUnpinGroup = jest.fn();
const mockMuteGroup = jest.fn();
const mockUnmuteGroup = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../../../lib/repos/groups', () => ({
  fetchGroupsWithMembership: (...args: unknown[]) => mockFetchGroups(...args),
  pinGroup: (...args: unknown[]) => mockPinGroup(...args),
  unpinGroup: (...args: unknown[]) => mockUnpinGroup(...args),
  muteGroup: (...args: unknown[]) => mockMuteGroup(...args),
  unmuteGroup: (...args: unknown[]) => mockUnmuteGroup(...args),
}));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn(function (this: unknown) { return this; }),
      subscribe: jest.fn(function (this: unknown) { return this; }),
    })),
    removeChannel: jest.fn(),
  },
}));

jest.mock('../../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1', email: 'test@example.com' } },
    profile: { display_name: 'Test User' },
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('lucide-react-native', () => ({
  Plus: () => null,
  Pin: () => null,
  BellOff: () => null,
  MoreHorizontal: () => null,
  Filter: () => null,
  X: () => null,
  ChevronRight: () => null,
  Check: () => null,
  Link: () => null,
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

const baseGroup = {
  id: 'g1',
  name: 'Paris Trip',
  type: 'Trip',
  base_currency: 'EUR',
  admin_id: 'user-1',
  status: 'active',
  start_date: '2026-06-01',
  end_date: '2026-06-10',
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

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockPinGroup.mockResolvedValue(undefined);
  mockUnpinGroup.mockResolvedValue(undefined);
  mockMuteGroup.mockResolvedValue(undefined);
  mockUnmuteGroup.mockResolvedValue(undefined);
});

describe('GroupsScreen — loading', () => {
  it('renders loading skeletons while fetching', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() });
    const { getAllByTestId } = render(<GroupsScreen />);
    expect(getAllByTestId('skeleton-group-card').length).toBeGreaterThan(0);
  });
});

describe('GroupsScreen — empty state', () => {
  it('renders empty state when no groups', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
    const { getByText } = render(<GroupsScreen />);
    expect(getByText(/No groups yet/)).toBeTruthy();
  });
});

describe('GroupsScreen — group cards', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [baseGroup], isLoading: false, isError: false, refetch: jest.fn() });
  });

  it('renders group name and type badge', () => {
    const { getByText } = render(<GroupsScreen />);
    expect(getByText('Paris Trip')).toBeTruthy();
    expect(getByText('Trip')).toBeTruthy();
  });

  it('shows "Settled" when balance is 0', () => {
    const { getByText } = render(<GroupsScreen />);
    expect(getByText('Settled')).toBeTruthy();
  });

  it('navigates to group detail on tap', () => {
    const { getByTestId } = render(<GroupsScreen />);
    fireEvent.press(getByTestId('group-card-g1'));
    expect(mockPush).toHaveBeenCalledWith('/groups/g1');
  });

  it('shows pin icon for pinned group', () => {
    mockUseQuery.mockReturnValue({
      data: [{ ...baseGroup, is_pinned: true }],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<GroupsScreen />);
    expect(getByTestId('pin-icon-g1')).toBeTruthy();
  });

  it('shows mute icon for muted group', () => {
    mockUseQuery.mockReturnValue({
      data: [{ ...baseGroup, is_muted: true }],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<GroupsScreen />);
    expect(getByTestId('mute-icon-g1')).toBeTruthy();
  });
});

describe('GroupsScreen — negative balance', () => {
  it('shows "You owe" for negative balance', () => {
    mockUseQuery.mockReturnValue({
      data: [{ ...baseGroup, balance: -23.5 }],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getAllByText } = render(<GroupsScreen />);
    expect(getAllByText(/You owe/).length).toBeGreaterThan(0);
  });
});

describe('GroupsScreen — positive balance', () => {
  it("shows \"You're owed\" for positive balance", () => {
    mockUseQuery.mockReturnValue({
      data: [{ ...baseGroup, balance: 47 }],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getAllByText } = render(<GroupsScreen />);
    expect(getAllByText(/You're owed/).length).toBeGreaterThan(0);
  });
});

describe('GroupsScreen — navigation', () => {
  it('navigates to create screen on + button', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
    const { getByTestId } = render(<GroupsScreen />);
    fireEvent.press(getByTestId('create-group-fab'));
    expect(mockPush).toHaveBeenCalledWith('/group/create');
  });
});

