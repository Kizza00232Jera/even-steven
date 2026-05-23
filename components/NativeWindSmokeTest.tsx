import { View, Text } from 'react-native';

export function NativeWindSmokeTest() {
  return (
    <View className="bg-surface p-4 rounded-2xl border border-border">
      <Text className="text-text-primary text-lg font-bold">Light: text-primary on surface</Text>
      <Text className="text-accent text-base">Accent color token</Text>
      <View className="bg-surface-2 p-2 rounded-xl mt-2">
        <Text className="text-text-secondary text-sm">
          Dark variant smoke test
        </Text>
      </View>
    </View>
  );
}
