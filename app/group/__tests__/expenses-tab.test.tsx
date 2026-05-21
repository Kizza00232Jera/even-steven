import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import GroupDetailScreen from '../[id]/index';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockFetchGroupDetail = jest.fn();
const mockFetchGroupExpenses = jest.fn();
const mockFetchGroupBalances = jest.fn();
const mockHasGroupSettlements = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockUseQuery = jest.fn();

const CURRENT_USER_ID = 'user-1';
const PAYER_MEMBER_ID = 'member-1';
const OTHER_MEMBER_ID = 'member-2';
const GROUP_ID = 'group-1';

const BASE_GROUP = {
  id: GROUP_ID,
  name: 'Summer Trip',
  type: 'Trip' as const,
  base_currency: 'EUR' as const,
  status: 'active' as const,
  isMember: true,
  isAdmin: true,
  memberId: PAYER_MEMBER_ID,
  isMuted: false,
  balance: 0,
  memberCount: 2,
  hasUnsettledBalances: false,
  currentMemberId: PAYER_MEMBER_ID,
  group: {
    id: GROUP_ID,
    name: 'Summer Trip',
    type: 'Trip' as const,
    base_currency: 'EUR' as const,
    admin_id: CURRENT_USER_ID,
    status: 'active' as const,
    start_date: '2026-05-01',
    end_date: '2026-06-30',
    settlement_visibility: 'public' as const,
    background_image_url: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  currentMemberRole: 'admin' as const,
  currentMemberIsMuted: false,
};

const EXPENSES = [
  {
    id: 'expense-1',
    title: 'Dinner at Konoba',
    description: null,
    amount: 50,
    currency: 'EUR' as const,
    category: 'Dining Out',
    payer_id: PAYER_MEMBER_ID,
    payer_user_id: CURRENT_USER_ID,
    payer_name: 'Alice',
    split_method: 'equal' as const,
    expense_date: '2026-05-15',
    is_edited: false,
    participant_member_ids: [PAYER_MEMBER_ID, OTHER_MEMBER_ID],
  },
  {
    id: 'expense-2',
    title: 'Taxi to airport',
    description: null,
    amount: 30,
    currency: 'EUR' as const,
    category: 'Taxi',
    payer_id: OTHER_MEMBER_ID,
    payer_user_id: 'user-2',
    payer_name: 'Bob',
    split_method: 'equal' as const,
    expense_date: '2026-05-14',
    is_edited: true,
    participant_member_ids: [PAYER_MEMBER_ID, OTHER_MEMBER_ID],
  },
];

const BALANCES_DATA = {
  groupId: GROUP_ID,
  currency: 'EUR' as const,
  members: [
    { memberId: PAYER_MEMBER_ID, userId: CURRENT_USER_ID, name: 'Alice', email: 'alice@example.com', avatarUrl: null, balance: 15 },
    { memberId: OTHER_MEMBER_ID, userId: 'user-2', name: 'Bob', email: 'bob@example.com', avatarUrl: null, balance: -15 },
  ],
};

const SETTLED_BALANCES_DATA = {
  groupId: GROUP_ID,
  currency: 'EUR' as const,
  members: [
    { memberId: PAYER_MEMBER_ID, userId: CURRENT_USER_ID, name: 'Alice', email: 'alice@example.com', avatarUrl: null, balance: 0 },
    { memberId: OTHER_MEMBER_ID, userId: 'user-2', name: 'Bob', email: 'bob@example.com', avatarUrl: null, balance: 0 },
  ],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ id: GROUP_ID }),
}));

jest.mock('../../../lib/repos/groups', () => ({
  fetchGroupDetail: (...args: unknown[]) => mockFetchGroupDetail(...args),
  leaveGroup: jest.fn(),
  getOrCreateInviteToken: jest.fn(),
}));

jest.mock('../../../lib/repos/invites', () => ({
  getOrCreateInviteToken: jest.fn(),
}));

jest.mock('../../../lib/repos/expenses', () => ({
  fetchGroupExpenses: (...args: unknown[]) => mockFetchGroupExpenses(...args),
  hasGroupSettlements: (...args: unknown[]) => mockHasGroupSettlements(...args),
}));

jest.mock('../../../lib/repos/balances', () => ({
  fetchGroupBalances: (...args: unknown[]) => mockFetchGroupBalances(...args),
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    }),
    removeChannel: jest.fn(),
  },
}));

jest.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: CURRENT_USER_ID } },
    profile: { preferred_currency: 'EUR', display_name: 'Alice' },
  }),
}));

jest.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
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
  Plus: () => null,
  Share2: () => null,
  User: () => null,
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

