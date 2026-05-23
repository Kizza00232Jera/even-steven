import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BalancesTab } from '../[id]/balances';

const mockFetchGroupBalances = jest.fn();
const mockRecordSettlement = jest.fn();
const mockFetchGroupSettlements = jest.fn();
const mockVoidSettlement = jest.fn();
const mockShowToast = jest.fn();
const mockHaptic = jest.fn();

jest.mock('../../../lib/repos/balances', () => ({
  fetchGroupBalances: (...args: unknown[]) => mockFetchGroupBalances(...args),
}));

jest.mock('../../../lib/repos/settlements', () => ({
  recordSettlement: (...args: unknown[]) => mockRecordSettlement(...args),
  fetchGroupSettlements: (...args: unknown[]) => mockFetchGroupSettlements(...args),
  voidSettlement: (...args: unknown[]) => mockVoidSettlement(...args),
}));

// Inline channel mock — no outer variable reference (jest.mock is hoisted)
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn(function (this: unknown) { return this; }),
      subscribe: jest.fn(function (this: unknown) { return this; }),
    })),
    removeChannel: jest.fn(),
  },
}));

jest.mock('../../../lib/haptics', () => ({
  hapticOnSettlementRecorded: () => mockHaptic(),
}));

jest.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1' } },
  }),
}));

