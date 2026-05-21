import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AddExpenseScreen from '../[id]/add-expense';

const mockBack = jest.fn();
const mockCreateExpense = jest.fn();
const mockFetchGroupMembers = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockFetchRates = jest.fn();

const TODAY = new Date().toISOString().split('T')[0];

const MEMBERS = [
  {
    id: 'member-1',
    group_id: 'group-1',
    user_id: 'user-1',
    display_name: 'Alice',
    email: 'alice@example.com',
    role: 'admin' as const,
    status: 'active' as const,
    is_pinned: false,
    is_muted: false,
    joined_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'member-2',
    group_id: 'group-1',
    user_id: 'user-2',
    display_name: 'Bob',
    email: 'bob@example.com',
    role: 'member' as const,
    status: 'active' as const,
    is_pinned: false,
    is_muted: false,
    joined_at: '2026-01-02T00:00:00Z',
  },
];

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: 'group-1' }),
}));

jest.mock('../../../lib/repos/expenses', () => ({
  createExpense: (...args: unknown[]) => mockCreateExpense(...args),
  fetchGroupMembers: (...args: unknown[]) => mockFetchGroupMembers(...args),
}));

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1', email: 'alice@example.com' } },
    profile: { preferred_currency: 'EUR', display_name: 'Alice' },
  }),
}));

jest.mock('../../../store/rates', () => ({
  useRatesStore: () => ({
    rates: { USD: 1, EUR: 0.92, DKK: 6.87, SEK: 10.45 },
    fetchRates: mockFetchRates,
  }),
}));

jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useQuery: jest.fn(({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    queryFn();
    return { data: MEMBERS, isLoading: false, isError: false };
  }),
}));

jest.mock('../../../lib/haptics', () => ({
  hapticOnExpenseSaved: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  X: () => null,
  ChevronDown: () => null,
  Check: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateExpense.mockResolvedValue({ id: 'expense-1' });
  mockFetchGroupMembers.mockResolvedValue(MEMBERS);
});

describe('AddExpenseScreen — form defaults', () => {
  it('shows today as the default date', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    const dateInput = getByTestId('date-input');
    expect(dateInput.props.value).toBe(TODAY);
  });

  it('shows all group members pre-selected as participants', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    expect(getByTestId('participant-checkbox-member-1').props.value).toBe(true);
    expect(getByTestId('participant-checkbox-member-2').props.value).toBe(true);
  });

  it('defaults payer to current user member', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    expect(getByTestId('payer-display').props.children).toBe('Alice');
  });

  it('defaults category to Other', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    expect(getByTestId('category-display').props.children).toBe('Other');
  });

  it('defaults currency to user preferred currency', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    expect(getByTestId('currency-display').props.children).toBe('EUR');
  });
});

describe('AddExpenseScreen — title and category auto-detection', () => {
  it('auto-detects category from title keywords and shows suggested badge', () => {
    const { getByTestId, getByText } = render(<AddExpenseScreen />);
    const titleInput = getByTestId('title-input');
    fireEvent.changeText(titleInput, 'taxi to airport');
    expect(getByTestId('category-display').props.children).toBe('Taxi');
    expect(getByText('suggested')).toBeTruthy();
  });

  it('does not show suggested badge for manually selected category', () => {
    const { getByTestId, queryByText } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('category-selector'));
    fireEvent.press(getByTestId('category-option-Groceries'));
    expect(getByTestId('category-display').props.children).toBe('Groceries');
    expect(queryByText('suggested')).toBeNull();
  });

  it('auto-detection stops after manual selection', () => {
    const { getByTestId, queryByText } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('category-selector'));
    fireEvent.press(getByTestId('category-option-Groceries'));
    const titleInput = getByTestId('title-input');
    fireEvent.changeText(titleInput, 'taxi ride');
    expect(getByTestId('category-display').props.children).toBe('Groceries');
    expect(queryByText('suggested')).toBeNull();
  });
});

