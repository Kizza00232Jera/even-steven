import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExpenseDetailScreen from '../[id]/expense-detail';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockFetchGroupExpenses = jest.fn();
const mockFetchExpenseParticipants = jest.fn();
const mockFetchGroupMembers = jest.fn();
const mockFetchGroupBalances = jest.fn();

const CURRENT_USER_ID = 'user-1';
const PAYER_USER_ID = 'user-2';
const GROUP_ID = 'group-1';
const EXPENSE_ID = 'expense-1';
const VIEWER_MEMBER_ID = 'member-viewer';
const PAYER_MEMBER_ID = 'member-payer';

const BASE_EXPENSE = {
  id: EXPENSE_ID,
  title: 'Dinner',
  description: null,
  amount: 60,
  currency: 'EUR' as const,
  category: 'Dining Out',
  payer_id: PAYER_MEMBER_ID,
  payer_user_id: PAYER_USER_ID,
  payer_name: 'Bob',
  split_method: 'equal' as const,
  expense_date: '2026-05-15',
  is_edited: false,
  last_edited_by_name: null,
  participant_member_ids: [VIEWER_MEMBER_ID, PAYER_MEMBER_ID],
  receipt_url: null,
};

const MEMBERS = [
  { id: VIEWER_MEMBER_ID, user_id: CURRENT_USER_ID, display_name: 'Alice', email: 'alice@x.com', group_id: GROUP_ID, role: 'member', status: 'active', balance: 0, joined_at: '2026-01-01', is_muted: false },
  { id: PAYER_MEMBER_ID, user_id: PAYER_USER_ID, display_name: 'Bob', email: 'bob@x.com', group_id: GROUP_ID, role: 'member', status: 'active', balance: 0, joined_at: '2026-01-01', is_muted: false },
];

const PARTICIPANTS_WITH_BASE_SHARE = [
  { memberId: VIEWER_MEMBER_ID, shareAmount: 30, baseShareAmount: 30 },
  { memberId: PAYER_MEMBER_ID, shareAmount: 30, baseShareAmount: 30 },
];

const BALANCES_OUTSTANDING = {
  groupId: GROUP_ID,
  currency: 'EUR' as const,
  members: [
    { memberId: VIEWER_MEMBER_ID, userId: CURRENT_USER_ID, name: 'Alice', email: 'alice@x.com', avatarUrl: null, balance: -30 },
    { memberId: PAYER_MEMBER_ID, userId: PAYER_USER_ID, name: 'Bob', email: 'bob@x.com', avatarUrl: null, balance: 30 },
  ],
};

const BALANCES_SETTLED = {
  groupId: GROUP_ID,
  currency: 'EUR' as const,
  members: [
    { memberId: VIEWER_MEMBER_ID, userId: CURRENT_USER_ID, name: 'Alice', email: 'alice@x.com', avatarUrl: null, balance: 0 },
    { memberId: PAYER_MEMBER_ID, userId: PAYER_USER_ID, name: 'Bob', email: 'bob@x.com', avatarUrl: null, balance: 0 },
  ],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({ id: GROUP_ID, expenseId: EXPENSE_ID }),
}));

jest.mock('../../../lib/repos/expenses', () => ({
  fetchGroupExpenses: (...args: unknown[]) => mockFetchGroupExpenses(...args),
  fetchExpenseParticipants: (...args: unknown[]) => mockFetchExpenseParticipants(...args),
}));

jest.mock('../../../lib/repos/groups', () => ({
  fetchGroupMembers: (...args: unknown[]) => mockFetchGroupMembers(...args),
}));

jest.mock('../../../lib/repos/balances', () => ({
  fetchGroupBalances: (...args: unknown[]) => mockFetchGroupBalances(...args),
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {},
}));

jest.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: CURRENT_USER_ID } },
  }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

