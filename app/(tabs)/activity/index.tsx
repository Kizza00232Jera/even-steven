import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ErrorState';

function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      // Activity feed will be wired to Supabase here
      return [] as { id: string; description: string }[];
    },
  });
}

function SkeletonActivityRow() {
  return (
    <View className="flex-row items-start gap-3 py-3 border-b border-border">
      <Skeleton width={36} height={36} borderRadius={18} />
      <View className="flex-1 gap-2 pt-1">
        <Skeleton width={'80%'} height={13} borderRadius={6} />
        <Skeleton width={70} height={11} borderRadius={6} />
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const { isLoading, isError, refetch } = useActivity();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <Text className="text-text-primary font-bold text-2xl mt-4 mb-4">Activity</Text>
        {isLoading && (
          <View>
            <SkeletonActivityRow />
            <SkeletonActivityRow />
            <SkeletonActivityRow />
            <SkeletonActivityRow />
          </View>
        )}
        {isError && <ErrorState onRetry={refetch} />}
        {!isLoading && !isError && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-text-secondary text-sm text-center">
              No activity yet.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
