import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OfflineBanner } from '../OfflineBanner';

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    render(<OfflineBanner isOnline={true} />);
    expect(screen.queryByText(/offline/i)).toBeNull();
  });

  it('shows the offline message when offline', () => {
    render(<OfflineBanner isOnline={false} />);
    expect(screen.getByText("You're offline — showing last known data.")).toBeTruthy();
  });

  it('is not visible when online', () => {
    const { toJSON } = render(<OfflineBanner isOnline={true} />);
    expect(toJSON()).toBeNull();
  });
});
