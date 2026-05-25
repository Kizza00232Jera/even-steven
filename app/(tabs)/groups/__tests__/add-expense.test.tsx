import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AddExpenseScreen from '../[id]/add-expense';

const mockBack = jest.fn();
const mockCreateExpense = jest.fn();
const mockFetchGroupMembers = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockFetchRates = jest.fn();
const mockUploadReceipt = jest.fn();
const mockManipulateAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();

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

jest.mock('../../../../lib/repos/expenses', () => ({
  createExpense: (...args: unknown[]) => mockCreateExpense(...args),
  fetchGroupMembers: (...args: unknown[]) => mockFetchGroupMembers(...args),
  uploadReceipt: (...args: unknown[]) => mockUploadReceipt(...args),
}));

const mockChain = {
  select: jest.fn(function (this: unknown) { return this; }),
  eq: jest.fn(function (this: unknown) { return this; }),
  single: jest.fn().mockResolvedValue({ data: { base_currency: 'EUR' }, error: null }),
};

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn(function (this: unknown) { return this; }),
      subscribe: jest.fn(function (this: unknown) { return this; }),
    })),
    removeChannel: jest.fn(),
    from: jest.fn(() => mockChain),
  },
}));

jest.mock('../../../../lib/notifications', () => ({
  sendGroupNotification: jest.fn(),
}));

jest.mock('../../../../hooks/useOfflineGuard', () => ({
  useOfflineGuard: () => ({ writesDisabled: false }),
}));

jest.mock('../../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1', email: 'alice@example.com' } },
    profile: { preferred_currency: 'EUR', display_name: 'Alice' },
  }),
}));

jest.mock('../../../../store/rates', () => ({
  useRatesStore: () => ({
    rates: { USD: 1, EUR: 0.92, DKK: 6.87, SEK: 10.45 },
    fetchRates: mockFetchRates,
  }),
}));

jest.mock('../../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  useQuery: jest.fn(({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    queryFn();
    return { data: MEMBERS, isLoading: false, isError: false };
  }),
}));

jest.mock('../../../../lib/haptics', () => ({
  hapticOnExpenseSaved: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  X: () => null,
  ChevronDown: () => null,
  Check: () => null,
  Camera: () => null,
  Paperclip: () => null,
}));

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: (...args: unknown[]) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: 'jpeg' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateExpense.mockResolvedValue({ id: 'expense-1' });
  mockFetchGroupMembers.mockResolvedValue(MEMBERS);
  mockUploadReceipt.mockResolvedValue('https://example.com/receipt.jpg');
  mockManipulateAsync.mockResolvedValue({ uri: 'compressed://picked.jpg' });
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://picked.jpg', width: 1200, height: 900 }],
  });
  mockLaunchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://camera.jpg', width: 1200, height: 900 }],
  });
});

