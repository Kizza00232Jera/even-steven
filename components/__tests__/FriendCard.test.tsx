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

  it('shows no balance text when balance is zero', () => {
    const { queryByText } = render(<FriendCard friend={baseFriend} onPress={() => {}} />);
    expect(queryByText(/owe/i)).toBeNull();
  });

  it('shows "Owes" amount when balance is positive', () => {
    const friend = { ...baseFriend, totalBalance: 47, sharedGroupCount: 2 };
    const { getByText } = render(<FriendCard friend={friend} onPress={() => {}} />);
    expect(getByText(/Owes/)).toBeTruthy();
  });

  it('shows "You owe" label when balance is negative', () => {
    const friend = { ...baseFriend, totalBalance: -12, sharedGroupCount: 1 };
    const { getByText } = render(<FriendCard friend={friend} onPress={() => {}} />);
    expect(getByText(/You owe/)).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<FriendCard friend={baseFriend} onPress={onPress} />);
    fireEvent.press(getByText('Alice'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
