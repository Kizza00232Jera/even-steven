import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react-native';
import { SkeletonExpenseCard } from '../../../components/SkeletonExpenseCard';
import { SkeletonBalanceRow } from '../../../components/SkeletonBalanceRow';
import { ErrorState } from '../../../components/ErrorState';
import { RemovedMemberState } from '../../../components/RemovedMemberState';
import { Colors } from '../../../constants/colors';
import { useToast } from '../../../hooks/useToast';
import { fetchGroupById } from '../../../lib/repos/groups';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../lib/database.types';

type Group = Database['public']['Tables']['groups']['Row'];

function useGroupDetail(id: string) {
  return useQuery({
    queryKey: ['group', id],
    queryFn: () => fetchGroupById(supabase, id),
  });
}

function AddExpenseFab({ group }: { group: Group }) {
  const toast = useToast();
  const isExpiredOrArchived = group.status === 'expired' || group.status === 'archived';

  function handlePress() {
    if (isExpiredOrArchived) {
      toast.info('This trip has ended. Extend the trip in settings to add new expenses.');
      return;
    }
    // Expense form entry point — wired in a later issue
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      testID="add-expense-fab"
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: isExpiredOrArchived ? Colors.dark.textTertiary : Colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isExpiredOrArchived ? 0.6 : 1,
      }}
      activeOpacity={0.8}
    >
      <Plus size={24} color="#ffffff" strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: group, isLoading, isError, refetch } = useGroupDetail(id);

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

  if (!group) {
    return <RemovedMemberState />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <Text className="font-display text-text-primary font-bold text-2xl mt-4">
          {group.name}
        </Text>
        {group.status === 'expired' && (
          <View className="mt-2 mb-1 px-3 py-1.5 bg-surface rounded-xl self-start">
            <Text className="font-body text-xs text-text-secondary">Trip ended</Text>
          </View>
        )}
      </View>
      <AddExpenseFab group={group} />
    </SafeAreaView>
  );
}