describe('AddExpenseScreen — form defaults', () => {
  it('shows today as the default date', () => {
    const { getByTestId, getByText } = render(<AddExpenseScreen />);
    expect(getByTestId('date-input')).toBeTruthy();
    const formattedToday = new Date(TODAY + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    expect(getByText(formattedToday)).toBeTruthy();
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
  it('date input is a pressable button (not a free-text field)', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    const dateInput = getByTestId('date-input');
    expect(dateInput.props.onChangeText).toBeUndefined();
    expect(() => fireEvent.press(dateInput)).not.toThrow();
  });

  it('shows today as the default date after rendering', () => {
    const { getByTestId, getByText } = render(<AddExpenseScreen />);
    expect(getByTestId('date-input')).toBeTruthy();
    const formattedToday = new Date(TODAY + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    expect(getByText(formattedToday)).toBeTruthy();
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

  it('passes expense_id in notification metadata after save', async () => {
    const { sendGroupNotification } = jest.requireMock('../../../../lib/notifications') as { sendGroupNotification: jest.Mock };
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Lunch');
    fireEvent.changeText(getByTestId('amount-input'), '25');
    fireEvent.press(getByTestId('save-button'));
    await waitFor(() =>
      expect(sendGroupNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ expense_id: 'expense-1' }),
        })
      )
    );
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

describe('AddExpenseScreen — split mode selector', () => {
  it('renders Equal, Unequal, and Percentage mode buttons', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    expect(getByTestId('split-mode-equal')).toBeTruthy();
    expect(getByTestId('split-mode-unequal')).toBeTruthy();
    expect(getByTestId('split-mode-percentage')).toBeTruthy();
  });

  it('defaults to Equal mode', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    expect(getByTestId('split-mode-equal').props.accessibilityState?.selected).toBe(true);
    expect(getByTestId('split-mode-unequal').props.accessibilityState?.selected).toBe(false);
    expect(getByTestId('split-mode-percentage').props.accessibilityState?.selected).toBe(false);
  });

  it('switches to Unequal mode on press', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-unequal'));
    expect(getByTestId('split-mode-unequal').props.accessibilityState?.selected).toBe(true);
    expect(getByTestId('split-mode-equal').props.accessibilityState?.selected).toBe(false);
  });

  it('switches to Percentage mode on press', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-percentage'));
    expect(getByTestId('split-mode-percentage').props.accessibilityState?.selected).toBe(true);
  });
});

describe('AddExpenseScreen — unequal split mode', () => {
  it('shows amount input for each non-payer participant in Unequal mode', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-unequal'));
    expect(getByTestId('member-amount-member-2')).toBeTruthy();
  });

  it('shows payer remainder display in Unequal mode', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('amount-input'), '100');
    fireEvent.press(getByTestId('split-mode-unequal'));
    expect(getByTestId('payer-remainder-display')).toBeTruthy();
  });

  it('payer remainder decreases as other participant amounts are entered', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('amount-input'), '100');
    fireEvent.press(getByTestId('split-mode-unequal'));
    fireEvent.changeText(getByTestId('member-amount-member-2'), '30');
    const remainder = getByTestId('payer-remainder-display');
    expect(remainder.props.children).toBe('70.00');
  });

  it('payer checkbox is disabled in Unequal mode', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-unequal'));
    const payerCheckbox = getByTestId('participant-checkbox-member-1');
    expect(payerCheckbox.props.disabled).toBe(true);
  });

  it('saves with unequal split_method and correct shares', async () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Dinner');
    fireEvent.changeText(getByTestId('amount-input'), '100');
    fireEvent.press(getByTestId('split-mode-unequal'));
    fireEvent.changeText(getByTestId('member-amount-member-2'), '30');
    fireEvent.press(getByTestId('save-button'));

    await waitFor(() =>
      expect(mockCreateExpense).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ split_method: 'unequal' }),
        expect.arrayContaining([
          expect.objectContaining({ memberId: 'member-2', share: 30 }),
          expect.objectContaining({ memberId: 'member-1', share: 70 }),
        ])
      )
    );
  });

  it('disables save when a non-payer amount is negative', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Dinner');
    fireEvent.changeText(getByTestId('amount-input'), '100');
    fireEvent.press(getByTestId('split-mode-unequal'));
    fireEvent.changeText(getByTestId('member-amount-member-2'), '-10');
    expect(getByTestId('save-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('disables save when other amounts exceed the total (payer share would be negative)', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Dinner');
    fireEvent.changeText(getByTestId('amount-input'), '100');
    fireEvent.press(getByTestId('split-mode-unequal'));
    fireEvent.changeText(getByTestId('member-amount-member-2'), '110');
    expect(getByTestId('save-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('clears unequal amounts when switching back to Equal mode', () => {
    const { getByTestId, queryByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-unequal'));
    fireEvent.changeText(getByTestId('member-amount-member-2'), '30');
    fireEvent.press(getByTestId('split-mode-equal'));
    // Switching back hides amount inputs
    expect(queryByTestId('member-amount-member-2')).toBeNull();
  });
});

describe('AddExpenseScreen — percentage split mode', () => {
  it('shows percentage input for each non-payer participant in Percentage mode', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-percentage'));
    expect(getByTestId('member-percentage-member-2')).toBeTruthy();
  });

  it('shows payer percentage remainder display', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-percentage'));
    expect(getByTestId('payer-percentage-display')).toBeTruthy();
    expect(getByTestId('payer-percentage-display').props.children).toBe('100.00%');
  });

  it('payer percentage remainder decreases as others get percentages', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-percentage'));
    fireEvent.changeText(getByTestId('member-percentage-member-2'), '40');
    const display = getByTestId('payer-percentage-display');
    expect(display.props.children).toBe('60.00%');
  });

  it('payer checkbox is disabled in Percentage mode', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-percentage'));
    expect(getByTestId('participant-checkbox-member-1').props.disabled).toBe(true);
  });

  it('saves with percentage split_method and correct shares', async () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Dinner');
    fireEvent.changeText(getByTestId('amount-input'), '200');
    fireEvent.press(getByTestId('split-mode-percentage'));
    fireEvent.changeText(getByTestId('member-percentage-member-2'), '25');
    fireEvent.press(getByTestId('save-button'));

    await waitFor(() =>
      expect(mockCreateExpense).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ split_method: 'percentage' }),
        expect.arrayContaining([
          expect.objectContaining({ memberId: 'member-2', share: 50 }),
          expect.objectContaining({ memberId: 'member-1', share: 150 }),
        ])
      )
    );
  });

  it('disables save when a percentage is negative', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Dinner');
    fireEvent.changeText(getByTestId('amount-input'), '100');
    fireEvent.press(getByTestId('split-mode-percentage'));
    fireEvent.changeText(getByTestId('member-percentage-member-2'), '-10');
    expect(getByTestId('save-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('disables save when percentages exceed 100 (payer percentage would be negative)', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Dinner');
    fireEvent.changeText(getByTestId('amount-input'), '100');
    fireEvent.press(getByTestId('split-mode-percentage'));
    fireEvent.changeText(getByTestId('member-percentage-member-2'), '110');
    expect(getByTestId('save-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('clears percentage amounts when switching to Unequal mode', () => {
    const { getByTestId, queryByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('split-mode-percentage'));
    fireEvent.changeText(getByTestId('member-percentage-member-2'), '40');
    fireEvent.press(getByTestId('split-mode-unequal'));
    expect(queryByTestId('member-percentage-member-2')).toBeNull();
  });
});

