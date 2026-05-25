import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import InviteScreen from '../[token]';

const mockReplace = jest.fn();
const mockPush    = jest.fn();
const mockRouter  = { replace: mockReplace, push: mockPush };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ token: 'test-token-123' }),
}));

jest.mock('../../../lib/repos/invites', () => ({
  lookupInviteToken: jest.fn(),
  acceptInvite: jest.fn(),
}));

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../../../store/auth', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

jest.mock('lucide-react-native', () => ({
  Users: () => null,
  Calendar: () => null,
  AlertCircle: () => null,
}));

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getBadgeCountAsync: jest.fn().mockResolvedValue(0),
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationHandler: jest.fn(),
}));

import { lookupInviteToken, acceptInvite } from '../../../lib/repos/invites';
import { useAuthStore } from '../../../store/auth';

const mockLookup = lookupInviteToken as jest.Mock;
const mockAccept = acceptInvite as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

const validTokenDetails = {
  valid: true,
  group_id: 'group-abc',
  group_name: 'Summer Vibes',
  group_type: 'Trip',
  start_date: '2026-07-01',
  end_date: '2026-07-07',
  member_count: 3,
  inviter_name: 'Antonio',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuthStore.mockReturnValue({
    session: { user: { id: 'user-1', email: 'bob@example.com' } },
    profile: { display_name: 'Bob' },
    setPendingInviteToken: jest.fn(),
  });
});

describe('InviteScreen — valid token', () => {
  beforeEach(() => {
    mockLookup.mockResolvedValue(validTokenDetails);
    mockAccept.mockResolvedValue('group-abc');
  });

  it('shows inviter name and group name after loading', async () => {
    const { getByText } = render(<InviteScreen />);
    await waitFor(() => {
      expect(getByText('Antonio invited you to join')).toBeTruthy();
      expect(getByText('Summer Vibes')).toBeTruthy();
    });
  });

  it('shows member count', async () => {
    const { getByText } = render(<InviteScreen />);
    await waitFor(() => {
      expect(getByText('3 members')).toBeTruthy();
    });
  });

  it('shows date range for Trip groups', async () => {
    const { getByText } = render(<InviteScreen />);
    await waitFor(() => {
      expect(getByText('Jul 1 – Jul 7, 2026')).toBeTruthy();
    });
  });

  it('accepts the invite and navigates to group on Accept', async () => {
    const { getByTestId } = render(<InviteScreen />);
    await waitFor(() => getByTestId('accept-button'));

    fireEvent.press(getByTestId('accept-button'));

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith(
        expect.anything(),
        'group-abc',
        'user-1',
        'bob@example.com',
      );
      expect(mockReplace).toHaveBeenCalledWith('/group/group-abc');
    });
  });

  it('navigates to Groups tab on Decline', async () => {
    const { getByTestId } = render(<InviteScreen />);
    await waitFor(() => getByTestId('decline-button'));

    fireEvent.press(getByTestId('decline-button'));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/groups');
  });
});

describe('InviteScreen — Trip group without dates', () => {
  it('hides date range for non-Trip groups', async () => {
    mockLookup.mockResolvedValue({
      ...validTokenDetails,
      group_type: 'Home',
      start_date: null,
      end_date: null,
    });

    const { queryByText } = render(<InviteScreen />);
    await waitFor(() => queryByText('Summer Vibes'));

    // Should not show any date text
    expect(queryByText(/Jul/)).toBeNull();
  });
});

describe('InviteScreen — invalid / expired token', () => {
  it('shows error state for an invalidated token', async () => {
    mockLookup.mockResolvedValue(null);

    const { getByText } = render(<InviteScreen />);
    await waitFor(() => {
      expect(getByText('This invite link is no longer valid.')).toBeTruthy();
    });
  });

  it('shows an Open Even Steven button on error', async () => {
    mockLookup.mockResolvedValue(null);

    const { getByTestId } = render(<InviteScreen />);
    await waitFor(() => getByTestId('open-app-button'));

    fireEvent.press(getByTestId('open-app-button'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/groups');
  });
});

describe('InviteScreen — loading state', () => {
  it('shows loading indicator while fetching', () => {
    // mockLookup never resolves during this test
    mockLookup.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(<InviteScreen />);
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });
});

describe('InviteScreen — unauthenticated user', () => {
  it('shows the invite info without crashing when not logged in', async () => {
    mockUseAuthStore.mockReturnValue({ session: null, profile: null, setPendingInviteToken: jest.fn() });
    mockLookup.mockResolvedValue(validTokenDetails);

    const { getByText } = render(<InviteScreen />);
    await waitFor(() => {
      expect(getByText('Summer Vibes')).toBeTruthy();
    });
  });

  it('navigates to auth on Accept when not logged in', async () => {
    mockUseAuthStore.mockReturnValue({ session: null, profile: null, setPendingInviteToken: jest.fn() });
    mockLookup.mockResolvedValue(validTokenDetails);

    const { getByTestId } = render(<InviteScreen />);
    await waitFor(() => getByTestId('accept-button'));

    fireEvent.press(getByTestId('accept-button'));

    expect(mockReplace).toHaveBeenCalledWith('/(auth)');
  });
});