jest.mock('../../../lib/repos/activity', () => ({
  logActivityEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ success: mockShowToast, error: mockShowToast, info: jest.fn() }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

jest.mock('../../../lib/notifications', () => ({
  sendGroupNotification: jest.fn(),
}));

jest.mock('../../../lib/repos/groups', () => ({
  archiveGroup: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('lucide-react-native', () => ({
  User: () => null,
  Check: () => null,
  X: () => null,
  RotateCcw: () => null,
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const baseMembers = [
  { memberId: 'm-alice', userId: 'u-alice', name: 'Alice', email: 'alice@x.com', avatarUrl: null, balance: 10 },
  { memberId: 'm-bob', userId: 'u-bob', name: 'Bob', email: 'bob@x.com', avatarUrl: null, balance: -10 },
];

describe('BalancesTab', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
    jest.clearAllMocks();
    mockFetchGroupSettlements.mockResolvedValue([]);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('shows skeleton rows while loading', () => {
    mockFetchGroupBalances.mockImplementation(() => new Promise(() => {}));
    const { getAllByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-alice" />
      </Wrapper>
    );
    expect(getAllByTestId('skeleton-balance-row').length).toBeGreaterThan(0);
  });

  it('shows "All settled" when all balances are zero', async () => {
    mockFetchGroupBalances.mockResolvedValue({
      groupId: 'g-1',
      currency: 'EUR',
      members: [
        { memberId: 'm-alice', userId: 'u-alice', name: 'Alice', email: 'a@x.com', avatarUrl: null, balance: 0 },
        { memberId: 'm-bob', userId: 'u-bob', name: 'Bob', email: 'b@x.com', avatarUrl: null, balance: 0 },
      ],
    });
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-alice" />
      </Wrapper>
    );
    await waitFor(() => expect(getByText('All settled')).toBeTruthy());
  });

  it('shows "You owe" when current user is the debtor', async () => {
    mockFetchGroupBalances.mockResolvedValue({
      groupId: 'g-1',
      currency: 'EUR',
      members: baseMembers,
    });
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-bob" />
      </Wrapper>
    );
    await waitFor(() => expect(getByText(/You owe Alice/)).toBeTruthy());
  });

  it('shows creditor name when current user is owed money', async () => {
    mockFetchGroupBalances.mockResolvedValue({
      groupId: 'g-1',
      currency: 'EUR',
      members: baseMembers,
    });
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-alice" />
      </Wrapper>
    );
    await waitFor(() => expect(getByText(/Bob owes you/)).toBeTruthy());
  });

  it('shows third-party debt row with both names', async () => {
    mockFetchGroupBalances.mockResolvedValue({
      groupId: 'g-1',
      currency: 'EUR',
      members: [
        { memberId: 'm-alice', userId: 'u-alice', name: 'Alice', email: 'a@x.com', avatarUrl: null, balance: 10 },
        { memberId: 'm-bob', userId: 'u-bob', name: 'Bob', email: 'b@x.com', avatarUrl: null, balance: -10 },
        { memberId: 'm-carol', userId: 'u-carol', name: 'Carol', email: 'c@x.com', avatarUrl: null, balance: 0 },
      ],
    });
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-carol" />
      </Wrapper>
    );
    await waitFor(() => expect(getByText(/Bob owes Alice/)).toBeTruthy());
  });

  it('formats amount in the group base currency', async () => {
    mockFetchGroupBalances.mockResolvedValue({
      groupId: 'g-1',
      currency: 'EUR',
      members: baseMembers,
    });
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-alice" />
      </Wrapper>
    );
    await waitFor(() => expect(getByText(/€10\.00/)).toBeTruthy());
  });

  it('renders a Settle Up button on each debt row', async () => {
    mockFetchGroupBalances.mockResolvedValue({
      groupId: 'g-1',
      currency: 'EUR',
      members: baseMembers,
    });
    const { getAllByText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-alice" />
      </Wrapper>
    );
    await waitFor(() => expect(getAllByText('Settle Up').length).toBeGreaterThan(0));
  });

  it('opens settlement modal when Settle Up is pressed', async () => {
    mockFetchGroupBalances.mockResolvedValue({
      groupId: 'g-1',
      currency: 'EUR',
      members: baseMembers,
    });
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-alice" />
      </Wrapper>
    );
    await waitFor(() => getByText('Settle Up'));
    fireEvent.press(getByText('Settle Up'));
    expect(getByText('Record Settlement')).toBeTruthy();
  });

  it('calls recordSettlement and shows success toast on submit', async () => {
    mockFetchGroupBalances.mockResolvedValue({
      groupId: 'g-1',
      currency: 'EUR',
      members: baseMembers,
    });
    mockRecordSettlement.mockResolvedValue(undefined);

    const { getByText, getByPlaceholderText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-alice" />
      </Wrapper>
    );
    await waitFor(() => getByText('Settle Up'));
    fireEvent.press(getByText('Settle Up'));
    await waitFor(() => getByText('Record Settlement'));

    const input = getByPlaceholderText('Amount');
    fireEvent.changeText(input, '10.00');
    fireEvent.press(getByText('Record Settlement'));

    await waitFor(() => {
      expect(mockRecordSettlement).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          groupId: 'g-1',
          amount: 10,
          currency: 'EUR',
        })
      );
    });
    expect(mockShowToast).toHaveBeenCalledWith('Settlement recorded');
  });

  it('shows error toast when settlement recording fails', async () => {
    mockFetchGroupBalances.mockResolvedValue({
      groupId: 'g-1',
      currency: 'EUR',
      members: baseMembers,
    });
    mockRecordSettlement.mockRejectedValue(new Error('DB error'));

    const { getByText, getByPlaceholderText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-alice" />
      </Wrapper>
    );
    await waitFor(() => getByText('Settle Up'));
    fireEvent.press(getByText('Settle Up'));
    await waitFor(() => getByText('Record Settlement'));

    const input = getByPlaceholderText('Amount');
    fireEvent.changeText(input, '10.00');
    fireEvent.press(getByText('Record Settlement'));

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/failed/i))
    );
  });

  it('shows error state with retry when fetch fails', async () => {
    mockFetchGroupBalances.mockRejectedValue(new Error('Network error'));
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <BalancesTab groupId="g-1" currentMemberId="m-alice" />
      </Wrapper>
    );
    await waitFor(() => expect(getByText(/retry/i)).toBeTruthy());
  });

  describe('Settlement Correction', () => {
    const sampleSettlement = {
      id: 's-1',
      payerMemberId: 'm-bob',
      payeeMemberId: 'm-alice',
      amount: 10,
      currency: 'EUR',
      recordedBy: 'm-bob',
      createdAt: '2024-01-01T00:00:00Z',
    };

    it('shows recorded settlements when they exist', async () => {
      mockFetchGroupBalances.mockResolvedValue({
        groupId: 'g-1',
        currency: 'EUR',
        members: [
          { memberId: 'm-alice', userId: 'u-alice', name: 'Alice', email: 'a@x.com', avatarUrl: null, balance: 0 },
          { memberId: 'm-bob', userId: 'u-bob', name: 'Bob', email: 'b@x.com', avatarUrl: null, balance: 0 },
        ],
      });
      mockFetchGroupSettlements.mockResolvedValue([sampleSettlement]);

      const { getByText } = render(
        <Wrapper queryClient={queryClient}>
          <BalancesTab groupId="g-1" currentMemberId="m-alice" />
        </Wrapper>
      );
      // currentMemberId is alice (payee), so label should be "Bob paid you"
      await waitFor(() => expect(getByText('Bob paid you')).toBeTruthy());
    });

    it('shows Undo button only on settlements recorded by current user', async () => {
      mockFetchGroupBalances.mockResolvedValue({
        groupId: 'g-1',
        currency: 'EUR',
        members: [
          { memberId: 'm-alice', userId: 'u-alice', name: 'Alice', email: 'a@x.com', avatarUrl: null, balance: 0 },
          { memberId: 'm-bob', userId: 'u-bob', name: 'Bob', email: 'b@x.com', avatarUrl: null, balance: 0 },
        ],
      });
      mockFetchGroupSettlements.mockResolvedValue([sampleSettlement]);

      const { getByText } = render(
        <Wrapper queryClient={queryClient}>
          <BalancesTab groupId="g-1" currentMemberId="m-bob" />
        </Wrapper>
      );
      await waitFor(() => expect(getByText('Undo')).toBeTruthy());
    });

    it('does not show Undo button for settlements recorded by others', async () => {
      mockFetchGroupBalances.mockResolvedValue({
        groupId: 'g-1',
        currency: 'EUR',
        members: [
          { memberId: 'm-alice', userId: 'u-alice', name: 'Alice', email: 'a@x.com', avatarUrl: null, balance: 0 },
          { memberId: 'm-bob', userId: 'u-bob', name: 'Bob', email: 'b@x.com', avatarUrl: null, balance: 0 },
        ],
      });
      mockFetchGroupSettlements.mockResolvedValue([sampleSettlement]);

      const { queryByText, getByText } = render(
        <Wrapper queryClient={queryClient}>
          <BalancesTab groupId="g-1" currentMemberId="m-alice" />
        </Wrapper>
      );
      // Wait for the settlement row to render (Bob paid you — alice is the payee)
      await waitFor(() => expect(getByText(/Bob paid you/)).toBeTruthy());
      expect(queryByText('Undo')).toBeNull();
    });

    it('calls voidSettlement with correct args and shows success toast', async () => {
      mockFetchGroupBalances.mockResolvedValue({
        groupId: 'g-1',
        currency: 'EUR',
        members: [
          { memberId: 'm-alice', userId: 'u-alice', name: 'Alice', email: 'a@x.com', avatarUrl: null, balance: 0 },
          { memberId: 'm-bob', userId: 'u-bob', name: 'Bob', email: 'b@x.com', avatarUrl: null, balance: 0 },
        ],
      });
      mockFetchGroupSettlements.mockResolvedValue([sampleSettlement]);
      mockVoidSettlement.mockResolvedValue(undefined);

      const { getByText } = render(
        <Wrapper queryClient={queryClient}>
          <BalancesTab groupId="g-1" currentMemberId="m-bob" />
        </Wrapper>
      );
      await waitFor(() => getByText('Undo'));
      fireEvent.press(getByText('Undo'));

      await waitFor(() => {
        expect(mockVoidSettlement).toHaveBeenCalledWith(
          expect.anything(),
          's-1',
          'm-bob'
        );
      });
      expect(mockShowToast).toHaveBeenCalledWith('Settlement undone');
    });

    it('shows error toast when void fails', async () => {
      mockFetchGroupBalances.mockResolvedValue({
        groupId: 'g-1',
        currency: 'EUR',
        members: [
          { memberId: 'm-alice', userId: 'u-alice', name: 'Alice', email: 'a@x.com', avatarUrl: null, balance: 0 },
          { memberId: 'm-bob', userId: 'u-bob', name: 'Bob', email: 'b@x.com', avatarUrl: null, balance: 0 },
        ],
      });
      mockFetchGroupSettlements.mockResolvedValue([sampleSettlement]);
      mockVoidSettlement.mockRejectedValue(new Error('DB error'));

      const { getByText } = render(
        <Wrapper queryClient={queryClient}>
          <BalancesTab groupId="g-1" currentMemberId="m-bob" />
        </Wrapper>
      );
      await waitFor(() => getByText('Undo'));
      fireEvent.press(getByText('Undo'));

      await waitFor(() =>
        expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/failed.*undo/i))
      );
    });
  });
});
