import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CreateGroupScreen from '../create';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockCreateGroup = jest.fn();
const mockInvalidateQueries = jest.fn();

let mockProfile: { display_name: string; preferred_currency?: string } = {
  display_name: 'Test User',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('../../../lib/repos/groups', () => ({
  createGroup: (...args: unknown[]) => mockCreateGroup(...args),
}));

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    session: {
      user: { id: 'user-1', email: 'test@example.com' },
    },
    profile: mockProfile,
  }),
}));

jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: () => null,
  Defs: () => null,
  LinearGradient: () => null,
  Stop: () => null,
  Rect: () => null,
}));

jest.mock('lucide-react-native', () => ({
  X: () => null,
  ChevronLeft: () => null,
  Plane: () => null,
  Home: () => null,
  Heart: () => null,
  Zap: () => null,
  Users: () => null,
  Grid3X3: () => null,
  Plus: () => null,
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
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

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateGroup.mockResolvedValue({ id: 'group-123', name: 'Test Group' });
  mockProfile = { display_name: 'Test User' };
});

describe('CreateGroupScreen — Step 1 (Type selection)', () => {
  it('renders all six group type options', () => {
    const { getByText } = render(<CreateGroupScreen />);
    ['Trip', 'Home', 'Couple', 'Utilities', 'Family', 'Other'].forEach((type) => {
      expect(getByText(type)).toBeTruthy();
    });
  });

  it('Next button is disabled when no type is selected', () => {
    const { getByTestId } = render(<CreateGroupScreen />);
    expect(getByTestId('next-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('Next button enables after selecting a type', () => {
    const { getByText, getByTestId } = render(<CreateGroupScreen />);
    fireEvent.press(getByText('Home'));
    expect(getByTestId('next-button').props.accessibilityState?.disabled).not.toBe(true);
  });

  it('advances to step 2 after selecting a type and tapping Next', () => {
    const { getByText, getByTestId } = render(<CreateGroupScreen />);
    fireEvent.press(getByText('Trip'));
    fireEvent.press(getByTestId('next-button'));
    expect(getByText('Group details')).toBeTruthy();
  });
});

describe('CreateGroupScreen — Step 2 (Details)', () => {
  function advanceToStep2(type = 'Home') {
    const utils = render(<CreateGroupScreen />);
    fireEvent.press(utils.getByText(type));
    fireEvent.press(utils.getByTestId('next-button'));
    return utils;
  }

  it('Next is disabled when name is empty', () => {
    const { getByTestId } = advanceToStep2();
    expect(getByTestId('next-button').props.accessibilityState?.disabled).toBe(true);
  });

  it('Next enables when name is non-empty', () => {
    const { getByTestId, getByPlaceholderText } = advanceToStep2();
    fireEvent.changeText(getByPlaceholderText('Group name'), 'My Group');
    expect(getByTestId('next-button').props.accessibilityState?.disabled).not.toBe(true);
  });

  it('shows character counter starting at 0/30', () => {
    const { getByText } = advanceToStep2();
    expect(getByText('0/30')).toBeTruthy();
  });

  it('updates character counter as user types', () => {
    const { getByText, getByPlaceholderText } = advanceToStep2();
    fireEvent.changeText(getByPlaceholderText('Group name'), 'Hi');
    expect(getByText('2/30')).toBeTruthy();
  });

  it('shows date fields for Trip type', () => {
    const { getByTestId } = advanceToStep2('Trip');
    expect(getByTestId('start-date-input')).toBeTruthy();
    expect(getByTestId('end-date-input')).toBeTruthy();
  });

  it('does not show date fields for non-Trip types', () => {
    const { queryByTestId } = advanceToStep2('Home');
    expect(queryByTestId('start-date-input')).toBeNull();
    expect(queryByTestId('end-date-input')).toBeNull();
  });

  it('Trip Next enables once name is entered (dates are pre-initialized)', () => {
    const { getByTestId, getByPlaceholderText } = advanceToStep2('Trip');
    expect(getByTestId('next-button').props.accessibilityState?.disabled).toBe(true);
    fireEvent.changeText(getByPlaceholderText('Group name'), 'Ski Trip');
    expect(getByTestId('next-button').props.accessibilityState?.disabled).not.toBe(true);
  });

  it('Trip date fields are tappable buttons (not free-text inputs)', () => {
    const { getByTestId } = advanceToStep2('Trip');
    // TextInputs have onChangeText; buttons do not
    expect(getByTestId('start-date-input').props.onChangeText).toBeUndefined();
    expect(getByTestId('end-date-input').props.onChangeText).toBeUndefined();
    // They must be pressable (no throw)
    expect(() => fireEvent.press(getByTestId('start-date-input'))).not.toThrow();
    expect(() => fireEvent.press(getByTestId('end-date-input'))).not.toThrow();
  });

  it('defaults currency to EUR when profile has no preferred_currency', () => {
    mockProfile = { display_name: 'Test User' };
    const { getByTestId } = advanceToStep2();
    expect(getByTestId('currency-EUR').props.accessibilityState?.selected).toBe(true);
  });

  it('pre-selects currency from profile preferred_currency', () => {
    mockProfile = { display_name: 'Test User', preferred_currency: 'SEK' };
    const { getByTestId } = advanceToStep2();
    expect(getByTestId('currency-SEK').props.accessibilityState?.selected).toBe(true);
  });

  it('shows Back label on step 2', () => {
    const { getByText } = advanceToStep2();
    expect(getByText('Back')).toBeTruthy();
  });
});

describe('CreateGroupScreen — Step 3 (Members & Create)', () => {
  function advanceToStep3(type = 'Home') {
    const utils = render(<CreateGroupScreen />);
    fireEvent.press(utils.getByText(type));
    fireEvent.press(utils.getByTestId('next-button'));
    fireEvent.changeText(utils.getByPlaceholderText('Group name'), 'My Group');
    fireEvent.press(utils.getByTestId('next-button'));
    return utils;
  }

  it('shows Create Group button on step 3', () => {
    const { getByTestId } = advanceToStep3();
    expect(getByTestId('create-button')).toBeTruthy();
  });

  it('calls createGroup with correct name and type', async () => {
    const { getByTestId } = advanceToStep3();
    fireEvent.press(getByTestId('create-button'));
    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ name: 'My Group', type: 'Home' }),
        expect.objectContaining({ userId: 'user-1', email: 'test@example.com' }),
        [],
      );
    });
  });

  it('invalidates groups query and goes back on success', async () => {
    const { getByTestId } = advanceToStep3();
    fireEvent.press(getByTestId('create-button'));
    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['groups'] });
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('shows error message when createGroup fails', async () => {
    mockCreateGroup.mockRejectedValue(new Error('Server error'));
    const { getByTestId, getByText } = advanceToStep3();
    fireEvent.press(getByTestId('create-button'));
    await waitFor(() => {
      expect(getByText('Something went wrong. Please try again.')).toBeTruthy();
    });
  });

  it('allows adding a member by email', () => {
    const { getByTestId, getByText } = advanceToStep3();
    fireEvent.changeText(getByTestId('email-input'), 'friend@example.com');
    fireEvent.press(getByTestId('add-email-button'));
    expect(getByText('friend@example.com')).toBeTruthy();
  });

  it('includes invited emails when calling createGroup', async () => {
    const { getByTestId } = advanceToStep3();
    fireEvent.changeText(getByTestId('email-input'), 'friend@example.com');
    fireEvent.press(getByTestId('add-email-button'));
    fireEvent.press(getByTestId('create-button'));
    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith(
        {},
        expect.any(Object),
        expect.any(Object),
        ['friend@example.com'],
      );
    });
  });

  it('shows Back label on step 3', () => {
    const { getByText } = advanceToStep3();
    expect(getByText('Back')).toBeTruthy();
  });
});
