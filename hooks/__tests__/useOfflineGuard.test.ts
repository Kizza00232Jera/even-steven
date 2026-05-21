import { renderHook } from '@testing-library/react-native';
import { useOfflineGuard } from '../useOfflineGuard';

describe('useOfflineGuard', () => {
  it('returns writesDisabled false when online', () => {
    const { result } = renderHook(() => useOfflineGuard(true));
    expect(result.current.writesDisabled).toBe(false);
    expect(result.current.offlineMessage).toBeNull();
  });

  it('returns writesDisabled true and a message when offline', () => {
    const { result } = renderHook(() => useOfflineGuard(false));
    expect(result.current.writesDisabled).toBe(true);
    expect(result.current.offlineMessage).toBe("You're offline. Connect to save changes.");
  });
});
