import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import GroupMembersScreen from '../[id]/members';
import type { GroupDetail } from '../../../lib/repos/groups';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockFetchGroupMembers = jest.fn();
const mockRemoveMember = jest.fn();
const mockUseQuery = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'group-1' }),
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('../../../lib/repos/groups', () => ({
  fetchGroupMembers: (...args: unknown[]) => mockFetchGroupMembers(...args),
  removeMember: (...args: unknown[]) => mockRemoveMember(...args),
}));

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1' } },
  }),
}));

jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  Shield: () => null,
  UserX: () => null,
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

const adminMember = {
  id: 'member-1',
  user_id: 'user-1',
  email: 'admin@example.com',
  display_name: 'Admin User',
  role: 'admin' as const,
  status: 'active' as const,
  joined_at: '2026-01-01',
  profile_display_name: null,
  avatar_url: null,
  balance: 0,
};

const regularMember = {
  id: 'member-2',
  user_id: 'user-2',
  email: 'user2@example.com',
  display_name: 'Regular User',
  role: 'member' as const,
  status: 'active' as const,
  joined_at: '2026-01-02',
  profile_display_name: null,
  avatar_url: null,
  balance: 0,
};

const invitedMember = {
  id: 'member-3',
  user_id: null,
  email: 'invited@example.com',
  display_name: null,
  role: 'member' as const,
  status: 'invited' as const,
  joined_at: '2026-01-03',
  profile_display_name: null,
  avatar_url: null,
  balance: 0,
};

const groupDetail = {
  group: {
    id: 'group-1',
    name: 'Test Group',
    type: 'Home' as const,
    base_currency: 'USD' as const,
    admin_id: 'user-1',
    status: 'active' as const,
    start_date: null,
    end_date: null,
    settlement_visibility: 'public' as const,
    background_image_url: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  currentMemberId: 'member-1',
  currentMemberRole: 'admin' as const,
  currentMemberIsMuted: false,
  memberCount: 3,
  hasUnsettledBalances: false,
};

const memberGroupDetail: GroupDetail = {
  ...groupDetail,
  currentMemberId: 'member-2',
  currentMemberRole: 'member',
};

function setupDefaultQueries(
  detail: GroupDetail = groupDetail,
  members = [adminMember, regularMember, invitedMember]
) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey.includes('settings')) {
      return { data: detail, isLoading: false, isError: false, refetch: jest.fn() };
    }
    return { data: members, isLoading: false, isError: false, refetch: jest.fn() };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaultQueries();
  mockRemoveMember.mockResolvedValue(undefined);
});

describe('GroupMembersScreen — rendering', () => {
  it('shows Members screen heading', () => {
    const { getByText } = render(<GroupMembersScreen />);
    expect(getByText('Members')).toBeTruthy();
  });

  it('lists active members by name', () => {
    const { getByText } = render(<GroupMembersScreen />);
    expect(getByText('Admin User')).toBeTruthy();
    expect(getByText('Regular User')).toBeTruthy();
  });

  it('shows invited member email with Invited badge', () => {
    const { getByText } = render(<GroupMembersScreen />);
    expect(getByText('invited@example.com')).toBeTruthy();
    expect(getByText('Invited')).toBeTruthy();
  });

  it('shows Admin badge on admin member', () => {
    const { getByTestId } = render(<GroupMembersScreen />);
    expect(getByTestId('admin-badge-member-1')).toBeTruthy();
  });
});

describe('GroupMembersScreen — admin remove', () => {
  it('admin sees remove button on other members', () => {
    const { getByTestId } = render(<GroupMembersScreen />);
    expect(getByTestId('remove-member-member-2')).toBeTruthy();
  });

  it('admin does not see remove button on their own row', () => {
    const { queryByTestId } = render(<GroupMembersScreen />);
    expect(queryByTestId('remove-member-member-1')).toBeNull();
  });

  it('non-admin does not see any remove buttons', () => {
    setupDefaultQueries(memberGroupDetail, [adminMember, regularMember]);
    const { queryByTestId } = render(<GroupMembersScreen />);
    expect(queryByTestId('remove-member-member-1')).toBeNull();
    expect(queryByTestId('remove-member-member-2')).toBeNull();
  });

  it('remove button shows confirmation alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupMembersScreen />);
    fireEvent.press(getByTestId('remove-member-member-2'));
    expect(alertSpy).toHaveBeenCalled();
  });

  it('confirming remove calls removeMember with member id', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupMembersScreen />);
    fireEvent.press(getByTestId('remove-member-member-2'));
    const [,, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    buttons.find((b) => b.text === 'Remove')?.onPress?.();
    await waitFor(() => {
      expect(mockRemoveMember).toHaveBeenCalledWith({}, 'member-2');
    });
  });

  it('confirming remove invalidates group queries', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupMembersScreen />);
    fireEvent.press(getByTestId('remove-member-member-2'));
    const [,, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    buttons.find((b) => b.text === 'Remove')?.onPress?.();
    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });

  it('cancelling remove does not call removeMember', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupMembersScreen />);
    fireEvent.press(getByTestId('remove-member-member-2'));
    const [,, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    buttons.find((b) => b.text === 'Cancel')?.onPress?.();
    expect(mockRemoveMember).not.toHaveBeenCalled();
  });
});
