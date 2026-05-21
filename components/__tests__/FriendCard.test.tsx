import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FriendCard } from '../FriendCard';

const baseFriend = {
  friendshipId: 'fs-1',
  friendId: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  avatarUrl: null as string | null,
  totalBalance: 0,
  sharedGroupCount: 0,
};

describe('FriendCard', () => {
  it('renders the friend name', () => {
    const { getByText } = render(<FriendCard friend={baseFriend} onPress={() => {}} />);
    expect(getByText('Alice')).toBeTruthy();
  });

  it('shows "All settled" when balance is zero', () => {
    const { getByText } = render(<FriendCard friend={baseFriend} onPress={() => {}} />);
    expect(getByText('All settled')).toBeTruthy();
  });

  it('shows "Owes you" label when balance is positive', () => {
    const friend = { ...baseFriend, totalBalance: 47, sharedGroupCount: 2 };
    const { getByText } = render(<FriendCard friend={friend} onPress={() => {}} />);
    expect(getByText(/Owes you/)).toBeTruthy();
  });

  it('shows "You owe" label when balance is negative', () => {
    const friend = { ...baseFriend, totalBalance: -12, sharedGroupCount: 1 };
    const { getByText } = render(<FriendCard friend={friend} onPress={() => {}} />);
    expect(getByText(/You owe/)).toBeTruthy();
  });

  it('shows shared group count when multiple groups', () => {
    const friend = { ...baseFriend, totalBalance: 47, sharedGroupCount: 2 };
    const { getByText } = render(<FriendCard friend={friend} onPress={() => {}} />);
    expect(getByText(/2 groups/)).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<FriendCard friend={baseFriend} onPress={onPress} />);
    fireEvent.press(getByText('Alice'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
