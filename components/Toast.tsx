import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { CheckCircle, XCircle, Info } from 'lucide-react-native';
import type { ToastVariant } from '../lib/toast';

export type { ToastVariant };

interface ToastProps {
  message: string;
  variant: ToastVariant;
  onDismiss: () => void;
}

const DISMISS_AFTER_MS = 3000;

const VARIANT_CONFIG = {
  success: { Icon: CheckCircle, color: '#00C896' },
  error: { Icon: XCircle, color: '#FF4444' },
  neutral: { Icon: Info, color: '#F59E0B' },
} as const;

export function Toast({ message, variant, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const { Icon, color } = VARIANT_CONFIG[variant];

  return (
    <View
      className="flex-row items-center bg-surface-2 border border-border rounded-[14px] px-4 py-3 mx-4"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
      accessibilityRole="alert"
    >
      <Icon size={20} color={color} strokeWidth={1.5} style={{ marginRight: 10 }} />
      <Text className="text-text-primary text-sm flex-1">{message}</Text>
    </View>
  );
}
