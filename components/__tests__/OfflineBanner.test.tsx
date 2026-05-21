import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OfflineBanner } from '../OfflineBanner';

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    const { toJSON } = render(<OfflineBanner isOnline={true} />);
    expect(toJSON()).toBeNull();
  });

  it('shows the offline message when offline', () => {
    render(<OfflineBanner isOnline={false} />);
    expect(screen.getByText("You're offline — showing last known data.")).toBeTruthy();
  });
});
