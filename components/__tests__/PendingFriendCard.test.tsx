import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PendingFriendCard } from '../PendingFriendCard';

const basePending = {
  friendshipId: 'fs-2',
  email: 'bob@example.com',
  createdAt: '2026-05-01T00:00:00Z',
};

describe('PendingFriendCard', () => {
  it('renders the pending email', () => {
    const { getByText } = render(<PendingFriendCard friend={basePending} onRemove={() => {}} />);
    expect(getByText('bob@example.com')).toBeTruthy();
  });

  it('shows a Pending badge', () => {
    const { getByText } = render(<PendingFriendCard friend={basePending} onRemove={() => {}} />);
    expect(getByText('Pending')).toBeTruthy();
  });

  it('calls onRemove when Remove is pressed', () => {
    const onRemove = jest.fn();
    const { getByText } = render(<PendingFriendCard friend={basePending} onRemove={onRemove} />);
    fireEvent.press(getByText('Remove'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
