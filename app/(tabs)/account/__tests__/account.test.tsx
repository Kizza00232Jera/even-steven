import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AccountScreen from '../index';

const mockSignOut = jest.fn();
const mockUpdateProfile = jest.fn();
const mockGetGroupsWithOutstandingBalances = jest.fn();
const mockAnonymiseAccount = jest.fn();
const mockFunctionsInvoke = jest.fn();
const mockSetProfile = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

jest.mock('../../../../store/auth', () => ({
  useAuthStore: () => ({
    session: {
      user: {
        id: 'user-1',
        email: 'test@gmail.com',
        user_metadata: { full_name: 'Test User' },
      },
    },
    profile: {
      id: 'user-1',
      display_name: 'Test User',
      preferred_currency: 'USD',
      avatar_url: null,
      google_avatar_url: null,
    },
    setProfile: mockSetProfile,
  }),
}));

jest.mock('../../../../lib/auth', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock('../../../../lib/repos/profiles', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  uploadProfilePhoto: jest.fn(),
}));

jest.mock('../../../../lib/repos/account', () => ({
  getGroupsWithOutstandingBalances: (...args: unknown[]) =>
    mockGetGroupsWithOutstandingBalances(...args),
  anonymiseAccount: (...args: unknown[]) => mockAnonymiseAccount(...args),
}));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

jest.mock('../../../../lib/displayName', () => ({
  resolveAvatarUrl: () => null,
}));

jest.mock('../../../../lib/haptics', () => ({
  hapticOnToggle: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.setTimeout(30000);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGroupsWithOutstandingBalances.mockResolvedValue([]);
  mockAnonymiseAccount.mockResolvedValue(undefined);
  mockFunctionsInvoke.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue(undefined);
});

describe('AccountScreen — delete account flow', () => {
  it('shows anonymise confirmation when user has no outstanding groups', async () => {
    mockGetGroupsWithOutstandingBalances.mockResolvedValue([]);
    const { getByLabelText, findByText } = render(<AccountScreen />);
    fireEvent.press(getByLabelText('Delete account'));
    await findByText('Anonymise your data?');
  });

  it('shows balance warning when user has groups with outstanding balances', async () => {
    mockGetGroupsWithOutstandingBalances.mockResolvedValue([
      { id: 'g1', name: 'Paris Trip' },
      { id: 'g2', name: 'House Expenses' },
    ]);
    const { getByLabelText, findByText } = render(<AccountScreen />);
    fireEvent.press(getByLabelText('Delete account'));
    await findByText('Outstanding balances');
    await findByText('Paris Trip');
    await findByText('House Expenses');
  });

  it('advances from balance warning to anonymise step on Continue', async () => {
    mockGetGroupsWithOutstandingBalances.mockResolvedValue([
      { id: 'g1', name: 'Paris Trip' },
    ]);
    const { getByLabelText, getByText, findByText } = render(<AccountScreen />);
    fireEvent.press(getByLabelText('Delete account'));
    await findByText('Outstanding balances');
    fireEvent.press(getByText('Continue'));
    await findByText('Anonymise your data?');
  });

  it('calls anonymiseAccount when anonymise step is confirmed', async () => {
    const { getByLabelText, findByText } = render(<AccountScreen />);
    fireEvent.press(getByLabelText('Delete account'));
    await findByText('Anonymise your data?');
    fireEvent.press(getByLabelText('Confirm anonymise account'));
    await waitFor(() =>
      expect(mockAnonymiseAccount).toHaveBeenCalledWith(expect.anything(), 'user-1')
    );
  });

  it('shows full delete confirmation after anonymise completes', async () => {
    const { getByLabelText, findByText } = render(<AccountScreen />);
    fireEvent.press(getByLabelText('Delete account'));
    await findByText('Anonymise your data?');
    fireEvent.press(getByLabelText('Confirm anonymise account'));
    await findByText('Permanently delete account?');
  });

  it('calls delete-account function then signs out when full delete is confirmed', async () => {
    const { getByLabelText, findByText } = render(<AccountScreen />);
    fireEvent.press(getByLabelText('Delete account'));
    await findByText('Anonymise your data?');
    fireEvent.press(getByLabelText('Confirm anonymise account'));
    await findByText('Permanently delete account?');
    fireEvent.press(getByLabelText('Confirm full account deletion'));
    await waitFor(() => expect(mockFunctionsInvoke).toHaveBeenCalledWith('delete-account'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it('shows error in modal when anonymise fails', async () => {
    mockAnonymiseAccount.mockRejectedValue(new Error('Network error'));
    const { getByLabelText, findByText } = render(<AccountScreen />);
    fireEvent.press(getByLabelText('Delete account'));
    await findByText('Anonymise your data?');
    fireEvent.press(getByLabelText('Confirm anonymise account'));
    await findByText('Could not anonymise account. Please try again.');
  });

  it('shows error in modal when full delete fails', async () => {
    mockFunctionsInvoke.mockResolvedValue({ error: new Error('Server error') });
    const { getByLabelText, findByText } = render(<AccountScreen />);
    fireEvent.press(getByLabelText('Delete account'));
    await findByText('Anonymise your data?');
    fireEvent.press(getByLabelText('Confirm anonymise account'));
    await findByText('Permanently delete account?');
    fireEvent.press(getByLabelText('Confirm full account deletion'));
    await findByText('Could not delete account. Please try again.');
  });
});
