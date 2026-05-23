import { renderHook, act } from '@testing-library/react-native';
import { useNetworkStatus } from '../useNetworkStatus';

// Mock @react-native-community/netinfo at the system boundary
let mockNetInfoHandler: ((state: { isConnected: boolean | null }) => void) | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((handler) => {
    mockNetInfoHandler = handler;
    return jest.fn(); // unsubscribe function
  }),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

describe('useNetworkStatus', () => {
  beforeEach(() => {
    mockNetInfoHandler = null;
    jest.clearAllMocks();
    const NetInfo = require('@react-native-community/netinfo');
    NetInfo.addEventListener.mockImplementation((handler: (state: { isConnected: boolean | null }) => void) => {
      mockNetInfoHandler = handler;
      return jest.fn();
    });
    NetInfo.fetch.mockResolvedValue({ isConnected: true });
  });

  it('starts online by default', async () => {
    const { result } = renderHook(() => useNetworkStatus());
    // Initially optimistic — online until proven otherwise
    expect(result.current.isOnline).toBe(true);
  });

  it('returns isOnline false when network is disconnected', async () => {
    const NetInfo = require('@react-native-community/netinfo');
    NetInfo.fetch.mockResolvedValue({ isConnected: false });

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      mockNetInfoHandler?.({ isConnected: false });
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('returns isOnline true when network reconnects', async () => {
    const NetInfo = require('@react-native-community/netinfo');
    NetInfo.fetch.mockResolvedValue({ isConnected: false });

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      mockNetInfoHandler?.({ isConnected: false });
    });
    expect(result.current.isOnline).toBe(false);

    await act(async () => {
      mockNetInfoHandler?.({ isConnected: true });
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('treats null connectivity as offline', async () => {
    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      mockNetInfoHandler?.({ isConnected: null });
    });

    expect(result.current.isOnline).toBe(false);
  });
});