jest.mock('lucide-react-native', () => ({
  ChevronLeft: () => null,
  Pencil: () => null,
  Receipt: () => null,
  CheckCircle: () => null,
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchGroupExpenses.mockResolvedValue([BASE_EXPENSE]);
  mockFetchExpenseParticipants.mockResolvedValue(PARTICIPANTS_WITH_BASE_SHARE);
  mockFetchGroupMembers.mockResolvedValue(MEMBERS);
  mockFetchGroupBalances.mockResolvedValue(BALANCES_OUTSTANDING);
});

describe('ExpenseDetail — non-payer participant with outstanding balance', () => {
  it('renders Settle Up button', async () => {
    const queryClient = makeQueryClient();
    const { getByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <ExpenseDetailScreen />
      </Wrapper>
    );
    await waitFor(() => expect(getByTestId('settle-up-button')).toBeTruthy());
  });

  it('does not render Settled badge', async () => {
    const queryClient = makeQueryClient();
    const { queryByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <ExpenseDetailScreen />
      </Wrapper>
    );
    await waitFor(() => expect(queryByTestId('settled-badge')).toBeNull());
  });

  it('shows the participant share amount in the group base currency', async () => {
    const queryClient = makeQueryClient();
    const { getByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <ExpenseDetailScreen />
      </Wrapper>
    );
    await waitFor(() => expect(getByTestId('my-share-amount')).toBeTruthy());
  });

  it('navigates to group root using router.replace when Settle Up is pressed', async () => {
    const queryClient = makeQueryClient();
    const { getByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <ExpenseDetailScreen />
      </Wrapper>
    );
    await waitFor(() => getByTestId('settle-up-button'));
    fireEvent.press(getByTestId('settle-up-button'));
    expect(mockReplace).toHaveBeenCalledWith(`/group/${GROUP_ID}` as never);
  });
});

describe('ExpenseDetail — non-payer participant with zero balance (settled)', () => {
  beforeEach(() => {
    mockFetchGroupBalances.mockResolvedValue(BALANCES_SETTLED);
  });

  it('renders Settled badge', async () => {
    const queryClient = makeQueryClient();
    const { getByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <ExpenseDetailScreen />
      </Wrapper>
    );
    await waitFor(() => expect(getByTestId('settled-badge')).toBeTruthy());
  });

  it('does not render Settle Up button', async () => {
    const queryClient = makeQueryClient();
    const { queryByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <ExpenseDetailScreen />
      </Wrapper>
    );
    await waitFor(() => expect(queryByTestId('settle-up-button')).toBeNull());
  });
});

describe('ExpenseDetail — payer sees no Settle Up or Settled badge', () => {
  it('does not render Settle Up button when viewer is the payer', async () => {
    // Current user (VIEWER_MEMBER_ID) is the payer for this expense
    const payerExpense = { ...BASE_EXPENSE, payer_id: VIEWER_MEMBER_ID, payer_user_id: CURRENT_USER_ID };
    mockFetchGroupExpenses.mockResolvedValue([payerExpense]);

    const queryClient = makeQueryClient();
    const { queryByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <ExpenseDetailScreen />
      </Wrapper>
    );
    await waitFor(() => expect(queryByTestId('settle-up-button')).toBeNull());
    expect(queryByTestId('settled-badge')).toBeNull();
  });
});

describe('ExpenseDetail — non-participant sees no Settle Up or Settled badge', () => {
  it('does not render Settle Up button when viewer is not a participant', async () => {
    // Expense that does not include the current user
    const nonParticipantExpense = {
      ...BASE_EXPENSE,
      participant_member_ids: [PAYER_MEMBER_ID, 'member-other'],
    };
    mockFetchGroupExpenses.mockResolvedValue([nonParticipantExpense]);
    mockFetchExpenseParticipants.mockResolvedValue([
      { memberId: PAYER_MEMBER_ID, shareAmount: 30, baseShareAmount: 30 },
      { memberId: 'member-other', shareAmount: 30, baseShareAmount: 30 },
    ]);

    const queryClient = makeQueryClient();
    const { queryByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <ExpenseDetailScreen />
      </Wrapper>
    );
    await waitFor(() => expect(queryByTestId('settle-up-button')).toBeNull());
    expect(queryByTestId('settled-badge')).toBeNull();
  });
});