describe('AddExpenseScreen — date validation', () => {
  it('rejects future dates by clamping to today', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    const dateInput = getByTestId('date-input');
    fireEvent.changeText(dateInput, '2099-12-31');
    fireEvent(dateInput, 'blur');
    expect(getByTestId('date-input').props.value).toBe(TODAY);
  });

  it('accepts today', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    const dateInput = getByTestId('date-input');
    fireEvent.changeText(dateInput, TODAY);
    fireEvent(dateInput, 'blur');
    expect(getByTestId('date-input').props.value).toBe(TODAY);
  });
});

describe('AddExpenseScreen — live conversion', () => {
  it('shows live conversion when amount is entered and currency differs from preferred', () => {
    const { getByTestId, getByText } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('currency-selector'));
    fireEvent.press(getByTestId('currency-option-USD'));
    fireEvent.changeText(getByTestId('amount-input'), '100');
    // 100 USD → EUR: 100 * (0.92/1) = 92.00 → format as €92.00
    expect(getByText(/≈ €92\.00/)).toBeTruthy();
  });

  it('does not show conversion when currency matches preferred currency', () => {
    const { getByTestId, queryByText } = render(<AddExpenseScreen />);
    // EUR is the preferred currency already
    fireEvent.changeText(getByTestId('amount-input'), '100');
    expect(queryByText(/≈/)).toBeNull();
  });
});

describe('AddExpenseScreen — equal split', () => {
  it('saves with equal split shares summing to total', async () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Dinner');
    fireEvent.changeText(getByTestId('amount-input'), '10');
    fireEvent.press(getByTestId('save-button'));

    await waitFor(() => {
      expect(mockCreateExpense).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'Dinner', amount: 10 }),
        expect.arrayContaining([
          expect.objectContaining({ share: expect.any(Number) }),
        ])
      );
    });

    const callArgs = mockCreateExpense.mock.calls[0];
    const splits: { memberId: string; share: number }[] = callArgs[2];
    const total = splits.reduce((sum, s) => sum + s.share, 0);
    expect(Math.round(total * 100) / 100).toBe(10);
  });

  it('payer absorbs remainder (no rounding error)', async () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Coffee');
    fireEvent.changeText(getByTestId('amount-input'), '10');
    fireEvent.press(getByTestId('save-button'));

    await waitFor(() => expect(mockCreateExpense).toHaveBeenCalled());

    const splits: { memberId: string; share: number }[] =
      mockCreateExpense.mock.calls[0][2];
    const payerSplit = splits.find((s) => s.memberId === 'member-1');
    const otherSplit = splits.find((s) => s.memberId === 'member-2');
    // 10/2 = 5.00 exactly — no remainder case
    expect(payerSplit?.share).toBe(5);
    expect(otherSplit?.share).toBe(5);
  });
});

describe('AddExpenseScreen — discard confirmation', () => {
  it('closes without dialog when form is untouched', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('close-button'));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows discard dialog when title has been entered', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Something');
    fireEvent.press(getByTestId('close-button'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard this expense?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Discard' }),
        expect.objectContaining({ text: 'Keep editing' }),
      ])
    );
    alertSpy.mockRestore();
  });
});

describe('AddExpenseScreen — save and navigation', () => {
  it('navigates back after successful save', async () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Lunch');
    fireEvent.changeText(getByTestId('amount-input'), '25');
    fireEvent.press(getByTestId('save-button'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('invalidates group expenses query after save', async () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Lunch');
    fireEvent.changeText(getByTestId('amount-input'), '25');
    fireEvent.press(getByTestId('save-button'));
    await waitFor(() =>
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['expenses', 'group-1'],
      })
    );
  });

  it('disables save button when title is empty', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    const saveButton = getByTestId('save-button');
    expect(saveButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('disables save button when amount is zero', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Lunch');
    const saveButton = getByTestId('save-button');
    expect(saveButton.props.accessibilityState?.disabled).toBe(true);
  });
});
