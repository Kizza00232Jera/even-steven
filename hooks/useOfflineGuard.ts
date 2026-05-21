export function useOfflineGuard(isOnline: boolean) {
  return {
    writesDisabled: !isOnline,
    offlineMessage: isOnline ? null : "You're offline. Connect to save changes.",
  };
}
