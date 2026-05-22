import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/auth';
import { updateProfile } from '../../../lib/repos/profiles';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../lib/database.types';

type Currency = Database['public']['Tables']['profiles']['Row']['preferred_currency'];

const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: 'USD', label: 'USD', symbol: '$' },
  { code: 'EUR', label: 'EUR', symbol: '€' },
  { code: 'DKK', label: 'DKK', symbol: 'kr' },
  { code: 'SEK', label: 'SEK', symbol: 'kr' },
];

export default function CurrencyScreen() {
  const router = useRouter();
  const { session, setProfile } = useAuthStore();

  const [selected, setSelected] = useState<Currency | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = selected === null || isSaving;

  async function handleContinue() {
    if (isDisabled || !selected) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(supabase, session!.user.id, {
        preferred_currency: selected,
      });
      setProfile(updated);
      router.push('/(auth)/onboarding/notifications' as never);
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-16 pb-8">
        <View className="flex-1">
          <Text className="font-display text-3xl font-bold text-text-primary mb-3">
            Your preferred currency
          </Text>
          <Text className="font-body text-base text-text-secondary mb-8">
            Used as default when adding expenses.
          </Text>

          <View className="gap-3">
            {CURRENCIES.map(({ code, label, symbol }) => {
              const isSelected = selected === code;
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => setSelected(code)}
                  className={`flex-row items-center px-5 py-4 rounded-2xl border ${
                    isSelected
                      ? 'bg-accent-dim border-accent'
                      : 'bg-surface border-border'
                  }`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text className="font-display text-xl font-semibold text-text-primary w-12">
                    {symbol}
                  </Text>
                  <Text
                    className={`font-body text-base font-medium ${
                      isSelected ? 'text-accent' : 'text-text-primary'
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {error && (
            <Text className="font-body text-sm text-destructive mt-4">{error}</Text>
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
    </SafeAreaView>
  );
}
