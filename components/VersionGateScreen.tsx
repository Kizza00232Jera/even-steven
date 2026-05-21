import { View, Text, Pressable, Linking, Platform } from 'react-native';

const APP_STORE_URL =
  'https://apps.apple.com/app/even-steven/id0000000000';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.evensteven.app';

export function VersionGateScreen() {
  function openStore() {
    const url = Platform.OS === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
    Linking.openURL(url);
  }

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text className="font-display text-2xl font-bold text-text-primary text-center mb-4">
        Update required
      </Text>
      <Text className="font-body text-base text-text-secondary text-center mb-10">
        A new version of Even Steven is available. Update to continue.
      </Text>
      <Pressable
        onPress={openStore}
        className="bg-accent rounded-full px-10 py-4 active:opacity-80"
      >
        <Text className="font-display text-base font-semibold text-white">
          Update Now
        </Text>
      </Pressable>
    </View>
  );
}
