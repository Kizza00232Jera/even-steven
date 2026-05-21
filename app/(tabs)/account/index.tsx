import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth';
import { signOut } from '../../../lib/auth';

export default function AccountScreen() {
  const queryClient = useQueryClient();
  const { session, profile } = useAuthStore();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName = profile?.display_name ?? session?.user?.user_metadata?.full_name ?? '';
  const email = session?.user?.email ?? '';
  const avatarUrl = profile?.avatar_url ?? profile?.google_avatar_url ?? null;

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut(queryClient);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6">
        <Text className="font-display text-2xl font-bold text-text-primary mt-6 mb-8">
          Account
        </Text>

        {/* Profile section */}
        <View className="flex-row items-center gap-4 mb-8">
          <View className="w-16 h-16 rounded-full bg-surface-2 items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} className="w-16 h-16" />
            ) : (
              <Text className="font-display text-2xl font-semibold text-text-secondary">
                {displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="font-display text-lg font-semibold text-text-primary">
              {displayName}
            </Text>
            <Text className="font-body text-sm text-text-secondary">{email}</Text>
          </View>
        </View>

        {/* Preferred currency */}
        {profile?.preferred_currency && (
          <View className="bg-surface rounded-2xl px-5 py-4 mb-6 border border-border">
            <Text className="font-body text-sm text-text-secondary mb-1">
              Preferred currency
            </Text>
            <Text className="font-display text-base font-semibold text-text-primary">
              {profile.preferred_currency}
            </Text>
          </View>
        )}

        <View className="flex-1" />

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          disabled={isSigningOut}
          className="rounded-full py-4 items-center border border-destructive/40 mb-4"
        >
          {isSigningOut ? (
            <ActivityIndicator color="#FF4444" />
          ) : (
            <Text className="font-body font-medium text-base text-destructive">
              Sign out
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
