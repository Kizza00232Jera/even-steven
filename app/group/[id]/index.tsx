import { View, Text, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Share2 } from 'lucide-react-native';
import { SkeletonExpenseCard } from '../../../components/SkeletonExpenseCard';
import { SkeletonBalanceRow } from '../../../components/SkeletonBalanceRow';
import { ErrorState } from '../../../components/ErrorState';
import { RemovedMemberState } from '../../../components/RemovedMemberState';
import { getOrCreateInviteToken } from '../../../lib/repos/invites';
import { getGroupMemberId } from '../../../lib/repos/groups';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { Colors } from '../../../constants/colors';
import { useState } from 'react';

const INVITE_BASE = 'even-steven.vercel.app/invite';

function useGroupDetail(id: string) {
  return useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      return null as {
        id: string;
        name: string;
        isMember: boolean;
      } | null;
    },
  });
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuthStore();
  const { data: group, isLoading, isError, refetch } = useGroupDetail(id);
  const [isSharing, setIsSharing] = useState(false);

  async function handleShareInviteLink() {
    if (!session || !id) return;
    setIsSharing(true);
    try {
      const memberId = await getGroupMemberId(supabase, id, session.user.id);
      if (!memberId) return;

      const token = await getOrCreateInviteToken(supabase, id, memberId);
      const url = `https://${INVITE_BASE}/${token}`;

      await Share.share({
        message: `Join my group on Even Steven: ${url}`,
        url,
      });
    } catch {
      // Share cancelled or error — no action needed
    } finally {
      setIsSharing(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 px-4">
          <View className="h-8 w-48 bg-surface-2 rounded-lg mt-4 mb-6" />
          <View className="gap-3 mb-6">
            <SkeletonExpenseCard />
            <SkeletonExpenseCard />
            <SkeletonExpenseCard />
          </View>
          <View className="gap-3">
            <SkeletonBalanceRow />
            <SkeletonBalanceRow />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 px-4 pt-4">
          <ErrorState onRetry={refetch} />
        </View>
      </SafeAreaView>
    );
  }

  if (group !== null && !group?.isMember) {
    return <RemovedMemberState />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <View className="flex-row items-center justify-between mt-4 mb-4">
          <Text className="text-text-primary font-bold text-2xl">Group {id}</Text>
          <TouchableOpacity
            onPress={handleShareInviteLink}
            disabled={isSharing}
            className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Share2 size={18} color={Colors.accent} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
