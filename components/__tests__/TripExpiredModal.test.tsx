import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TripExpiredModal } from '../TripExpiredModal';

describe('TripExpiredModal', () => {
  it('renders the trip name', () => {
    const { getByText } = render(
      <TripExpiredModal groupName="Tokyo 2025" visible onDismiss={() => {}} />
    );
    expect(getByText(/Tokyo 2025/)).toBeTruthy();
  });

  it('renders the expiry message', () => {
    const { getByText } = render(
      <TripExpiredModal groupName="Tokyo 2025" visible onDismiss={() => {}} />
    );
    expect(getByText(/No new expenses can be added/i)).toBeTruthy();
  });

  it('calls onDismiss when Got it is pressed', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <TripExpiredModal groupName="Tokyo 2025" visible onDismiss={onDismiss} />
    );
    fireEvent.press(getByText('Got it'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(
      <TripExpiredModal groupName="Tokyo 2025" visible={false} onDismiss={() => {}} />
    );
    expect(queryByText('Got it')).toBeNull();
  });
});
