import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Users, Calendar, AlertCircle } from 'lucide-react-native';
import { lookupInviteToken, acceptInvite, type InviteTokenDetails } from '../../lib/repos/invites';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { Colors } from '../../constants/colors';

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  const year = new Date(end + 'T00:00:00').getFullYear();
  return `${fmt(start)} – ${fmt(end)}, ${year}`;
}

export default function InviteScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useAuthStore();

  const [details, setDetails]     = useState<InviteTokenDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInvalid, setIsInvalid] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsInvalid(true);
      setIsLoading(false);
      return;
    }

    lookupInviteToken(supabase, token)
      .then((result) => {
        if (result) {
          setDetails(result);
        } else {
          setIsInvalid(true);
        }
      })
      .catch(() => setIsInvalid(true))
      .finally(() => setIsLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!session) {
      router.replace('/(auth)');
      return;
    }

    if (!details) return;
    setIsJoining(true);
    try {
      await acceptInvite(supabase, details.group_id, session.user.id, session.user.email!);
      router.replace(`/group/${details.group_id}` as never);
    } catch {
      setIsJoining(false);
    }
  }

  function handleDecline() {
    router.replace('/(tabs)/groups');
  }

  function handleOpenApp() {
    router.replace('/(tabs)/groups');
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator testID="loading-indicator" size="large" color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (isInvalid || !details) {
    return (
      <SafeAreaView className="flex-1 bg-background px-6 items-center justify-center">
        <View className="items-center mb-8">
          <AlertCircle size={56} color={Colors.destructive} />
        </View>
        <Text className="font-display text-text-primary text-2xl font-bold text-center mb-3">
          Link no longer valid
        </Text>
        <Text className="font-body text-text-secondary text-sm text-center mb-2 leading-6">
          This invite link is no longer valid.
        </Text>
        <Text className="font-body text-text-tertiary text-sm text-center mb-10 leading-6">
          Ask a group member to share a new invite link.
        </Text>
        <TouchableOpacity
          testID="open-app-button"
          onPress={handleOpenApp}
          className="bg-accent rounded-full px-8 py-4 w-full items-center"
        >
          <Text className="font-display text-white font-semibold text-base">
            Open Even Steven
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const showDates =
    details.group_type === 'Trip' && details.start_date && details.end_date;

  return (
    <SafeAreaView className="flex-1 bg-background px-6 justify-center">
      {/* Inviter + group name */}
      <View className="items-center mb-8">
        <Text className="font-body text-text-secondary text-sm text-center mb-2">
          {details.inviter_name
            ? `${details.inviter_name} invited you to join`
            : 'You were invited to join'}
        </Text>
        <Text className="font-display text-text-primary text-3xl font-bold text-center">
          {details.group_name}
        </Text>
        <Text className="font-body text-text-secondary text-sm capitalize mt-1">
          {details.group_type}
        </Text>
      </View>

      {/* Group meta */}
      <View className="bg-surface rounded-2xl border border-border p-5 gap-4 mb-8">
        <View className="flex-row items-center gap-3">
          <Users size={18} color={Colors.accent} />
          <Text className="font-body text-text-primary text-sm">
            {details.member_count} {details.member_count === 1 ? 'member' : 'members'}
          </Text>
        </View>

        {showDates && (
          <View className="flex-row items-center gap-3">
            <Calendar size={18} color={Colors.accent} />
            <Text className="font-body text-text-primary text-sm">
              {formatDateRange(details.start_date!, details.end_date!)}
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View className="gap-3">
        <TouchableOpacity
          testID="accept-button"
          onPress={handleAccept}
          disabled={isJoining}
          className="bg-accent rounded-full py-4 items-center"
        >
          {isJoining ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="font-display text-white font-semibold text-base">Accept</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          testID="decline-button"
          onPress={handleDecline}
          disabled={isJoining}
          className="rounded-full py-4 items-center border border-border"
        >
          <Text className="font-display text-text-primary font-semibold text-base">Decline</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
