import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';

interface Props {
  groupName: string;
  visible: boolean;
  onDismiss: () => void;
}

export function TripExpiredModal({ groupName, visible, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View className="flex-1 items-center justify-center px-8 bg-black/50">
        <View className="bg-surface rounded-2xl p-6 w-full max-w-sm">
          <Text className="font-display text-xl font-semibold text-text-primary mb-3">
            Trip Ended
          </Text>
          <Text className="font-body text-text-secondary mb-6">
            Your trip &ldquo;{groupName}&rdquo; is over. No new expenses can be added. You can still settle up and view the full history.
          </Text>
          <TouchableOpacity
            onPress={onDismiss}
            className="bg-accent rounded-full py-3 items-center"
            activeOpacity={0.8}
          >
            <Text className="font-body text-white font-semibold">Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
