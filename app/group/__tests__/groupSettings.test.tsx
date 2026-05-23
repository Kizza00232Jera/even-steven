import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import GroupDetailScreen from '../[id]/index';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ id: 'group-1' }),
}));

jest.mock('../../../lib/repos/groups', () => ({
  fetchGroupDetail: jest.fn(),
}));

jest.mock('../../../lib/repos/invites', () => ({
  getOrCreateInviteToken: jest.fn().mockResolvedValue('tok'),
}));

jest.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ info: jest.fn(), success: jest.fn(), error: jest.fn() }),
}));

jest.mock('../[id]/balances', () => ({
  BalancesTab: () => null,
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn(function (this: unknown) { return this; }),
      subscribe: jest.fn(function (this: unknown) { return this; }),
    })),
    removeChannel: jest.fn(),
  },
}));

jest.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1', email: 'admin@example.com' } },
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('lucide-react-native', () => ({
  Settings: () => null,
  ChevronLeft: () => null,
  Plus: () => null,
  Share2: () => null,
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

jest.mock('../../../components/ErrorState', () => ({
  ErrorState: () => null,
}));

jest.mock('../../../components/RemovedMemberState', () => ({
  RemovedMemberState: () => null,
}));

jest.mock('../../../components/SkeletonExpenseCard', () => ({
  SkeletonExpenseCard: () => null,
}));

jest.mock('../../../components/SkeletonBalanceRow', () => ({
  SkeletonBalanceRow: () => null,
}));

const group = {
  id: 'group-1',
  name: 'Paris Trip',
  type: 'Trip' as const,
  status: 'active' as const,
  isMember: true,
  isAdmin: true,
  memberId: 'member-1',
  currentMemberId: 'member-1',
  isMuted: false,
  balance: 0,
  memberCount: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });
});

describe('GroupDetailScreen — settings navigation', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: group,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  it('navigates to settings screen on gear icon press', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('settings-button'));
    expect(mockPush).toHaveBeenCalledWith('/group/group-1/settings');
  });
});
