import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithGoogle } from '../../lib/auth';

export default function SignInScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Navigation is handled by the auth state listener in _layout
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed';
      if (!msg.includes('cancelled') && !msg.includes('SIGN_IN_CANCELLED')) {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-between py-12">
        <View className="flex-1 justify-center items-center">
          <Text className="font-display text-5xl font-bold text-text-primary mb-3 text-center">
            Even Steven
          </Text>
          <Text className="font-body text-lg text-text-secondary text-center max-w-xs">
            Split expenses with friends. Settle up with minimum payments.
          </Text>
        </View>

        <View>
          {error && (
            <Text className="font-body text-sm text-destructive text-center mb-4">
              {error}
            </Text>
          )}

          <TouchableOpacity
            onPress={handleSignIn}
            disabled={isLoading}
            testID="google-signin-button"
            className={`flex-row items-center justify-center rounded-full py-4 px-6 bg-surface border border-border gap-3 ${isLoading ? 'opacity-60' : ''}`}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
          >
            {isLoading ? (
              <ActivityIndicator color="#00C896" />
            ) : (
              <Text className="font-body font-medium text-base text-text-primary">
                Sign in with Google
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
