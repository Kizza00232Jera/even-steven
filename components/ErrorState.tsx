import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface ErrorStateProps {
  onRetry: () => void;
  message?: string;
}

export function ErrorState({ onRetry, message = 'Something went wrong' }: ErrorStateProps) {
  return (
    <View className="items-center py-6 px-4">
      <Text className="text-text-secondary text-sm text-center mb-3">{message}</Text>
      <Pressable
        onPress={onRetry}
        className="px-5 py-2 rounded-full border border-border"
        accessibilityRole="button"
      >
        <Text className="text-text-primary text-sm font-medium">Try again</Text>
      </Pressable>
    </View>
  );
}