function setupGroupQuery(groupData = BASE_GROUP, expensesData = EXPENSES, balancesData = BALANCES_DATA) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'group') {
      return { data: groupData, isLoading: false, isError: false, refetch: jest.fn() };
    }
    if (queryKey[0] === 'expenses') {
      return { data: expensesData, isLoading: false, isError: false };
    }
    if (queryKey[0] === 'group-balances') {
      return { data: balancesData, isLoading: false, isError: false };
    }
    return { data: null, isLoading: false, isError: false };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupGroupQuery();
  mockFetchGroupExpenses.mockResolvedValue(EXPENSES);
  mockFetchGroupBalances.mockResolvedValue(BALANCES_DATA);
  mockHasGroupSettlements.mockResolvedValue(false);
});

describe('ExpensesTab — filter chips', () => {
  it('shows All, Unsettled, Mine, I paid filter chips', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    expect(getByTestId('filter-all')).toBeTruthy();
    expect(getByTestId('filter-unsettled')).toBeTruthy();
    expect(getByTestId('filter-mine')).toBeTruthy();
    expect(getByTestId('filter-i-paid')).toBeTruthy();
  });

  it('defaults to All filter', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    const allChip = getByTestId('filter-all');
    expect(allChip.props.accessibilityState?.selected).toBe(true);
  });

  it('shows all expenses with All filter', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    expect(getByTestId('expense-card-expense-1')).toBeTruthy();
    expect(getByTestId('expense-card-expense-2')).toBeTruthy();
  });

  it('shows only payer expenses with I paid filter', () => {
    const { getByTestId, queryByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    fireEvent.press(getByTestId('filter-i-paid'));
    // expense-1 has payer_id = PAYER_MEMBER_ID (current user)
    expect(getByTestId('expense-card-expense-1')).toBeTruthy();
    // expense-2 has payer_id = OTHER_MEMBER_ID (not current user)
    expect(queryByTestId('expense-card-expense-2')).toBeNull();
  });

  it('Mine filter shows expenses where current member is a participant', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    fireEvent.press(getByTestId('filter-mine'));
    // Both expenses include the current member as participant
    expect(getByTestId('expense-card-expense-1')).toBeTruthy();
    expect(getByTestId('expense-card-expense-2')).toBeTruthy();
  });
});

describe('ExpensesTab — expense card display', () => {
  it('shows expense title on card', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    expect(getByTestId('expense-title-expense-1')).toBeTruthy();
  });

  it('shows edited badge for is_edited expenses', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    // expense-2 has is_edited = true
    expect(getByTestId('edited-badge-expense-2')).toBeTruthy();
  });

  it('does not show edited badge for non-edited expenses', () => {
    const { queryByTestId, getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    // expense-1 has is_edited = false
    expect(queryByTestId('edited-badge-expense-1')).toBeNull();
  });

  it('dims settled expenses', () => {
    setupGroupQuery(BASE_GROUP, EXPENSES, SETTLED_BALANCES_DATA);
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    const card = getByTestId('expense-card-expense-1');
    expect(card.props.style).toMatchObject(expect.objectContaining({ opacity: 0.5 }));
  });

  it('does not dim unsettled expenses', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    const card = getByTestId('expense-card-expense-1');
    // opacity should be 1 (not dimmed)
    expect(card.props.style).not.toMatchObject(expect.objectContaining({ opacity: 0.5 }));
  });
});

describe('ExpensesTab — Unsettled filter', () => {
  it('shows unsettled expenses with Unsettled filter', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    fireEvent.press(getByTestId('filter-unsettled'));
    // With non-zero balances, expenses are unsettled
    expect(getByTestId('expense-card-expense-1')).toBeTruthy();
    expect(getByTestId('expense-card-expense-2')).toBeTruthy();
  });

  it('hides all expenses when all are settled with Unsettled filter', () => {
    setupGroupQuery(BASE_GROUP, EXPENSES, SETTLED_BALANCES_DATA);
    const { getByTestId, queryByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    fireEvent.press(getByTestId('filter-unsettled'));
    // With zero balances, expenses are settled and hidden from Unsettled filter
    expect(queryByTestId('expense-card-expense-1')).toBeNull();
    expect(queryByTestId('expense-card-expense-2')).toBeNull();
  });
});

describe('ExpensesTab — navigation to edit', () => {
  it('tapping expense card navigates to edit-expense screen', () => {
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    fireEvent.press(getByTestId('expense-card-expense-1'));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining(`/group/${GROUP_ID}/edit-expense`)
    );
  });
});

describe('ExpensesTab — empty state', () => {
  it('shows empty state when no expenses', () => {
    setupGroupQuery(BASE_GROUP, [], BALANCES_DATA);
    const { getByTestId } = render(<GroupDetailScreen />);
    fireEvent.press(getByTestId('tab-expenses'));
    expect(getByTestId('expenses-empty-state')).toBeTruthy();
  });
});
