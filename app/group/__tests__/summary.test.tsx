import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SummaryTab } from '../[id]/summary';

const mockFetchGroupSummary = jest.fn();
const mockChannelOn = jest.fn(function (this: unknown) { return this; });
const mockChannelSubscribe = jest.fn(function (this: unknown) { return this; });

jest.mock('../../../lib/repos/summary', () => ({
  fetchGroupSummary: (...args: unknown[]) => mockFetchGroupSummary(...args),
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
    })),
    removeChannel: jest.fn(),
  },
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

jest.mock('lucide-react-native', () => ({
  User: () => null,
  TrendingUp: () => null,
  PieChart: () => null,
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: () => null,
  Svg: () => null,
  Circle: () => null,
  G: () => null,
  Path: () => null,
  Text: () => null,
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const baseSummary = {
  groupId: 'g-1',
  currency: 'EUR' as const,
  totalSpending: 100,
  memberContributions: [
    { memberId: 'm-alice', name: 'Alice', avatarUrl: null, amount: 70 },
    { memberId: 'm-bob', name: 'Bob', avatarUrl: null, amount: 30 },
  ],
  categoryBreakdown: [
    { category: 'Dining Out', amount: 60, percentage: 60 },
    { category: 'Hotel', amount: 40, percentage: 40 },
  ],
};

describe('SummaryTab', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('shows loading skeleton while fetching', () => {
    mockFetchGroupSummary.mockImplementation(() => new Promise(() => {}));
    const { getAllByTestId } = render(
      <Wrapper queryClient={queryClient}>
        <SummaryTab groupId="g-1" />
      </Wrapper>
    );
    expect(getAllByTestId('skeleton-summary').length).toBeGreaterThan(0);
  });

  it('shows total spending after loading', async () => {
    mockFetchGroupSummary.mockResolvedValue(baseSummary);
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <SummaryTab groupId="g-1" />
      </Wrapper>
    );
    await waitFor(() => expect(getByText(/€100\.00/)).toBeTruthy());
  });

  it('shows each member name in contributions list', async () => {
    mockFetchGroupSummary.mockResolvedValue(baseSummary);
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <SummaryTab groupId="g-1" />
      </Wrapper>
    );
    await waitFor(() => {
      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Bob')).toBeTruthy();
    });
  });

  it('shows each member contribution amount', async () => {
    mockFetchGroupSummary.mockResolvedValue(baseSummary);
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <SummaryTab groupId="g-1" />
      </Wrapper>
    );
    await waitFor(() => {
      expect(getByText(/€70\.00/)).toBeTruthy();
      expect(getByText(/€30\.00/)).toBeTruthy();
    });
  });

  it('shows each category name in the breakdown', async () => {
    mockFetchGroupSummary.mockResolvedValue(baseSummary);
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <SummaryTab groupId="g-1" />
      </Wrapper>
    );
    await waitFor(() => {
      expect(getByText('Dining Out')).toBeTruthy();
      expect(getByText('Hotel')).toBeTruthy();
    });
  });

  it('shows empty state when there are no expenses', async () => {
    mockFetchGroupSummary.mockResolvedValue({
      ...baseSummary,
      totalSpending: 0,
      memberContributions: [],
      categoryBreakdown: [],
    });
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <SummaryTab groupId="g-1" />
      </Wrapper>
    );
    await waitFor(() => expect(getByText(/no expenses/i)).toBeTruthy());
  });

  it('shows error state with retry when fetch fails', async () => {
    mockFetchGroupSummary.mockRejectedValue(new Error('Network error'));
    const { getByText } = render(
      <Wrapper queryClient={queryClient}>
        <SummaryTab groupId="g-1" />
      </Wrapper>
    );
    await waitFor(() => expect(getByText(/retry/i)).toBeTruthy());
  });
});
