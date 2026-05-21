import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import GroupDetailScreen from '../[id]/index';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockLeaveGroup = jest.fn();
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ id: 'group-1' }),
}));

jest.mock('../../../lib/repos/groups', () => ({
  leaveGroup: (...args: unknown[]) => mockLeaveGroup(...args),
}));

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

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
  LogOut: () => null,
  Users: () => null,
  BellOff: () => null,
  Bell: () => null,
  X: () => null,
  ChevronRight: () => null,
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
  isMember: true,
  isAdmin: true,
  memberId: 'member-1',
  isMuted: false,
  balance: 0,
  memberCount: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockLeaveGroup.mockResolvedValue({ groupDeleted: false });
});

describe('GroupDetailScreen — settings sheet', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: group,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  it('opens settings sheet on gear icon press', () => {
    const { getByTestId, getByText } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('settings-button'));
    expect(getByText('Leave group')).toBeTruthy();
  });

  it('closes settings sheet on X press', () => {
    const { getByTestId, queryByText } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('settings-button'));
    fireEvent.press(getByTestId('close-settings'));
    expect(queryByText('Leave group')).toBeNull();
  });

  it('calls leaveGroup when confirming leave', async () => {
    const mockMutate = jest.fn();
    mockUseMutation.mockReturnValue({ mutate: mockMutate, isPending: false });
    const { getByTestId, getByText } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('settings-button'));
    fireEvent.press(getByText('Leave group'));
    await waitFor(() => expect(getByText('Leave group')).toBeTruthy());
  });
});
