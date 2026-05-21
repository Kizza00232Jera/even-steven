import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders the error headline', () => {
    const { getByText } = render(<ErrorState onRetry={() => {}} />);
    expect(getByText('Something went wrong')).toBeTruthy();
  });

  it('renders the Try again button', () => {
    const { getByText } = render(<ErrorState onRetry={() => {}} />);
    expect(getByText('Try again')).toBeTruthy();
  });

  it('calls onRetry when Try again is pressed', () => {
    const onRetry = jest.fn();
    const { getByText } = render(<ErrorState onRetry={onRetry} />);
    fireEvent.press(getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a custom message when provided', () => {
    const { getByText } = render(
      <ErrorState onRetry={() => {}} message="Custom error" />
    );
    expect(getByText('Custom error')).toBeTruthy();
  });
});
