import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DisplayNameScreen from '../display-name';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('../../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1', user_metadata: { full_name: 'Antonio Test' } } },
    profile: null,
    setProfile: jest.fn(),
  }),
}));

jest.mock('../../../../lib/repos/profiles', () => ({
  updateProfile: jest.fn().mockResolvedValue({
    id: 'user-1',
    display_name: 'Antonio Test',
    preferred_currency: 'USD',
    onboarding_done: false,
  }),
}));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {},
}));

describe('DisplayNameScreen', () => {
  it('renders a text input pre-filled with the Gmail name', () => {
    const { getByDisplayValue } = render(<DisplayNameScreen />);
    expect(getByDisplayValue('Antonio Test')).toBeTruthy();
  });

  it('has the Continue button disabled when the name field is empty', () => {
    const { getByDisplayValue, getByTestId } = render(<DisplayNameScreen />);
    const input = getByDisplayValue('Antonio Test');
    fireEvent.changeText(input, '');
    const button = getByTestId('continue-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('has the Continue button enabled when the name field is non-empty', () => {
    const { getByDisplayValue, getByTestId } = render(<DisplayNameScreen />);
    const input = getByDisplayValue('Antonio Test');
    fireEvent.changeText(input, 'Antonio');
    const button = getByTestId('continue-button');
    expect(button.props.accessibilityState?.disabled).not.toBe(true);
  });
});
