import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useAuthStore } from '../../../store/auth';
import { upsertProfile } from '../../../lib/repos/profiles';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';

export default function DisplayNameScreen() {
  const router = useRouter();
  const { session, setProfile } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const placeholderColor = colorScheme === 'dark' ? Colors.dark.textTertiary : Colors.light.textTertiary;

  const gmailName = (session?.user?.user_metadata?.full_name as string | undefined) ?? '';
  const [name, setName] = useState(gmailName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = name.trim().length === 0 || isSaving;

  async function handleContinue() {
    if (isDisabled) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await upsertProfile(supabase, session!.user.id, session!.user.email!, {
        display_name: name.trim(),
        google_avatar_url: session?.user?.user_metadata?.avatar_url ?? null,
      });
      setProfile(updated);
      router.replace('/(auth)/onboarding/currency');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-16 pb-8">
          <View className="flex-1">
            <Text className="font-display text-3xl font-bold text-text-primary mb-3">
              What&apos;s your name?
            </Text>
            <Text className="font-body text-base text-text-secondary mb-8">
              This is how you&apos;ll appear to your group members.
            </Text>

            <TextInput
              className="bg-surface-2 text-text-primary font-body text-base px-4 py-4 rounded-2xl border border-border"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={placeholderColor}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              maxLength={60}
            />

            {error && (
              <Text className="font-body text-sm text-destructive mt-3">{error}</Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleContinue}
            disabled={isDisabled}
            testID="continue-button"
            className={`rounded-full py-4 items-center ${isDisabled ? 'bg-accent/40' : 'bg-accent'}`}
            accessibilityState={{ disabled: isDisabled }}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-body font-medium text-base text-white">Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

