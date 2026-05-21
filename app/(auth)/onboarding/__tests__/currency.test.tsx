import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CurrencyScreen from '../currency';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('../../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1' } },
    profile: { id: 'user-1', display_name: 'Antonio', onboarding_done: false },
    setProfile: jest.fn(),
  }),
}));

jest.mock('../../../../lib/repos/profiles', () => ({
  updateProfile: jest.fn().mockResolvedValue({
    id: 'user-1',
    display_name: 'Antonio',
    preferred_currency: 'EUR',
    onboarding_done: true,
  }),
}));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {},
}));

describe('CurrencyScreen', () => {
  it('renders all four currency options', () => {
    const { getByText } = render(<CurrencyScreen />);
    expect(getByText('USD')).toBeTruthy();
    expect(getByText('EUR')).toBeTruthy();
    expect(getByText('DKK')).toBeTruthy();
    expect(getByText('SEK')).toBeTruthy();
  });

  it('has the Continue button disabled when no currency is selected', () => {
    const { getByTestId } = render(<CurrencyScreen />);
    const button = getByTestId('continue-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables the Continue button after selecting a currency', () => {
    const { getByText, getByTestId } = render(<CurrencyScreen />);
    fireEvent.press(getByText('EUR'));
    const button = getByTestId('continue-button');
    expect(button.props.accessibilityState?.disabled).not.toBe(true);
  });
});
