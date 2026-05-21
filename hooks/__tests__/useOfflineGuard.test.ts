import { useOfflineGuard } from '../useOfflineGuard';

describe('useOfflineGuard', () => {
  it('returns writesDisabled false when online', () => {
    const guard = useOfflineGuard(true);
    expect(guard.writesDisabled).toBe(false);
    expect(guard.offlineMessage).toBeNull();
  });

  it('returns writesDisabled true and a message when offline', () => {
    const guard = useOfflineGuard(false);
    expect(guard.writesDisabled).toBe(true);
    expect(guard.offlineMessage).toBe("You're offline. Connect to save changes.");
  });
});