describe('AddExpenseScreen — receipt attachment', () => {
  it('shows receipt-attach-button', () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    expect(getByTestId('receipt-attach-button')).toBeTruthy();
  });

  it('shows action sheet when receipt-attach-button is pressed', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.press(getByTestId('receipt-attach-button'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Attach Receipt',
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ text: 'Take Photo' }),
        expect.objectContaining({ text: 'Choose from Library' }),
        expect.objectContaining({ text: 'Cancel' }),
      ])
    );
    alertSpy.mockRestore();
  });

  it('shows thumbnail after picking from library', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId, queryByTestId } = render(<AddExpenseScreen />);

    expect(queryByTestId('receipt-thumbnail')).toBeNull();
    fireEvent.press(getByTestId('receipt-attach-button'));

    const [, , buttons] = alertSpy.mock.calls[0] as [
      string,
      string | undefined,
      { text: string; onPress?: () => void }[],
    ];
    await waitFor(async () => {
      await buttons.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });

    await waitFor(() => expect(getByTestId('receipt-thumbnail')).toBeTruthy());
    alertSpy.mockRestore();
  });

  it('shows thumbnail after taking photo with camera', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId, queryByTestId } = render(<AddExpenseScreen />);

    expect(queryByTestId('receipt-thumbnail')).toBeNull();
    fireEvent.press(getByTestId('receipt-attach-button'));

    const [, , buttons] = alertSpy.mock.calls[0] as [
      string,
      string | undefined,
      { text: string; onPress?: () => void }[],
    ];
    await waitFor(async () => {
      await buttons.find((b) => b.text === 'Take Photo')?.onPress?.();
    });

    await waitFor(() => expect(getByTestId('receipt-thumbnail')).toBeTruthy());
    alertSpy.mockRestore();
  });

  it('shows receipt-remove-button after picking image', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<AddExpenseScreen />);

    fireEvent.press(getByTestId('receipt-attach-button'));
    const [, , buttons] = alertSpy.mock.calls[0] as [
      string,
      string | undefined,
      { text: string; onPress?: () => void }[],
    ];
    await waitFor(async () => {
      await buttons.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });

    await waitFor(() => expect(getByTestId('receipt-remove-button')).toBeTruthy());
    alertSpy.mockRestore();
  });

  it('removes thumbnail when receipt-remove-button is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId, queryByTestId } = render(<AddExpenseScreen />);

    fireEvent.press(getByTestId('receipt-attach-button'));
    const [, , buttons] = alertSpy.mock.calls[0] as [
      string,
      string | undefined,
      { text: string; onPress?: () => void }[],
    ];
    await waitFor(async () => {
      await buttons.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });
    await waitFor(() => expect(getByTestId('receipt-thumbnail')).toBeTruthy());

    fireEvent.press(getByTestId('receipt-remove-button'));
    expect(queryByTestId('receipt-thumbnail')).toBeNull();
    alertSpy.mockRestore();
  });

  it('saves without receipt_url when no image attached', async () => {
    const { getByTestId } = render(<AddExpenseScreen />);
    fireEvent.changeText(getByTestId('title-input'), 'Lunch');
    fireEvent.changeText(getByTestId('amount-input'), '25');
    fireEvent.press(getByTestId('save-button'));

    await waitFor(() =>
      expect(mockCreateExpense).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ receipt_url: expect.any(String) }),
        expect.any(Array)
      )
    );
    expect(mockUploadReceipt).not.toHaveBeenCalled();
  });

  it('uploads receipt and saves with receipt_url when image is attached', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<AddExpenseScreen />);

    fireEvent.changeText(getByTestId('title-input'), 'Lunch');
    fireEvent.changeText(getByTestId('amount-input'), '25');

    fireEvent.press(getByTestId('receipt-attach-button'));
    const [, , buttons] = alertSpy.mock.calls[0] as [
      string,
      string | undefined,
      { text: string; onPress?: () => void }[],
    ];
    await waitFor(async () => {
      await buttons.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });
    await waitFor(() => expect(getByTestId('receipt-thumbnail')).toBeTruthy());

    fireEvent.press(getByTestId('save-button'));

    await waitFor(() => expect(mockUploadReceipt).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockCreateExpense).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ receipt_url: 'https://example.com/receipt.jpg' }),
        expect.any(Array)
      )
    );
    alertSpy.mockRestore();
  });

  it('treats receipt attachment as dirty — shows discard dialog when only a receipt is attached', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<AddExpenseScreen />);

    // Attach receipt
    fireEvent.press(getByTestId('receipt-attach-button'));
    const [, , buttons] = alertSpy.mock.calls[0] as [
      string,
      string | undefined,
      { text: string; onPress?: () => void }[],
    ];
    await waitFor(async () => {
      await buttons.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });
    await waitFor(() => expect(getByTestId('receipt-thumbnail')).toBeTruthy());

    alertSpy.mockReset();

    // Close button — should show discard dialog since receipt was attached (form is dirty)
    fireEvent.press(getByTestId('close-button'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard this expense?',
      expect.any(String),
      expect.any(Array)
    );
    alertSpy.mockRestore();
  });
});
