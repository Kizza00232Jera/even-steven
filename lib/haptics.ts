import * as Haptics from 'expo-haptics';

export function hapticOnExpenseSaved(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticOnSettlementRecorded(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticOnExpenseDeleted(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function hapticOnGroupDeleted(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function hapticOnGroupPin(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticOnToggle(): void {
  Haptics.selectionAsync();
}
