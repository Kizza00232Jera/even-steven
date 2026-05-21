import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SkeletonExpenseCard } from '../../../components/SkeletonExpenseCard';
import { SkeletonBalanceRow } from '../../../components/SkeletonBalanceRow';
import { ErrorState } from '../../../components/ErrorState';
import { RemovedMemberState } from '../../../components/RemovedMemberState';

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

  if (group !== null && !group?.isMember) {
    return <RemovedMemberState />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <Text className="text-text-primary font-bold text-2xl mt-4">Group {id}</Text>
      </View>
    </SafeAreaView>
  );
}
