import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { CheckCircle, XCircle, Info } from 'lucide-react-native';

export type ToastVariant = 'success' | 'error' | 'neutral';

interface ToastProps {
  message: string;
  variant: ToastVariant;
  onDismiss: () => void;
}

const DISMISS_AFTER_MS = 3000;

export function Toast({ message, variant, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const Icon = variant === 'success' ? CheckCircle : variant === 'error' ? XCircle : Info;
  const iconColor = variant === 'success' ? '#00C896' : variant === 'error' ? '#FF4444' : '#F59E0B';
  const borderLeftColor = iconColor;

  return (
    <View
      className="flex-row items-center bg-surface-2 border border-border rounded-[14px] px-4 py-3 mx-4"
      style={{ borderLeftWidth: 3, borderLeftColor }}
      accessibilityRole="alert"
    >
      <Icon size={20} color={iconColor} strokeWidth={1.5} style={{ marginRight: 10 }} />
      <Text className="text-text-primary text-sm flex-1">{message}</Text>
    </View>
  );
}
