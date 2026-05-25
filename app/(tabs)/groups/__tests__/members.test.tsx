import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MembersScreen from '../[id]/members';

const mockBack = jest.fn();
const mockFetchGroupMembers = jest.fn();
const mockRemoveMember = jest.fn();
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: 'group-1' }),
}));

jest.mock('../../../../lib/repos/groups', () => ({
  fetchGroupMembers: (...args: unknown[]) => mockFetchGroupMembers(...args),
  removeMember: (...args: unknown[]) => mockRemoveMember(...args),
}));

jest.mock('../../../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../../../../store/auth', () => ({
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
  ChevronLeft: () => null,
  Shield: () => null,
  UserMinus: () => null,
  Clock: () => null,
  UserPlus: () => null,
  Share2: () => null,
  X: () => null,
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

jest.mock('../../../../components/ErrorState', () => ({
  ErrorState: () => null,
}));

const activeMember = {
  id: 'member-1',
  group_id: 'group-1',
  user_id: 'user-1',
  email: 'admin@example.com',
  display_name: 'Admin User',
  role: 'admin' as const,
  status: 'active' as const,
  is_pinned: false,
  is_muted: false,
  joined_at: '2026-01-01T00:00:00Z',
  avatar_url: null,
  google_avatar_url: null,
};

const regularMember = {
  id: 'member-2',
  group_id: 'group-1',
  user_id: 'user-2',
  email: 'friend@example.com',
  display_name: 'Friend User',
  role: 'member' as const,
  status: 'active' as const,
  is_pinned: false,
  is_muted: false,
  joined_at: '2026-01-02T00:00:00Z',
  avatar_url: null,
  google_avatar_url: null,
};

const invitedMember = {
  id: 'member-3',
  group_id: 'group-1',
  user_id: null,
  email: 'invited@example.com',
  display_name: null,
  role: 'member' as const,
  status: 'invited' as const,
  is_pinned: false,
  is_muted: false,
  joined_at: '2026-01-03T00:00:00Z',
  avatar_url: null,
  google_avatar_url: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockRemoveMember.mockResolvedValue(undefined);
});

describe('MembersScreen — rendering', () => {
  it('renders member names', () => {
    mockUseQuery.mockReturnValue({
      data: [activeMember, regularMember],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<MembersScreen />);
    expect(getByText('Admin User')).toBeTruthy();
    expect(getByText('Friend User')).toBeTruthy();
  });

  it('shows admin badge on admin member', () => {
    mockUseQuery.mockReturnValue({
      data: [activeMember],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<MembersScreen />);
    expect(getByTestId('admin-badge-member-1')).toBeTruthy();
  });

  it('shows pending badge for invited members', () => {
    mockUseQuery.mockReturnValue({
      data: [invitedMember],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<MembersScreen />);
    expect(getByText('Pending')).toBeTruthy();
  });

  it('shows email for members without display name', () => {
    mockUseQuery.mockReturnValue({
      data: [invitedMember],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<MembersScreen />);
    expect(getByText('invited@example.com')).toBeTruthy();
  });

  it('shows member count in header', () => {
    mockUseQuery.mockReturnValue({
      data: [activeMember, regularMember],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<MembersScreen />);
    expect(getByText('Members (2)')).toBeTruthy();
  });
});

describe('MembersScreen — admin actions', () => {
  it('shows remove button on non-self members when current user is admin', () => {
    mockUseQuery.mockReturnValue({
      data: [activeMember, regularMember],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<MembersScreen />);
    expect(getByTestId('remove-member-member-2')).toBeTruthy();
  });

  it('does not show remove button on own row', () => {
    mockUseQuery.mockReturnValue({
      data: [activeMember, regularMember],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { queryByTestId } = render(<MembersScreen />);
    expect(queryByTestId('remove-member-member-1')).toBeNull();
  });
});

describe('MembersScreen — navigation', () => {
  it('goes back when back button pressed', () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<MembersScreen />);
    fireEvent.press(getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalled();
  });
});
