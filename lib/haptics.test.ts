import * as Haptics from 'expo-haptics';
import {
  hapticOnExpenseSaved,
  hapticOnSettlementRecorded,
  hapticOnExpenseDeleted,
  hapticOnGroupDeleted,
  hapticOnGroupPin,
  hapticOnToggle,
} from './haptics';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

const mockImpact = Haptics.impactAsync as jest.Mock;
const mockNotification = Haptics.notificationAsync as jest.Mock;
const mockSelection = Haptics.selectionAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('hapticOnExpenseSaved', () => {
  it('calls impactAsync with Medium', () => {
    hapticOnExpenseSaved();
    expect(mockImpact).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });
});

describe('hapticOnSettlementRecorded', () => {
  it('calls impactAsync with Medium', () => {
    hapticOnSettlementRecorded();
    expect(mockImpact).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });
});

describe('hapticOnExpenseDeleted', () => {
  it('calls notificationAsync with Warning', () => {
    hapticOnExpenseDeleted();
    expect(mockNotification).toHaveBeenCalledTimes(1);
    expect(mockNotification).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
  });
});

describe('hapticOnGroupDeleted', () => {
  it('calls notificationAsync with Warning', () => {
    hapticOnGroupDeleted();
    expect(mockNotification).toHaveBeenCalledTimes(1);
    expect(mockNotification).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
  });
});

describe('hapticOnGroupPin', () => {
  it('calls impactAsync with Light', () => {
    hapticOnGroupPin();
    expect(mockImpact).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });
});

describe('hapticOnToggle', () => {
  it('calls selectionAsync', () => {
    hapticOnToggle();
    expect(mockSelection).toHaveBeenCalledTimes(1);
  });
});
