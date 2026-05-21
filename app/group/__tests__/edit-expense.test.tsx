import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import EditExpenseScreen from '../[id]/edit-expense';

jest.setTimeout(15000);

const mockBack = jest.fn();
const mockFetchGroupExpenses = jest.fn();
const mockHasGroupSettlements = jest.fn();
const mockUpdateExpenseMetadata = jest.fn();
const mockDeleteExpense = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockUploadReceipt = jest.fn();
const mockManipulateAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();

const EXPENSE_ID = 'expense-1';
const GROUP_ID = 'group-1';
const PAYER_MEMBER_ID = 'member-1';
const OTHER_MEMBER_ID = 'member-2';
const CURRENT_USER_ID = 'user-1';

const BASE_EXPENSE = {
  id: EXPENSE_ID,
  title: 'Dinner at Konoba',
  description: 'Great food',
  amount: 50,
  currency: 'EUR' as const,
  category: 'Dining Out',
  payer_id: PAYER_MEMBER_ID,
  payer_user_id: CURRENT_USER_ID,
  payer_name: 'Alice',
  split_method: 'equal' as const,
  expense_date: '2026-05-01',
  is_edited: false,
  participant_member_ids: [PAYER_MEMBER_ID, OTHER_MEMBER_ID],
  receipt_url: null,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ id: GROUP_ID, expenseId: EXPENSE_ID }),
}));

jest.mock('../../../lib/repos/expenses', () => ({
  fetchGroupExpenses: (...args: unknown[]) => mockFetchGroupExpenses(...args),
  hasGroupSettlements: (...args: unknown[]) => mockHasGroupSettlements(...args),
  updateExpenseMetadata: (...args: unknown[]) => mockUpdateExpenseMetadata(...args),
  deleteExpense: (...args: unknown[]) => mockDeleteExpense(...args),
  uploadReceipt: (...args: unknown[]) => mockUploadReceipt(...args),
}));

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: CURRENT_USER_ID, email: 'alice@example.com' } },
    profile: { preferred_currency: 'EUR', display_name: 'Alice' },
  }),
}));

jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

jest.mock('../../../hooks/useOfflineGuard', () => ({
  useOfflineGuard: () => ({ writesDisabled: false }),
}));

jest.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('../../../lib/haptics', () => ({
  hapticOnExpenseSaved: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  X: () => null,
  ChevronDown: () => null,
  Check: () => null,
  Trash2: () => null,
  AlertCircle: () => null,
  Camera: () => null,
  Paperclip: () => null,
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
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

async function waitForLoaded(getByTestId: (id: string) => unknown) {
  await waitFor(() => getByTestId('save-button'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchGroupExpenses.mockResolvedValue([BASE_EXPENSE]);
  mockHasGroupSettlements.mockResolvedValue(false);
  mockUpdateExpenseMetadata.mockResolvedValue(undefined);
  mockDeleteExpense.mockResolvedValue(undefined);
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

describe('EditExpenseScreen — pre-fill', () => {
  it('pre-fills title from existing expense', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);
    expect(getByTestId('title-input').props.value).toBe('Dinner at Konoba');
  });

  it('pre-fills description from existing expense', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => {
      expect(getByTestId('description-input').props.value).toBe('Great food');
    });
  });

  it('pre-fills category from existing expense', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => {
      expect(getByTestId('category-display').props.children).toBe('Dining Out');
    });
  });

  it('pre-fills amount from existing expense', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-input').props.value).toBe('50');
    });
  });
});

describe('EditExpenseScreen — save metadata', () => {
  it('calls updateExpenseMetadata with updated title and description', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);

    fireEvent.changeText(getByTestId('title-input'), 'Updated Dinner');
    fireEvent.changeText(getByTestId('description-input'), 'Even better');
    fireEvent.press(getByTestId('save-button'));

    await waitFor(() => {
      expect(mockUpdateExpenseMetadata).toHaveBeenCalledWith(
        expect.anything(),
        EXPENSE_ID,
        expect.objectContaining({
          title: 'Updated Dinner',
          description: 'Even better',
          category: 'Dining Out',
        })
      );
    });
  });

  it('navigates back after successful save', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);
    fireEvent.press(getByTestId('save-button'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('invalidates expenses query after save', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);
    fireEvent.press(getByTestId('save-button'));
    await waitFor(() =>
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['expenses', GROUP_ID],
      })
    );
  });
});

describe('EditExpenseScreen — financial edit blocked by settlements', () => {
  beforeEach(() => {
    mockHasGroupSettlements.mockResolvedValue(true);
  });

  it('shows amount-locked notice when group has settlements', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => {
      expect(getByTestId('amount-locked-notice')).toBeTruthy();
    });
  });

  it('amount input is read-only when group has settlements', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);
    expect(getByTestId('amount-input').props.editable).toBe(false);
  });
});

