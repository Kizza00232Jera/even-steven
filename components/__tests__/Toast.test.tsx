import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Toast } from '../Toast';

jest.useFakeTimers();

describe('Toast', () => {
  it('renders the message', () => {
    const { getByText } = render(
      <Toast message="Expense saved" variant="success" onDismiss={() => {}} />
    );
    expect(getByText('Expense saved')).toBeTruthy();
  });

  it('calls onDismiss after 3 seconds', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Done" variant="success" onDismiss={onDismiss} />);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not call onDismiss before 3 seconds', () => {
    const onDismiss = jest.fn();
    render(<Toast message="Done" variant="success" onDismiss={onDismiss} />);

    act(() => {
      jest.advanceTimersByTime(2999);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
