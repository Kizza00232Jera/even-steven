import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Bell } from 'lucide-react-native';
import { useAuthStore } from '../../../store/auth';
import { updateProfile } from '../../../lib/repos/profiles';
import { upsertPushToken } from '../../../lib/repos/pushTokens';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';

export default function NotificationsScreen() {
  const router = useRouter();
  const { session, setProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  async function finishOnboarding() {
    const updated = await updateProfile(supabase, session!.user.id, { onboarding_done: true });
    setProfile(updated);
    router.replace('/(tabs)/groups');
  }

  async function handleEnable() {
    setIsLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        if (projectId) {
          const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
          await upsertPushToken(supabase, session!.user.id, token, Platform.OS).catch(() => {});
        }
      }
    } catch {
      // permission failure is non-critical
    } finally {
      await finishOnboarding();
      setIsLoading(false);
    }
  }

  async function handleSkip() {
    await finishOnboarding();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-16 pb-8">
        <View className="flex-1 items-center justify-center">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-8"
            style={{ backgroundColor: 'rgba(0,200,150,0.12)' }}
          >
            <Bell size={36} color={Colors.accent} strokeWidth={1.5} />
          </View>

          <Text className="font-display text-3xl font-bold text-text-primary text-center mb-3">
            Stay in the loop
          </Text>
          <Text className="font-body text-base text-text-secondary text-center leading-relaxed">
            Get notified when expenses are added, payments recorded, or someone joins your group.
          </Text>
        </View>

        <View className="gap-3">
          <TouchableOpacity
            onPress={handleEnable}
            disabled={isLoading}
            className={`rounded-full py-4 items-center ${isLoading ? 'opacity-60' : ''}`}
            style={{ backgroundColor: Colors.accent }}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-body font-semibold text-base text-white">Enable notifications</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSkip}
            disabled={isLoading}
            className="py-4 items-center"
          >
            <Text className="font-body text-base text-text-tertiary">Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
