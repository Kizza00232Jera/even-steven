import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ActivityScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <Text className="text-text-primary font-bold text-2xl mt-4">Activity</Text>
      </View>
    </SafeAreaView>
  );
}