describe('EditExpenseScreen — delete expense', () => {
  it('shows delete button', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => {
      expect(getByTestId('delete-button')).toBeTruthy();
    });
  });

  it('shows delete blocked notice when group has settlements', async () => {
    mockHasGroupSettlements.mockResolvedValue(true);
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => {
      expect(getByTestId('delete-blocked-notice')).toBeTruthy();
    });
  });

  it('delete button is disabled when group has settlements', async () => {
    mockHasGroupSettlements.mockResolvedValue(true);
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);
    expect(getByTestId('delete-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('shows confirmation alert when delete is pressed with no settlements', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);
    fireEvent.press(getByTestId('delete-button'));
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Delete'),
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Delete' }),
        expect.objectContaining({ text: 'Cancel' }),
      ])
    );
    alertSpy.mockRestore();
  });

  it('calls deleteExpense after confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);
    fireEvent.press(getByTestId('delete-button'));
    const [, , buttons] = alertSpy.mock.calls[0] as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];
    buttons.find((b) => b.text === 'Delete')?.onPress?.();
    await waitFor(() => {
      expect(mockDeleteExpense).toHaveBeenCalledWith(expect.anything(), EXPENSE_ID);
    });
    alertSpy.mockRestore();
  });

  it('navigates back after successful delete', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);
    fireEvent.press(getByTestId('delete-button'));
    const [, , buttons] = alertSpy.mock.calls[0] as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];
    buttons.find((b) => b.text === 'Delete')?.onPress?.();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    alertSpy.mockRestore();
  });
});

describe('EditExpenseScreen — receipt thumbnail (existing)', () => {
  it('shows receipt thumbnail when expense has a receipt_url', async () => {
    mockFetchGroupExpenses.mockResolvedValue([
      { ...BASE_EXPENSE, receipt_url: 'https://example.com/old-receipt.jpg' },
    ]);
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => expect(getByTestId('receipt-thumbnail')).toBeTruthy());
  });

  it('does not show receipt thumbnail when expense has no receipt_url', async () => {
    const { queryByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => queryByTestId('save-button'));
    expect(queryByTestId('receipt-thumbnail')).toBeNull();
  });

  it('shows receipt-attach-button', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => expect(getByTestId('receipt-attach-button')).toBeTruthy());
  });
});

describe('EditExpenseScreen — receipt attach and remove', () => {
  it('shows thumbnail after picking from library', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId, queryByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);

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

  it('shows receipt-remove-button when receipt is selected', async () => {
    mockFetchGroupExpenses.mockResolvedValue([
      { ...BASE_EXPENSE, receipt_url: 'https://example.com/receipt.jpg' },
    ]);
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => expect(getByTestId('receipt-remove-button')).toBeTruthy());
  });

  it('removes thumbnail when remove button is pressed', async () => {
    mockFetchGroupExpenses.mockResolvedValue([
      { ...BASE_EXPENSE, receipt_url: 'https://example.com/receipt.jpg' },
    ]);
    const { getByTestId, queryByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => getByTestId('receipt-remove-button'));
    fireEvent.press(getByTestId('receipt-remove-button'));
    expect(queryByTestId('receipt-thumbnail')).toBeNull();
  });

  it('saves with receipt_url: null when receipt was removed', async () => {
    mockFetchGroupExpenses.mockResolvedValue([
      { ...BASE_EXPENSE, receipt_url: 'https://example.com/receipt.jpg' },
    ]);
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitFor(() => getByTestId('receipt-remove-button'));
    fireEvent.press(getByTestId('receipt-remove-button'));
    fireEvent.press(getByTestId('save-button'));

    await waitFor(() =>
      expect(mockUpdateExpenseMetadata).toHaveBeenCalledWith(
        expect.anything(),
        EXPENSE_ID,
        expect.objectContaining({ receipt_url: null })
      )
    );
  });

  it('uploads receipt and saves url when new receipt is attached', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);

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

    await waitFor(() =>
      expect(mockUploadReceipt).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(EXPENSE_ID),
        'compressed://picked.jpg'
      )
    );
    await waitFor(() =>
      expect(mockUpdateExpenseMetadata).toHaveBeenCalledWith(
        expect.anything(),
        EXPENSE_ID,
        expect.objectContaining({ receipt_url: 'https://example.com/receipt.jpg' })
      )
    );
    alertSpy.mockRestore();
  });

  it('does not call uploadReceipt when receipt is unchanged', async () => {
    const { getByTestId } = render(<EditExpenseScreen />);
    await waitForLoaded(getByTestId);
    fireEvent.press(getByTestId('save-button'));
    await waitFor(() => expect(mockUpdateExpenseMetadata).toHaveBeenCalled());
    expect(mockUploadReceipt).not.toHaveBeenCalled();
  });
});
