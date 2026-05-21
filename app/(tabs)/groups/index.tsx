import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Plus, Link } from 'lucide-react-native';
import { SkeletonGroupCard } from '../../../components/SkeletonGroupCard';
import { ErrorState } from '../../../components/ErrorState';
import { Colors } from '../../../constants/colors';
import { fetchGroups } from '../../../lib/repos/groups';
import { updateProfile } from '../../../lib/repos/profiles';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import type { Database } from '../../../lib/database.types';

type Group = Database['public']['Tables']['groups']['Row'];

function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => fetchGroups(supabase),
  });
}

function GroupCard({ group }: { group: Group }) {
  const router = useRouter();
  const gradientKey = group.type.toLowerCase() as keyof typeof Colors.gradients;
  const [fromColor] = Colors.gradients[gradientKey];

  return (
    <TouchableOpacity
      onPress={() => router.push(`/group/${group.id}`)}
      className="bg-surface rounded-2xl border border-border overflow-hidden"
      activeOpacity={0.8}
    >
      <View
        style={{ backgroundColor: fromColor, height: 4 }}
      />
      <View className="p-4">
        <Text className="font-display text-base font-semibold text-text-primary mb-1">
          {group.name}
        </Text>
        <Text className="font-body text-xs text-text-secondary capitalize">
          {group.type}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function BalanceNudgeModal({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/60 items-center justify-end pb-8 px-4">
        <View className="bg-surface rounded-2xl border border-border p-6 w-full">
          <Text className="font-display text-text-primary text-lg font-bold mb-2">
            Welcome back!
          </Text>
          <Text className="font-body text-text-secondary text-sm mb-6 leading-5">
            While you were away, you were added to some expenses. Open a group to view your balance.
          </Text>
          <TouchableOpacity
            onPress={onDismiss}
            className="bg-accent rounded-full py-4 items-center"
          >
            <Text className="font-display text-white font-semibold text-base">
              View balances
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function GroupsScreen() {
  const router = useRouter();
  const { session, profile, setProfile } = useAuthStore();
  const { data: groups, isLoading, isError, refetch } = useGroups();

  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    if (profile?.show_balance_nudge) {
      setShowNudge(true);
    }
  }, [profile?.show_balance_nudge]);

  async function handleDismissNudge() {
    setShowNudge(false);
    if (!session) return;
    try {
      const updated = await updateProfile(supabase, session.user.id, {
        show_balance_nudge: false,
      });
      setProfile(updated);
    } catch {
      // Non-critical — nudge will reappear next open but that's acceptable
    }
  }

  function renderContent() {
    if (isLoading) {
      return (
        <View className="gap-3">
          <SkeletonGroupCard />
          <SkeletonGroupCard />
          <SkeletonGroupCard />
        </View>
      );
    }

    if (isError) {
      return <ErrorState onRetry={refetch} />;
    }

    if (!groups?.length) {
      return (
        <View className="flex-1 items-center justify-center pt-20">
          <Text className="font-body text-text-secondary text-sm text-center mb-2">
            No groups yet.
          </Text>
          <Text className="font-body text-text-tertiary text-xs text-center mb-6">
            Tap + to create your first group.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/invite' as never)}
            className="flex-row items-center gap-2 px-5 py-3 rounded-full border border-border"
          >
            <Link size={16} color={Colors.accent} />
            <Text className="font-body text-text-secondary text-sm">Join with a link</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GroupCard group={item} />}
        contentContainerStyle={{ gap: 12 }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <View className="flex-row items-center justify-between mt-4 mb-4">
          <Text className="font-display text-text-primary font-bold text-2xl">Groups</Text>
          <TouchableOpacity
            onPress={() => router.push('/group/create')}
            testID="create-group-fab"
            className="w-10 h-10 rounded-full bg-accent items-center justify-center"
          >
            <Plus size={20} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        {renderContent()}
      </View>

      <BalanceNudgeModal visible={showNudge} onDismiss={handleDismissNudge} />
    </SafeAreaView>
  );
}
