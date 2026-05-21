import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../lib/toast';
import { Toast } from './Toast';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();

  return (
    <>
      {children}
      {toast && (
        <View
          style={{ position: 'absolute', bottom: insets.bottom + 16, left: 0, right: 0, zIndex: 9999 }}
          pointerEvents="none"
        >
          <Toast key={toast.id} message={toast.message} variant={toast.variant} onDismiss={hide} />
        </View>
      )}
    </>
  );
}
