import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { UserX } from 'lucide-react-native';

export function RemovedMemberState() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(tabs)/groups');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <UserX size={48} color="#FF4444" strokeWidth={1.5} />
      <Text className="text-text-primary text-xl font-semibold mt-6 mb-2 text-center">
        You are no longer a member
      </Text>
      <Text className="text-text-secondary text-sm text-center mb-8">
        You have been removed from this group.
      </Text>
      <Pressable
        onPress={() => router.replace('/(tabs)/groups')}
        className="bg-surface-2 border border-border rounded-full px-8 py-3"
        accessibilityRole="button"
      >
        <Text className="text-text-primary text-sm font-medium">Go to Groups</Text>
      </Pressable>
    </View>
  );
}
